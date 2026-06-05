import type { SubtitleLine } from './subtitles'

export const pipelineTaskChannels = {
  pickMediaFile: 'pipeline:pick-media-file',
  getTaskStatus: 'pipeline:get-task-status',
  startTask: 'pipeline:start-task',
  pauseTask: 'pipeline:pause-task',
  resetTask: 'pipeline:reset-task'
} as const

export type ImportedMediaFile = {
  filePath: string
}

export type PipelineTaskStage = 'idle' | 'ready' | 'running' | 'paused' | 'completed'

export type PipelineTaskStatus = {
  filePath: string | null
  stage: PipelineTaskStage
  isRunning: boolean
  canStart: boolean
  lastRevisionSummary: string
}

export type PipelineTasksBridge = {
  pickMediaFile: () => Promise<ImportedMediaFile | null>
  getTaskStatus: () => Promise<PipelineTaskStatus>
  startTask: (filePath: string | null) => Promise<PipelineTaskStatus>
  pauseTask: () => Promise<PipelineTaskStatus>
  resetTask: () => Promise<PipelineTaskStatus>
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
