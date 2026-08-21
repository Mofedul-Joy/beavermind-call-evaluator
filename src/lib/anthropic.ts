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

  const call = async (): Promise<Anthropic.Message> => {
    const response = await client().messages.create({
      model,
      max_tokens: 16000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages,
      output_config: { format: { type: 'json_schema', schema } }, // default effort — see NOTES-backend.md
    })

    inputTokens += response.usage.input_tokens + (response.usage.cache_creation_input_tokens ?? 0)
    cachedInputTokens += response.usage.cache_read_input_tokens ?? 0
    outputTokens += response.usage.output_tokens

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
      usd:
        (inputTokens * USD_PER_INPUT_MTOK +
          cachedInputTokens * USD_PER_INPUT_MTOK * CACHE_READ_MULTIPLIER +
          outputTokens * USD_PER_OUTPUT_MTOK) /
        1_000_000,
      model,
    },
  }
}
