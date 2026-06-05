import type { SubtitleLine } from './subtitles'

export const pipelineTaskChannels = {
  pickMediaFile: 'pipeline:pick-media-file'
} as const

export type ImportedMediaFile = {
  filePath: string
}

export type PipelineTasksBridge = {
  pickMediaFile: () => Promise<ImportedMediaFile | null>
}

export type PlannedChunk = {
  index: number
  startMs: number
  endMs: number
  filePath?: string
}

export type ChunkPlanningInput = {
  totalDurationMs: number
  chunkDurationMs: number
  chunkOverlapMs: number
}

export type PipelineSubtitleAddedEvent = {
  type: 'subtitle-added'
  chunk: PlannedChunk
  subtitle: SubtitleLine
}

export type PipelineSubtitleRevisedEvent = {
  type: 'subtitle-revised'
  chunk: PlannedChunk
  subtitle: SubtitleLine
}

export type PipelineCompletedEvent = {
  type: 'pipeline-completed'
  subtitles: SubtitleLine[]
}

export type PipelineEvent =
  | PipelineSubtitleAddedEvent
  | PipelineSubtitleRevisedEvent
  | PipelineCompletedEvent
