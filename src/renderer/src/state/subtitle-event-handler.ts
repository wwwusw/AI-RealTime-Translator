import type { PipelineEvent, SubtitleBlock } from '../../../shared/pipeline'
import { mergeCaptionBlocksKeepAll } from '../features/subtitles/compose-caption-text'

const trimBlockWindow = (blocks: SubtitleBlock[]): SubtitleBlock[] =>
  blocks.slice(-200)

const upsertBlock = (
  blocks: SubtitleBlock[],
  nextBlock: SubtitleBlock
): SubtitleBlock[] => {
  const existingIndex = blocks.findIndex((block) => block.id === nextBlock.id)

  if (existingIndex === -1) {
    return trimBlockWindow([...blocks, nextBlock])
  }

  return trimBlockWindow(
    blocks.map((block, index) => (index === existingIndex ? nextBlock : block))
  )
}

export const applyPipelineEventToBlocks = (
  blocks: SubtitleBlock[],
  event: PipelineEvent
): SubtitleBlock[] => {
  switch (event.type) {
    case 'subtitle-blocks-updated':
      return mergeCaptionBlocksKeepAll(blocks, event.blocks)
    case 'subtitle-pending':
    case 'subtitle-added':
      return upsertBlock(blocks, {
        id: event.subtitle.id,
        index: event.chunk.index,
        startMs: event.chunk.startMs,
        endMs: event.chunk.endMs,
        sourceTranscript: event.subtitle.english,
        liveTranslation: event.subtitle.chinese,
        refinedTranslation:
          event.subtitle.status === 'final' ? event.subtitle.chinese : '',
        status:
          event.subtitle.status === 'final' ? 'refined' : 'pending_refine',
        updatedAt: event.subtitle.updatedAt
      })
    case 'subtitle-revised':
      return trimBlockWindow(
        blocks.map((block) =>
          block.id === event.subtitle.id
            ? {
                ...block,
                sourceTranscript: event.subtitle.english,
                liveTranslation: event.subtitle.chinese,
                refinedTranslation: event.subtitle.chinese,
                status: 'refined' as const,
                updatedAt: event.subtitle.updatedAt
              }
            : block
        )
      )
    case 'pipeline-completed':
    default:
      return blocks
  }
}
