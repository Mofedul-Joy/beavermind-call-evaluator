/**
 * Assembles the request sent to the model: a system prompt built from the compiled rubric
 * (cached — byte-identical for every run of a call type) and a user message carrying the
 * numbered transcript (not cached — different every run).
 */
import { renderForModel } from '../scoring/engine'
import type { Cap, CompiledRubric, Dimension } from '../rubric/types'
import type { NumberedTranscript } from '../scoring/types'

function scoringTable(d: Dimension): string {
  if (d.scoring.mode === 'discrete')
    return d.scoring.buckets.map((b) => `  - ${b.value} (${b.label}): ${b.criteria}`).join('\n')
  const halfStep = d.scoring.allowsHalfSteps ? ' (half-steps allowed)' : ''
  return d.scoring.bands.map((b) => `  - ${b.min}–${b.max} (${b.label})${halfStep}: ${b.criteria}`).join('\n')
}

function dimensionBlock(d: Dimension): string {
  const lines = [
    `### D${d.n}. ${d.title} (max ${d.max})`,
    d.whatToLookFor,
    '',
    'Scoring table:',
    scoringTable(d),
  ]
  if (d.positiveSignals.length)
    lines.push('', 'Positive signals:', ...d.positiveSignals.map((s) => `  - ${s}`))
  if (d.negativeSignals.length)
    lines.push('', 'Negative signals:', ...d.negativeSignals.map((s) => `  - ${s}`))
  if (d.notes.length) lines.push('', 'Notes:', ...d.notes.map((n) => `  - ${n}`))
  if (d.optional)
    lines.push(
      '',
      `This dimension is OPTIONAL: mark it "disabled" — with a statusReason — when every one of these is absent from the call: ${d.optional.detectionCriteria.join('; ')}.`,
    )
  return lines.join('\n')
}

function capBlock(c: Cap): string {
  return `- ${c.id}: "${c.condition}"`
}

