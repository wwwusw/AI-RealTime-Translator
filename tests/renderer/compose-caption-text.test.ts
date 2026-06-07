import { describe, expect, it } from 'vitest'
import type { TimelineSubtitleBlock } from '../../src/renderer/src/state/useAppStore'
import {
  composeCaptionLines,
  getBlockTranslation,
  mergeCaptionBlocksKeepAll,
  PAUSE_GAP_THRESHOLD_MS
} from '../../src/renderer/src/features/subtitles/compose-caption-text'

const createBlock = (
  index: number,
  liveTranslation: string,
  refinedTranslation = '',
  startMs = index * 2000,
  endMs = (index + 1) * 2000
): TimelineSubtitleBlock => ({
  id: `block-${index}`,
  index,
  startMs,
  endMs,
  sourceTranscript: `source ${index}`,
  liveTranslation,
  refinedTranslation,
  status: refinedTranslation ? 'refined' : 'live',
  updatedAt: index
})

// ---------------------------------------------------------------------------
// composeCaptionLines
// ---------------------------------------------------------------------------
describe('composeCaptionLines', () => {
  it('returns one line per content block', () => {
    const lines = composeCaptionLines([
      createBlock(0, 'First sentence.'),
      createBlock(1, 'Second sentence.')
    ])

    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ text: 'First sentence.', isPause: false })
    expect(lines[1]).toMatchObject({ text: 'Second sentence.', isPause: false })
  })

  it('prefers refinedTranslation over liveTranslation', () => {
    const lines = composeCaptionLines([
      createBlock(0, 'live text', 'refined text')
    ])

    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('refined text')
  })

  it('skips blocks with empty translations', () => {
    const lines = composeCaptionLines([
      createBlock(0, '   '),
      createBlock(1, 'visible text'),
      createBlock(2, '')
    ])

    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('visible text')
  })

  it('inserts a pause line when the gap between content blocks exceeds the threshold', () => {
    const blocks = [
      createBlock(0, 'first', '', 0, 2000),
      // 5-second gap → pause inserted
      createBlock(1, 'second', '', 7000, 9000)
    ]

    const lines = composeCaptionLines(blocks)
    expect(lines).toHaveLength(3) // first, pause, second
    expect(lines[0]).toMatchObject({ text: 'first', isPause: false })
    expect(lines[1]).toMatchObject({ isPause: true })
    expect(lines[2]).toMatchObject({ text: 'second', isPause: false })
  })

  it('does not insert a pause when the gap is below the threshold', () => {
    const blocks = [
      createBlock(0, 'first', '', 0, 2000),
      // 1-second gap → no pause
      createBlock(1, 'second', '', 3000, 5000)
    ]

    const lines = composeCaptionLines(blocks)
    expect(lines).toHaveLength(2)
    expect(lines.every((l) => !l.isPause)).toBe(true)
  })

  it('skips empty blocks when detecting pause gaps', () => {
    const blocks = [
      createBlock(0, 'first', '', 0, 2000),
      createBlock(1, ''), // empty, skipped
      // Gap measured from block-0.endMs (2000) to block-2.startMs (7000) = 5s
      createBlock(2, 'third', '', 7000, 9000)
    ]

    const lines = composeCaptionLines(blocks)
    expect(lines).toHaveLength(3) // first, pause, third
    expect(lines[0]).toMatchObject({ text: 'first' })
    expect(lines[1]).toMatchObject({ isPause: true })
    expect(lines[2]).toMatchObject({ text: 'third' })
  })

  it('returns empty array when no blocks have content', () => {
    expect(composeCaptionLines([])).toEqual([])
    expect(composeCaptionLines([createBlock(0, ''), createBlock(1, '   ')])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getBlockTranslation
// ---------------------------------------------------------------------------
describe('getBlockTranslation', () => {
  it('returns trimmed refinedTranslation when available', () => {
    expect(getBlockTranslation(createBlock(0, 'live', '  refined  '))).toBe('refined')
  })

  it('falls back to liveTranslation when refined is empty', () => {
    expect(getBlockTranslation(createBlock(0, '  live  ', ''))).toBe('live')
  })

  it('returns empty string when both are empty', () => {
    expect(getBlockTranslation(createBlock(0, '', ''))).toBe('')
  })
})

// ---------------------------------------------------------------------------
// mergeCaptionBlocksKeepAll
// ---------------------------------------------------------------------------
describe('mergeCaptionBlocksKeepAll', () => {
  it('merges incoming blocks into existing, sorted by index', () => {
    const existing = [
      createBlock(0, 'zero'),
      createBlock(1, 'one')
    ]
    const incoming = [
      createBlock(2, 'two'),
      createBlock(1, 'one-updated')
    ]

    const merged = mergeCaptionBlocksKeepAll(existing, incoming)
    expect(merged.map((b) => b.id)).toEqual(['block-0', 'block-1', 'block-2'])
    expect(merged[1].liveTranslation).toBe('one-updated')
  })

  it('keeps all blocks regardless of character count', () => {
    const existing = Array.from({ length: 20 }, (_, i) =>
      createBlock(i, 'x'.repeat(100))
    )
    const incoming = [createBlock(20, 'new')]

    const merged = mergeCaptionBlocksKeepAll(existing, incoming)
    expect(merged).toHaveLength(21)
  })

  it('preserves empty blocks from existing list', () => {
    const existing = [createBlock(0, ''), createBlock(1, 'visible')]
    const incoming = [createBlock(1, 'visible-updated')]

    const merged = mergeCaptionBlocksKeepAll(existing, incoming)
    expect(merged).toHaveLength(2)
    expect(merged.map((b) => b.id)).toEqual(['block-0', 'block-1'])
  })
})
