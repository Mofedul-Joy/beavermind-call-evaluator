/**
 * Compiles the client's grading documents into something a model can score against.
 *
 *   rubrics/*.md  ──►  src/rubric/compiled/*.json
 *
 * The markdown is the source of truth and is never edited. This script parses it and then
 * asserts a set of invariants about the result. If the client edits a rubric in a way the
 * parser does not understand, the build FAILS here rather than silently producing a rubric
 * that scores differently — which is the whole point.
 *
 *   npm run compile:rubrics
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Band, Cap, CompiledRubric, Dimension, Discrepancy, Scoring } from '../src/rubric/types'

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, 'src/rubric/compiled')

/** Collapse the soft wrapping in the source so a criteria cell is one line of prose. */
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim()

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

/** Split a markdown table row into cells, dropping the empty edges. */
function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => tidy(c))
}

function isTableRow(line: string) {
  return line.trim().startsWith('|')
}

function isSeparatorRow(line: string) {
  return /^\|[\s:|-]+\|$/.test(line.trim())
}

/** Pull the first markdown table that appears after `fromIndex`, as arrays of cells. */
function tableAfter(lines: string[], fromIndex: number): { rows: string[][]; end: number } {
  let i = fromIndex
  while (i < lines.length && !isTableRow(lines[i])) i++
  const rows: string[][] = []
  while (i < lines.length && isTableRow(lines[i])) {
    if (!isSeparatorRow(lines[i])) rows.push(cells(lines[i]))
    i++
  }
  return { rows, end: i }
}

/**
 * Parse one dimension's scoring table.
 *
 * Two shapes exist in these documents and BOTH appear inside the kickoff rubric, so this
 * is decided per-dimension rather than per-file:
 *
 *   | Score | Criteria |          →  discrete   **10/10 — Elite**
 *   | Band  | Score | Criteria |  →  band       **Elite** | 9–10
 */
function parseScoring(rows: string[][], max: number): Scoring {
  const header = rows[0].map((h) => h.toLowerCase())
  const body = rows.slice(1)

  // Three-column band table.
  if (header.length === 3 && header[0].includes('band') && header[1].includes('score')) {
    const bands = body.map(([bandCell, scoreCell, criteria]) => {
      const label = tidy(bandCell.replace(/\*\*/g, ''))
      // "9–10", "4.5–5", "0"  (en dash in the source, not a hyphen)
      const m = scoreCell.replace(/\*\*/g, '').match(/([\d.]+)\s*[–-]\s*([\d.]+)|([\d.]+)/)
      if (!m) throw new Error(`unparsed band score cell: ${scoreCell}`)
      const min = parseFloat(m[1] ?? m[3])
      const bandMax = parseFloat(m[2] ?? m[3])
      return { label, min, max: bandMax, criteria: tidy(criteria) }
    })
    return { mode: 'band', bands, allowsHalfSteps: max <= 5 }
  }

  // Two-column discrete table.
  const buckets = body.map(([scoreCell, criteria]) => {
    const cleaned = scoreCell.replace(/\*\*/g, '')
    // "10/10 — Elite"  /  "0/15 — Fail"
    const m = cleaned.match(/([\d.]+)\s*\/\s*[\d.]+\s*[–—-]\s*(.+)/)
    if (!m) throw new Error(`unparsed discrete score cell: ${scoreCell}`)
    return { value: parseFloat(m[1]), label: tidy(m[2]), criteria: tidy(criteria) }
  })
  return { mode: 'discrete', buckets }
}

/**
 * Turn a cap's effect column into something executable.
 *
 * The client writes effects as prose: "0/5 on D10 (non-recoverable…)", "Max 10/15 on D3",
 * "Max 75 total", "Max 70 total". Anything this cannot decode throws, because a cap that
 * silently fails to apply is worse than a build error.
 */
