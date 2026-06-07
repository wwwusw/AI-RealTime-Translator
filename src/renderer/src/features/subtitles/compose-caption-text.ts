import type { TimelineSubtitleBlock } from '../../state/useAppStore'

export const DEFAULT_CAPTION_CHARACTER_LIMIT = 50

export const getBlockTranslation = (block: TimelineSubtitleBlock): string =>
  block.refinedTranslation.trim() || block.liveTranslation.trim()

export const composeCaptionText = (
  blocks: TimelineSubtitleBlock[],
  characterLimit = DEFAULT_CAPTION_CHARACTER_LIMIT
): string => {
  const joinedText = blocks
    .map(getBlockTranslation)
    .filter(Boolean)
    .join('')

  return Array.from(joinedText)
    .slice(-Math.max(0, characterLimit))
    .join('')
}

export const mergeCaptionBlocks = (
  existingBlocks: TimelineSubtitleBlock[],
  incomingBlocks: TimelineSubtitleBlock[],
  characterLimit = DEFAULT_CAPTION_CHARACTER_LIMIT
): TimelineSubtitleBlock[] => {
  const incomingIds = new Set(incomingBlocks.map((block) => block.id))
  const blockById = new Map(
    existingBlocks
      .filter((block) => incomingIds.has(block.id) || getBlockTranslation(block))
      .map((block) => [block.id, block])
  )

  for (const block of incomingBlocks) {
    blockById.set(block.id, block)
  }

  const merged = [...blockById.values()].sort((left, right) => left.index - right.index)
  let firstRetainedIndex = 0

  while (firstRetainedIndex < merged.length - 1) {
    const remainingText = merged
      .slice(firstRetainedIndex + 1)
      .map(getBlockTranslation)
      .join('')

    if (Array.from(remainingText).length < characterLimit) {
      break
    }

    firstRetainedIndex += 1
  }

  return merged.slice(firstRetainedIndex)
}
