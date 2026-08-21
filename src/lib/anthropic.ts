/**
 * The model call: build the request, validate the answer, retry exactly once on
 * `AnswerInvalid`, and report real cost.
 *
 * The rubric + system instructions are one cached prefix (`cache_control` on the system
 * block) — byte-identical for every run of a call type, so the second and later runs read
 * it from cache at 0.1x. The transcript lives in the user message, after the breakpoint,
 * because it changes every run.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { CompiledRubric } from '../rubric/types'
import { AnswerInvalid, validateAnswer } from '../scoring/engine'
import type { ModelAnswer, NumberedTranscript, RunCost } from '../scoring/types'
import { buildSystemPrompt, buildUserMessage } from './prompt'
import { buildModelAnswerSchema, toModelAnswer } from './schema'

// Lazy — constructed on first use, not at module load. ESM hoists imports above a
// script's own top-level statements, so a module-scoped `new Anthropic()` here would run
// before a caller's `process.loadEnvFile('.env.local')` had a chance to set
// ANTHROPIC_API_KEY (seed.ts and apply-schema.ts hit exactly this). Next.js itself loads
// .env.local before any app code runs, so this only matters for the standalone scripts.
let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic()
  return _client
}

// Sonnet 5 intro pricing (through 2026-08-31). Cache writes are folded into inputTokens at
// the plain input rate — RunCost has no separate slot for them and the brief's cost table
// only lists these three rates. See NOTES-backend.md.
const USD_PER_INPUT_MTOK = 2
const USD_PER_OUTPUT_MTOK = 10
const CACHE_READ_MULTIPLIER = 0.1

export class ModelRefused extends Error {}
export class ModelTruncated extends Error {}

export type ScoreResult = { answer: ModelAnswer; cost: RunCost }

export async function scoreTranscript(
  rubric: CompiledRubric,
  transcript: NumberedTranscript,
): Promise<ScoreResult> {
  const model = process.env.ANTHROPIC_MODEL!
  const schema = buildModelAnswerSchema(rubric)
  const system = buildSystemPrompt(rubric)

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: buildUserMessage(transcript) }]

  let inputTokens = 0
  let cachedInputTokens = 0
  let outputTokens = 0
  let thinkingTokens: number | null = null

  const call = async (): Promise<Anthropic.Message> => {
    // Streamed, then collected. Not for progressive rendering — nothing watches this, the
    // operator has closed the tab — but because the SDK refuses a non-streaming request
    // whose worst-case duration could exceed ten minutes, and it estimates that from
    // max_tokens. Raising the cap enough to stop truncating tripped that guard, so the two
    // are linked: you cannot have the headroom without streaming for it.
    const response = await client().messages.stream({
      model,
      // Reasoning tokens count toward this cap, and reasoning is most of the output on
      // these transcripts. kickoff-02 was measured at 16,561 output tokens against a
      // 16,000 ceiling, so the longest of the client's four calls was already truncating
      // on a coin flip — it passed locally and failed on the first production run. The
      // cap is a ceiling, not a reservation: raising it costs nothing unless used.
      max_tokens: 32000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages,
      output_config: {
        format: { type: 'json_schema', schema },
        // Left at the model's default. Most of the bill is reasoning — roughly 10k-16k of
        // the output tokens on these transcripts — so this is the one dial that moves
        // cost materially. `scripts/calibrate.ts` re-scores the samples at a chosen
        // effort so the trade-off is measured rather than assumed.
        ...(process.env.ANTHROPIC_EFFORT
          ? { effort: process.env.ANTHROPIC_EFFORT as 'low' | 'medium' | 'high' | 'xhigh' | 'max' }
          : {}),
      },
    }).finalMessage()

    inputTokens += response.usage.input_tokens + (response.usage.cache_creation_input_tokens ?? 0)
    cachedInputTokens += response.usage.cache_read_input_tokens ?? 0
    outputTokens += response.usage.output_tokens

    const reasoning = response.usage.output_tokens_details?.thinking_tokens
    if (typeof reasoning === 'number') thinkingTokens = (thinkingTokens ?? 0) + reasoning

    if (response.stop_reason === 'refusal')
      throw new ModelRefused(response.stop_details?.explanation ?? 'the model declined to score this call')
    if (response.stop_reason === 'max_tokens')
      throw new ModelTruncated('the model answer was cut off before it finished (hit max_tokens)')

    return response
  }

  const parse = (response: Anthropic.Message): ModelAnswer => {
    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    if (!block) throw new Error('model response had no text content block')
    return toModelAnswer(JSON.parse(block.text))
  }

  let response = await call()
  let answer = parse(response)

  try {
    validateAnswer(answer, rubric, transcript)
  } catch (err) {
    if (!(err instanceof AnswerInvalid)) throw err

    messages.push({ role: 'assistant', content: response.content })
    messages.push({
      role: 'user',
      content: [
        `Your answer had ${err.problems.length} problem(s):`,
        ...err.problems.map((p) => `- ${p}`),
        '',
        'Resend the complete corrected JSON — every dimension and every cap, not only the ones with problems.',
      ].join('\n'),
    })

    response = await call()
    answer = parse(response)
    validateAnswer(answer, rubric, transcript) // still throws AnswerInvalid if the retry is also bad
  }

  return {
    answer,
    cost: {
      inputTokens,
      cachedInputTokens,
      outputTokens,
      thinkingTokens,
      usd:
        (inputTokens * USD_PER_INPUT_MTOK +
          cachedInputTokens * USD_PER_INPUT_MTOK * CACHE_READ_MULTIPLIER +
          outputTokens * USD_PER_OUTPUT_MTOK) /
        1_000_000,
      model,
    },
  }
}