function parseCapEffect(condition: string, effect: string): Cap {
  const nonRecoverable = /non-recoverable/i.test(effect)
  const clean = effect.replace(/\([^)]*\)/g, ' ')

  let parsed: Cap['effect'] | null = null

  // "Max 75 total"  /  "Max 70 total"
  const totalMatch = clean.match(/max\s+([\d.]+)\s+total/i)
  if (totalMatch) parsed = { type: 'total_max', value: parseFloat(totalMatch[1]) }

  // "Max 10/15 on D3" / "Max 10/15 on Dimension 4"  →  that dimension cannot exceed 10.
  // The two rubrics refer to dimensions both ways, so accept either spelling.
  const DIM_REF = String.raw`(?:D|Dimension\s*)(\d+)`
  const dimMax = clean.match(new RegExp(String.raw`max\s+([\d.]+)\s*\/\s*[\d.]+\s*on\s*${DIM_REF}`, 'i'))
  if (dimMax)
    parsed = { type: 'dimension_max', dimension: parseInt(dimMax[2], 10), value: parseFloat(dimMax[1]) }

  // "0/5 on D10"  →  D10 is fixed at 0
  const dimFixed = clean.match(new RegExp(String.raw`^\s*([\d.]+)\s*\/\s*[\d.]+\s*on\s*${DIM_REF}`, 'i'))
  if (!dimMax && dimFixed)
    parsed = { type: 'dimension_fixed', dimension: parseInt(dimFixed[2], 10), value: parseFloat(dimFixed[1]) }

  if (!parsed) throw new Error(`could not decode cap effect: "${effect}"`)

  return { id: slug(condition).slice(0, 60), condition: tidy(condition), effect: parsed, nonRecoverable, raw: `${condition} → ${effect}` }
}

/** The optional-dimension block (coaching D4) states its own detection criteria. */
function parseOptional(block: string) {
  if (!/Optional dimension\s*—\s*disable when/i.test(block)) return undefined
  const criteria = [...block.matchAll(/^\s*>\s*\d+\.\s+(.+)$/gm)].map((m) => tidy(m[1]))
  const maxPossible = block.match(/max_possible:\s*(\d+)/)
  if (!criteria.length) throw new Error('optional block found but no detection criteria parsed')
  if (!maxPossible) throw new Error('optional block found but no max_possible parsed')
  return { detectionCriteria: criteria, disabledMaxPossible: parseInt(maxPossible[1], 10) }
}