export function buildSystemPrompt(rubric: CompiledRubric): string {
  const sections: string[] = [
    `You are scoring a ${rubric.title} for a coaching business, against the rubric below. ` +
      `You will be shown a full transcript with 1-based line numbers, formatted "L0142 [Speaker]: text". ` +
      `Your job is pure judgement: which bucket each dimension lands in, and whether each cap condition ` +
      `holds. You never compute a total, a band, or a capped score — that arithmetic happens outside you.`,

    [
      'Discipline, non-negotiable:',
      '- Score only what is actually verifiable in the transcript. Never infer from what a good coach would',
      '  probably do, never fill gaps with charitable assumptions, never score on the vibe or energy of the call.',
      '- If a dimension\'s behaviour is simply not present in the transcript, set status to "not_evidenced" and',
      '  say why in statusReason. Do not force a score onto absent evidence — "not_evidenced" is the honest,',
      '  expected answer for a thin or partial call, not a failure state.',
      '- A dimension\'s whatToLookFor names a SPECIFIC behaviour, not a general topic. A conversation that touches',
      '  the same general subject area without the specific behaviour described is not evidence for it — it is',
      '  absence. Example: logistics questions about a client\'s work schedule are not evidence for a dimension',
      '  asking whether the coach probed behavioural patterns, learning style, or psychology, even though both are',
      '  "questions about the client\'s life". Before scoring a dimension at its lowest bucket, stop and ask: did',
      '  the coach actually ATTEMPT this specific behaviour and do it badly, or did they never attempt it at all?',
      '  The first is a scored floor; the second is not_evidenced. Do not default to the scored floor just because',
      '  something adjacent happened somewhere in the call.',
      '- Naming a thing is not explaining it, and declining to elaborate is not a soft attempt. If the coach says',
      '  "we\'ll get into that later" or otherwise explicitly defers or brushes past a topic without ever actually',
      '  doing it, treat that as not_evidenced for that specific behaviour, not as a low score — the behaviour the',
      '  dimension asks about still never happened.',
      '- Calibration check: a real call rarely attempts all twelve dimensions\' specific behaviours, even badly —',
      '  most calls genuinely skip several of them outright. If your answer has zero or one not_evidenced',
      '  dimension, that is a signal to go back over the ones you scored at their lowest bucket and check honestly',
      '  whether the transcript shows the coach doing that dimension\'s specific behaviour at all, versus you',
      '  having connected loosely-adjacent conversation to it because a low score felt safer than admitting',
      '  absence. When a lowest-bucket dimension\'s own evidence, read plainly, does not describe the coach',
      '  actually attempting the behaviour, not_evidenced is the more honest answer — regardless of whether some',
      '  generic conversation happened nearby. This does not override a dimension\'s own lowest bucket when that',
      '  bucket\'s criteria explicitly describes the transcript\'s content (e.g. a bucket that is itself defined as',
      '  "generic/logistics-only questions" when that is exactly what happened) — score it there instead. Reserve',
      '  not_evidenced for when nothing in any bucket, including the lowest, actually describes what the coach did.',
      '- The ceiling is as disciplined as the floor. quickFix completes the sentence "To reach {max}: ...".',
      '  If you can name one specific thing the coach could have done better on this dimension, then the',
      '  dimension is NOT at its maximum — write that thing in quickFix and score it one bucket down. Award the',
      '  maximum only when you genuinely cannot name a single specific improvement, and in that case leave',
      '  quickFix as an empty string. A maximum is a claim that this is the best a coach could have done on this',
      '  dimension, not a reward for the absence of an obvious error.',
      '- Cross-check before you finish: whatever you put in theOneThing.change is, by definition, the biggest',
      '  weakness in the call. Find the dimension it belongs to. That dimension cannot be at its maximum. If it',
      '  is, one of the two is wrong — either the call has a real weakness and that dimension should come down,',
      '  or it does not and theOneThing should be about something else.',
      '- Every evidence field is a list of transcript line numbers (integers), and nothing else. Never put quoted',
      '  text, a paraphrase, or a description into an evidence field — line numbers only, and only lines that',
      '  actually appear in the transcript below.',
      '- Never read the mood of the call. "The client seemed engaged" is not evidence; a specific verifiable',
      '  behaviour on a specific line is.',
      '- For caps: report only whether the written condition holds, with supporting evidence and reasoning. You',
      '  never apply a cap\'s effect — that is arithmetic, and it happens outside you.',
      '- Every dimension needs a score and a quickFix value even when status is not "scored" — the schema',
      '  requires them, but they are discarded downstream whenever status is not "scored". In that case, use the',
      '  dimension\'s lowest allowed score and an empty string for quickFix; put your real reasoning in',
      '  statusReason instead. statusReason itself is an empty string when status is "scored".',
      '- "dimensions" and "capFindings" are arrays. Include exactly one entry per dimension listed below (its',
      '  "key" field must match one of them verbatim) and exactly one entry per cap listed below (its "capId"',
      '  must match one of them verbatim) — no duplicates, none missing. A score must be one of the exact values',
      '  printed in that dimension\'s scoring table below, nothing else.',
    ].join('\n'),

    ['Preamble:', ...rubric.preamble].join('\n'),
    ['Principles:', ...rubric.principles].join('\n'),
  ]

  if (rubric.calibrationAnchors.length)
    sections.push(['Calibration anchors:', ...rubric.calibrationAnchors].join('\n'))

  sections.push(['## Dimensions', ...rubric.dimensions.map(dimensionBlock)].join('\n\n'))

  sections.push(
    [
      '## Caps',
      'Deterministic rules the client wrote. Judge only whether each condition holds — never apply its effect.',
      ...rubric.caps.map(capBlock),
    ].join('\n'),
  )

  return sections.join('\n\n')
}

export function buildUserMessage(transcript: NumberedTranscript): string {
  return [
    'Numbered transcript. Cite these line numbers as evidence — never quote or paraphrase transcript text',
    'into a JSON field, and never cite a line number that is not printed below.',
    '',
    renderForModel(transcript),
  ].join('\n')
}
