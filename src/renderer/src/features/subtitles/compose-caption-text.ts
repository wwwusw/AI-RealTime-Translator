import type { TimelineSubtitleBlock } from '../../state/useAppStore'

/** Minimum gap (ms) between consecutive blocks to insert a visual pause break. */
export const PAUSE_GAP_THRESHOLD_MS = 2_000

/** A single display line in the scrolling caption surface. */
export type CaptionLine = {
  id: string
  text: string
  isPause: boolean
  blockId?: string
}

export const getBlockTranslation = (block: TimelineSubtitleBlock): string =>
  block.refinedTranslation.trim() || block.liveTranslation.trim()

// ---------------------------------------------------------------------------
// Compose display lines
// ---------------------------------------------------------------------------

const hasPauseGap = (
  prevEndMs: number,
  nextStartMs: number,
  thresholdMs: number
): boolean => nextStartMs - prevEndMs >= thresholdMs

/**
 * Convert subtitle blocks into an ordered list of display lines.
 *
 * - Blocks whose translation is empty are skipped (they contribute no visible
 *   line).
 * - When the time gap between two consecutive *content* blocks exceeds
 *   `pauseThresholdMs`, a blank pause line is inserted to visually separate
 *   utterances.
 */
export const composeCaptionLines = (
  blocks: TimelineSubtitleBlock[],
  pauseThresholdMs: number = PAUSE_GAP_THRESHOLD_MS
): CaptionLine[] => {
  const contentBlocks = blocks.filter((b) => getBlockTranslation(b))
  const lines: CaptionLine[] = []

  for (let i = 0; i < contentBlocks.length; i++) {
    const block = contentBlocks[i]

    if (i > 0) {
      const prev = contentBlocks[i - 1]
      if (hasPauseGap(prev.endMs, block.startMs, pauseThresholdMs)) {
        lines.push({
          id: `pause-${prev.id}-${block.id}`,
          text: '',
          isPause: true
        })
      }
    }

    lines.push({
      id: block.id,
      text: getBlockTranslation(block),
      isPause: false,
      blockId: block.id
    })
  }

  return lines
}

// ---------------------------------------------------------------------------
// Block merging (keep-all — no character-based trimming)
// ---------------------------------------------------------------------------

/**
 * Merge incoming blocks into the existing list.
 *
 * Unlike the old `mergeCaptionBlocks`, this keeps **all** blocks across the
 * session so the user can scroll back through history.  Old blocks are never
 * discarded because of a character limit.
 */
export const mergeCaptionBlocksKeepAll = (
  existingBlocks: TimelineSubtitleBlock[],
  incomingBlocks: TimelineSubtitleBlock[]
): TimelineSubtitleBlock[] => {
  const blockById = new Map<string, TimelineSubtitleBlock>()

  for (const block of existingBlocks) {
    blockById.set(block.id, block)
  }

  for (const block of incomingBlocks) {
    blockById.set(block.id, block)
  }

  return [...blockById.values()].sort((left, right) => left.index - right.index)
}