function parseRubric(id: 'coaching' | 'kickoff', file: string): CompiledRubric {
  const src = readFileSync(join(ROOT, 'rubrics', file), 'utf8')
  const lines = src.split('\n')

  const title = tidy(lines[0].replace(/^#\s*/, ''))

  // ── Caps ────────────────────────────────────────────────────────────────────
  const capsHeading = lines.findIndex((l) => /Global Automatic Score Caps/i.test(l))
  if (capsHeading < 0) throw new Error(`${file}: no caps table`)
  const capsTable = tableAfter(lines, capsHeading)
  const caps = capsTable.rows.slice(1).map(([condition, effect]) => parseCapEffect(condition, effect))

  // ── Dimensions ──────────────────────────────────────────────────────────────
  // Each starts at "### Dimension N — Title (X pts)" and runs to the next one.
  const dimStarts: number[] = []
  lines.forEach((l, i) => {
    if (/^###\s+Dimension\s+\d+\s*—/.test(l)) dimStarts.push(i)
  })
  const bandsHeading = lines.findIndex((l) => /^##\s+Scoring Bands Reference/i.test(l))

  const dimensions: Dimension[] = dimStarts.map((start, idx) => {
    const end = idx + 1 < dimStarts.length ? dimStarts[idx + 1] : bandsHeading
    const block = lines.slice(start, end).join('\n')
    const head = lines[start]

    const m = head.match(/^###\s+Dimension\s+(\d+)\s*—\s*(.+?)\s*\((\d+(?:\.\d+)?)\s*pts?\)/)
    if (!m) throw new Error(`${file}: unparsed dimension heading: ${head}`)
    const n = parseInt(m[1], 10)
    const rawTitle = m[2].replace(/\s*—\s*Optional\s*$/i, '').trim()
    const max = parseFloat(m[3])

    const { rows } = tableAfter(lines, start)
    if (!rows.length) throw new Error(`${file}: D${n} has no scoring table`)

    const pick = (re: RegExp) => {
      const hit = block.match(re)
      return hit ? tidy(hit[1]) : undefined
    }

    const signals = (which: 'Positive' | 'Negative') => {
      const re = new RegExp(`\\*\\*${which}[^*]*signals?[^*]*:\\*\\*\\s*([^\\n]+)`, 'i')
      const hit = block.match(re)
      if (!hit) return []
      return hit[1]
        .split('/')
        .map((s) => tidy(s.replace(/\s*$/, '')))
        .filter(Boolean)
    }

    const notes = [...block.matchAll(/\*\*Calibration note[^:]*:\*\*\s*([^\n]+)/gi)].map((x) => tidy(x[1]))
    const scopeQuotes = [...block.matchAll(/^>\s*\*\*(.+?)\*\*\s*(.*)$/gm)]
      .map((x) => tidy(`${x[1]} ${x[2]}`))
      .filter((s) => !/Optional dimension/i.test(s))

    return {
      n,
      key: slug(rawTitle),
      title: rawTitle,
      max,
      pillar: pick(/\*\*Pillar:\s*(.+?)\*\*/),
      sopTime: pick(/\*\*SOP (?:time allocation|target):\s*(.+?)\*\*/),
      whatToLookFor: pick(/\*\*What to look for:\*\*\s*([^\n]+)/) ?? '',
      scoring: parseScoring(rows, max),
      positiveSignals: signals('Positive'),
      negativeSignals: signals('Negative'),
      notes: [...notes, ...scopeQuotes],
      optional: parseOptional(block),
    }
  })

  // ── Bands ───────────────────────────────────────────────────────────────────
  const bandTable = tableAfter(lines, bandsHeading)
  const bands: Band[] = bandTable.rows.slice(1).map(([name, score, description]) => {
    const clean = score.replace(/\*\*/g, '').replace(/</g, '').trim()
    const range = clean.match(/([\d.]+)\s*[–-]\s*([\d.]+)/)
    return range
      ? { name: tidy(name.replace(/\*\*/g, '')), min: parseFloat(range[1]), max: parseFloat(range[2]), description: tidy(description) }
      : { name: tidy(name.replace(/\*\*/g, '')), min: 0, max: parseFloat(clean) - 0.01, description: tidy(description) }
  })

  // ── Preamble, principles, calibration anchors ───────────────────────────────
  const firstDim = dimStarts[0]
  const preamble = [...lines.slice(0, firstDim).join('\n').matchAll(/^>\s*(.+)$/gm)]
    .map((x) => tidy(x[1]))
    .filter(Boolean)

  const principlesIdx = lines.findIndex((l) => /^##\s+Scoring Principles/i.test(l))
  const anchorsIdx = lines.findIndex((l) => /^##\s+Calibration Anchors/i.test(l))
  const principlesBlock = lines
    .slice(principlesIdx + 1, anchorsIdx > 0 ? anchorsIdx : undefined)
    .join('\n')
  const principles = [...principlesBlock.matchAll(/^\d+\.\s+(.+(?:\n(?!\d+\.|\s*$).*)*)/gm)].map((x) => tidy(x[1]))

  const calibrationAnchors =
    anchorsIdx > 0
      ? [...lines.slice(anchorsIdx).join('\n').matchAll(/\*\*(D\d+[^*]+)\*\*\s*((?:\n-\s*.+)+)/g)].map((x) =>
          tidy(`${x[1]} ${x[2].replace(/\n-\s*/g, ' | ')}`),
        )
      : []

  // ── Reconcile the document's prose against its own tables ──────────────────
  const activeMaxRaw = dimensions.reduce((a, d) => a + d.max, 0)
  const statedTotal = parseInt(src.match(/Twelve dimensions,\s*(\d+)\s*points/i)?.[1] ?? '100', 10)
  const discrepancies: Discrepancy[] = []

  if (activeMaxRaw !== statedTotal) {
    discrepancies.push({
      what: 'Dimension maxima do not sum to the stated total',
      stated: `"Twelve dimensions, ${statedTotal} points"`,
      computed: `the twelve printed maxima sum to ${activeMaxRaw}`,
      resolution:
        `Scored on the printed maxima and normalised: raw / ${activeMaxRaw} x 100. ` +
        `The printed per-dimension tables are the only numbers the rubric actually ` +
        `supports, and normalising is the method the rubric itself prescribes.`,
    })
  }

  for (const d of dimensions.filter((x) => x.optional)) {
    const trueDisabledMax = activeMaxRaw - d.max
    if (d.optional!.disabledMaxPossible !== trueDisabledMax) {
      discrepancies.push({
        what: `Stated total with D${d.n} disabled does not match the printed maxima`,
        stated: `max_possible: ${d.optional!.disabledMaxPossible}`,
        computed: `${activeMaxRaw} - ${d.max} = ${trueDisabledMax}`,
        resolution:
          `Used ${trueDisabledMax} as the denominator when D${d.n} is disabled, then ` +
          `normalised to 100 — the same method the rubric prescribes for that case.`,
      })
    }
  }

  return {
    id,
    title,
    sourceHash: createHash('sha256').update(src).digest('hex').slice(0, 12),
    sourceFile: `rubrics/${file}`,
    statedTotalPoints: statedTotal,
    activeMaxRaw,
    discrepancies,
    reportScale: 100,
    dimensions,
    caps,
    bands,
    preamble,
    principles,
    calibrationAnchors,
  }
}

/**
 * Invariants. A rubric that violates any of these would score differently from the
 * document the client actually uses, so the build stops.
 */
function assertSound(r: CompiledRubric) {
  const fail = (msg: string) => {
    throw new Error(`[${r.id}] ${msg}`)
  }

  if (r.dimensions.length !== 12) fail(`expected 12 dimensions, parsed ${r.dimensions.length}`)

  r.dimensions.forEach((d, i) => {
    if (d.n !== i + 1) fail(`dimension ${i + 1} is numbered D${d.n}`)
    if (!d.title) fail(`D${d.n} has no title`)
    if (!(d.max > 0)) fail(`D${d.n} has max ${d.max}`)
    if (!d.whatToLookFor) fail(`D${d.n} has no "what to look for"`)

    if (d.scoring.mode === 'discrete') {
      if (d.scoring.buckets.length < 2) fail(`D${d.n} has ${d.scoring.buckets.length} buckets`)
      const top = Math.max(...d.scoring.buckets.map((b) => b.value))
      if (top !== d.max) fail(`D${d.n} top bucket is ${top} but max is ${d.max}`)
      if (!d.scoring.buckets.some((b) => b.value === 0)) fail(`D${d.n} has no zero bucket`)
    } else {
      if (d.scoring.bands.length < 2) fail(`D${d.n} has ${d.scoring.bands.length} bands`)
      const top = Math.max(...d.scoring.bands.map((b) => b.max))
      if (top !== d.max) fail(`D${d.n} top band is ${top} but max is ${d.max}`)
      // Bands must not overlap.
      const sorted = [...d.scoring.bands].sort((a, b) => a.min - b.min)
      for (let k = 1; k < sorted.length; k++)
        if (sorted[k].min <= sorted[k - 1].max) fail(`D${d.n} bands overlap: ${sorted[k - 1].label} / ${sorted[k].label}`)
    }
  })

  // NOT asserted: that the maxima sum to 100. The coaching rubric's do not (they sum to
  // 105) and that is a fact about the client's document, recorded in `discrepancies` and
  // surfaced in the report rather than silently corrected. What IS asserted is that the
  // compiled numbers are internally consistent with each other.
  const sum = r.dimensions.reduce((a, d) => a + d.max, 0)
  if (sum !== r.activeMaxRaw) fail(`activeMaxRaw is ${r.activeMaxRaw} but maxima sum to ${sum}`)
  if (sum <= 0) fail('dimension maxima sum to zero')

  if (!r.caps.length) fail('no caps parsed')
  r.caps.forEach((c) => {
    if ('dimension' in c.effect) {
      const targetDimension = c.effect.dimension
      const d = r.dimensions.find((x) => x.n === targetDimension)
      if (!d) fail(`cap "${c.id}" targets D${targetDimension}, which does not exist`)
      else if (c.effect.value > d.max) fail(`cap "${c.id}" caps D${d.n} at ${c.effect.value}, above its max ${d.max}`)
    }
  })

  if (r.bands.length < 4) fail(`only ${r.bands.length} bands parsed`)
  const byMin = [...r.bands].sort((a, b) => b.min - a.min)
  if (byMin[0].max !== 100) fail(`top band ends at ${byMin[0].max}, not 100`)
  for (let i = 1; i < byMin.length; i++) {
    const gap = byMin[i - 1].min - byMin[i].max
    if (gap > 1.01) fail(`gap between bands ${byMin[i].name} and ${byMin[i - 1].name}`)
  }

  const optional = r.dimensions.filter((d) => d.optional)
  optional.forEach((d) => {
    if (!d.optional!.detectionCriteria.length) fail(`D${d.n} is optional but has no detection criteria`)
  })

  if (!r.principles.length) fail('no scoring principles parsed')
}

// ── run ───────────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true })

const specs: [('coaching' | 'kickoff'), string][] = [
  ['coaching', 'coaching-call-rubric.md'],
  ['kickoff', 'kickoff-call-rubric.md'],
]

for (const [id, file] of specs) {
  const compiled = parseRubric(id, file)
  assertSound(compiled)
  writeFileSync(join(OUT, `${id}.json`), JSON.stringify(compiled, null, 2))

  const optional = compiled.dimensions.filter((d) => d.optional).map((d) => `D${d.n}`)
  const modes = new Set(compiled.dimensions.map((d) => d.scoring.mode))
  console.log(
    `✓ ${id.padEnd(8)} ${compiled.dimensions.length} dims · ` +
      `${compiled.activeMaxRaw} raw pts · ` +
      `${compiled.caps.length} caps · ${compiled.bands.length} bands · ` +
      `scoring: ${[...modes].join('+')} · ` +
      `optional: ${optional.length ? optional.join(',') : 'none'} · ` +
      `hash ${compiled.sourceHash}`,
  )
  for (const d of compiled.discrepancies) console.log(`  ⚠ ${d.what}: stated ${d.stated}, ${d.computed}`)
}
