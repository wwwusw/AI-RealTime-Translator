import type {
  AsrProvider,
  TranslationProvider,
  TranslationProviderResult,
  TranslationProviderSubtitle
} from '../../shared/providers'
import type { PipelineEvent, PlannedChunk } from '../../shared/pipeline'
import {
  applySubtitleRevision,
  createSubtitle,
  freezeExpiredDrafts,
  type SubtitleLine
} from '../../shared/subtitles'

type RunPipelineOptions = {
  asrProvider: AsrProvider
  translationProvider: TranslationProvider
  emitEvent: (event: PipelineEvent) => void
  revisionWindowSize?: number
  signal?: AbortSignal
}

type ProcessChunkOptions = {
  chunk: PlannedChunk
}

const getChunkFilePath = (chunk: PlannedChunk): string => {
  if (!chunk.filePath) {
    throw new Error(`chunk ${chunk.index} is missing filePath`)
  }

  return chunk.filePath
}

const mapValidatedResults = (
  operationName: 'translateBatch' | 'reviseBatch',
  subtitles: TranslationProviderSubtitle[],
  results: TranslationProviderResult[]
): Map<string, string> => {
  const requestedIds = new Set(subtitles.map((subtitle) => subtitle.id))

  if (results.length !== subtitles.length) {
    throw new Error(`${operationName} returned mismatched subtitle ids`)
  }

  const chineseById = new Map<string, string>()

  for (const result of results) {
    if (!requestedIds.has(result.id) || chineseById.has(result.id)) {
      throw new Error(`${operationName} returned mismatched subtitle ids`)
    }

    chineseById.set(result.id, result.chinese)
  }

  if (chineseById.size !== subtitles.length) {
    throw new Error(`${operationName} returned mismatched subtitle ids`)
  }

  return chineseById
}

export const createPipelineProcessor = ({
  asrProvider,
  translationProvider,
  emitEvent,
  revisionWindowSize = 2,
  signal
}: RunPipelineOptions) => {
  let subtitles: SubtitleLine[] = []

  const processChunk = async ({ chunk }: ProcessChunkOptions): Promise<SubtitleLine> => {
    signal?.throwIfAborted?.()
    const subtitleId = `chunk-${chunk.index}`
    emitEvent({
      type: 'subtitle-pending',
      chunk,
      subtitle: createSubtitle({
        id: subtitleId,
        english: '',
        chinese: ''
      })
    })

    const english = await asrProvider.transcribeChunk({
      chunkIndex: chunk.index,
      filePath: getChunkFilePath(chunk)
    }, signal)
    signal?.throwIfAborted?.()

    if (english.trim().length === 0) {
      return createSubtitle({
        id: subtitleId,
        english: '',
        chinese: ''
      })
    }

    const draftSubtitle: TranslationProviderSubtitle = {
      id: subtitleId,
      english,
      chinese: ''
    }
    const translatedResults = await translationProvider.translateBatch(
      [draftSubtitle],
      signal
    )
    signal?.throwIfAborted?.()
    const translatedChineseById = mapValidatedResults(
      'translateBatch',
      [draftSubtitle],
      translatedResults
    )

    const subtitle = createSubtitle({
      id: subtitleId,
      english,
      chinese: translatedChineseById.get(subtitleId) ?? ''
    })

    subtitles = [...subtitles, subtitle]
    emitEvent({
      type: 'subtitle-added',
      chunk,
      subtitle
    })

    const revisionWindowSubtitles: TranslationProviderSubtitle[] = subtitles
      .slice(-revisionWindowSize)
      .map((line) => ({
        id: line.id,
        english: line.english,
        chinese: line.chinese
      }))
    const revisedResults = await translationProvider.reviseBatch(
      revisionWindowSubtitles,
      signal
    )
    signal?.throwIfAborted?.()
    const revisedChineseById = mapValidatedResults(
      'reviseBatch',
      revisionWindowSubtitles,
      revisedResults
    )

    subtitles = applySubtitleRevision(
      subtitles,
      revisionWindowSubtitles.map((line) => ({
        id: line.id,
        chinese: revisedChineseById.get(line.id) ?? ''
      }))
    )
    subtitles = freezeExpiredDrafts(subtitles, revisionWindowSize)

    for (const revisedSubtitle of subtitles.slice(-revisionWindowSubtitles.length)) {
      emitEvent({
        type: 'subtitle-revised',
        subtitle: revisedSubtitle
      })
    }

    return subtitle
  }

  const complete = (): SubtitleLine[] => {
    emitEvent({
      type: 'pipeline-completed',
      subtitles
    })

    return subtitles
  }

  return {
    processChunk,
    complete,
    getSubtitles: () => subtitles
  }
}

export const runPipeline = async ({
  chunks,
  ...options
}: RunPipelineOptions & { chunks: PlannedChunk[] }): Promise<SubtitleLine[]> => {
  const processor = createPipelineProcessor(options)

  for (const chunk of chunks) {
    await processor.processChunk({ chunk })
  }

  return processor.complete()
}
