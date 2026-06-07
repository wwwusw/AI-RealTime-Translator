import { describe, expect, it } from 'vitest'
import type { TimelineSubtitleBlock } from '../../src/renderer/src/state/useAppStore'
import {
  composeCaptionText,
  mergeCaptionBlocks
} from '../../src/renderer/src/features/subtitles/compose-caption-text'

const createBlock = (
  index: number,
  liveTranslation: string,
  refinedTranslation = ''
): TimelineSubtitleBlock => ({
  id: `block-${index}`,
  index,
  startMs: index * 2000,
  endMs: (index + 1) * 2000,
  sourceTranscript: `source ${index}`,
  liveTranslation,
  refinedTranslation,
  status: refinedTranslation ? 'refined' : 'live',
  updatedAt: index
})

describe('composeCaptionText', () => {
  it('joins translated blocks without exposing block boundaries', () => {
    expect(
      composeCaptionText([
        createBlock(0, 'First sentence.'),
        createBlock(1, 'Second sentence.')
      ])
    ).toBe('First sentence.Second sentence.')
  })

  it('prefers refined text and ignores empty translations', () => {
    expect(
      composeCaptionText([
        createBlock(0, 'live text', 'refined text'),
        createBlock(1, '   '),
        createBlock(2, 'next text')
      ])
    ).toBe('refined textnext text')
  })

  it('keeps only the final 50 Unicode code points', () => {
    const text = `${'o'.repeat(10)}${'n'.repeat(50)}`
    expect(composeCaptionText([createBlock(0, text)])).toBe('n'.repeat(50))
  })

  it('does not split surrogate-pair characters', () => {
    const text = `${'x'.repeat(5)}${'😀'.repeat(50)}`
    const result = composeCaptionText([createBlock(0, text)])

    expect(Array.from(result)).toHaveLength(50)
    expect(result).toBe('😀'.repeat(50))
  })
})

describe('mergeCaptionBlocks', () => {
  it('retains an older short block when the total is still below 50 characters', () => {
    const existing = Array.from({ length: 6 }, (_, index) =>
      createBlock(index, String(index).repeat(5))
    )
    const incoming = Array.from({ length: 6 }, (_, index) =>
      createBlock(index + 1, String(index + 1).repeat(5))
    )

    expect(mergeCaptionBlocks(existing, incoming).map((block) => block.id)).toEqual([
      'block-0',
      'block-1',
      'block-2',
      'block-3',
      'block-4',
      'block-5',
      'block-6'
    ])
  })

  it('drops complete old blocks once newer text supplies at least 50 characters', () => {
    const existing = [
      createBlock(0, 'old'),
      createBlock(1, 'a'.repeat(25)),
      createBlock(2, 'b'.repeat(25))
    ]
    const incoming = [
      createBlock(1, 'a'.repeat(25)),
      createBlock(2, 'b'.repeat(25))
    ]

    expect(mergeCaptionBlocks(existing, incoming).map((block) => block.id)).toEqual([
      'block-1',
      'block-2'
    ])
  })

  it('does not retain obsolete empty blocks', () => {
    expect(
      mergeCaptionBlocks(
        [createBlock(0, ''), createBlock(1, 'visible')],
        [createBlock(1, 'visible')]
      ).map((block) => block.id)
    ).toEqual(['block-1'])
  })
})
