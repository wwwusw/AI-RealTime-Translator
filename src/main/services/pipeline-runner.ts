import type { AsrProvider, TranslationProvider } from '../../shared/providers'
import type { PipelineEvent, PlannedChunk } from '../../shared/pipeline'
import {
  applySubtitleRevision,
  createSubtitle,
  freezeExpiredDrafts,
  type SubtitleLine
} from '../../shared/subtitles'

type RunPipelineOptions = {
  chunks: PlannedChunk[]
  asrProvider: AsrProvider
  translationProvider: TranslationProvider
  emitEvent: (event: PipelineEvent) => void
  revisionWindowSize?: number
}

export const runPipeline = async ({
  chunks,
  asrProvider,
  translationProvider,
  emitEvent,
  revisionWindowSize = 2
}: RunPipelineOptions): Promise<SubtitleLine[]> => {
  let subtitles: SubtitleLine[] = []

  for (const chunk of chunks) {
    const english = await asrProvider.transcribeChunk(chunk)
    const [chinese] = await translationProvider.translateBatch([english])

    const subtitle = createSubtitle({
      id: `chunk-${chunk.index}`,
      english,
      chinese
    })

    subtitles = [...subtitles, subtitle]
    emitEvent({
      type: 'subtitle-added',
      chunk,
      subtitle
    })

    const revisionWindow = subtitles.slice(-revisionWindowSize)
    const revisedChineseLines = await translationProvider.reviseBatch(
      revisionWindow.map((line) => line.english)
    )

    subtitles = applySubtitleRevision(
      subtitles,
      revisionWindow.map((line, index) => ({
        id: line.id,
        chinese: revisedChineseLines[index] ?? line.chinese
      }))
    )
    subtitles = freezeExpiredDrafts(subtitles, revisionWindowSize)

    for (const revisedSubtitle of subtitles.slice(-revisionWindow.length)) {
      emitEvent({
        type: 'subtitle-revised',
        chunk,
        subtitle: revisedSubtitle
      })
    }
  }

  emitEvent({
    type: 'pipeline-completed',
    subtitles
  })

  return subtitles
}
