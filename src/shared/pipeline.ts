export const pipelineTaskChannels = {
  pickMediaFile: 'pipeline:pick-media-file'
} as const

export type ImportedMediaFile = {
  filePath: string
}

export type PlannedChunk = {
  startMs: number
  endMs: number
}

export type ChunkPlanningInput = {
  totalDurationMs: number
  chunkDurationMs: number
  chunkOverlapMs: number
}
