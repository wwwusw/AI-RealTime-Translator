import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import type {
  PipelineEvent,
  PlannedChunk,
  SystemAudioChunkPayload
} from '../../shared/pipeline'
import type { AsrProvider, TranslationProvider } from '../../shared/providers'
import { createPipelineProcessor } from './pipeline-runner'
import { normalizeAudioToMono16kWav } from './ffmpeg-service'

type SystemAudioSessionOptions = {
  asrProvider: AsrProvider
  translationProvider: TranslationProvider
  emitEvent: (event: PipelineEvent) => void
  revisionWindowSize?: number
  signal?: AbortSignal
}

export type SystemAudioPipelineSession = {
  appendChunk: (chunk: SystemAudioChunkPayload) => Promise<void>
  complete: () => Promise<void>
  abort: () => Promise<void>
}

const getExtensionFromMimeType = (mimeType: string): string => {
  if (mimeType.includes('webm')) {
    return '.webm'
  }

  if (mimeType.includes('wav')) {
    return '.wav'
  }

  const fallbackExtension = extname(mimeType)
  return fallbackExtension.length > 0 ? fallbackExtension : '.bin'
}

const isReadyMonoWavPayload = (mimeType: string): boolean => mimeType.includes('audio/wav')

export const createSystemAudioPipelineSession = async ({
  asrProvider,
  translationProvider,
  emitEvent,
  revisionWindowSize = 2,
  signal
}: SystemAudioSessionOptions): Promise<SystemAudioPipelineSession> => {
  const workingDirectory = await mkdtemp(join(tmpdir(), 'ai-realtime-system-audio-'))
  const processor = createPipelineProcessor({
    asrProvider,
    translationProvider,
    emitEvent,
    revisionWindowSize,
    signal
  })

  let nextChunkIndex = 0
  let nextStartMs = 0
  let queue = Promise.resolve()
  let cleanedUp = false

  const cleanup = async () => {
    if (cleanedUp) {
      return
    }

    cleanedUp = true
    await rm(workingDirectory, { recursive: true, force: true })
  }

  const queueChunk = async (payload: SystemAudioChunkPayload): Promise<void> => {
    signal?.throwIfAborted?.()

    const chunkIndex = nextChunkIndex
    nextChunkIndex += 1

    const durationMs = Math.max(1, Math.round(payload.durationMs))
    const startMs = nextStartMs
    const endMs = startMs + durationMs
    nextStartMs = endMs

    const sourceExtension = getExtensionFromMimeType(payload.mimeType)
    const sourcePath = join(workingDirectory, `capture-${chunkIndex}${sourceExtension}`)
    const normalizedPath = join(workingDirectory, `capture-${chunkIndex}.wav`)
    const chunk: PlannedChunk = {
      index: chunkIndex,
      startMs,
      endMs,
      filePath: normalizedPath
    }

    await writeFile(sourcePath, Buffer.from(payload.bytes))

    try {
      if (isReadyMonoWavPayload(payload.mimeType)) {
        await writeFile(normalizedPath, Buffer.from(payload.bytes))
      } else {
        await normalizeAudioToMono16kWav(sourcePath, normalizedPath)
      }

      await processor.processChunk({ chunk })
    } finally {
      await rm(sourcePath, { force: true })
      await rm(normalizedPath, { force: true })
    }
  }

  return {
    appendChunk: async (payload) => {
      queue = queue.then(() => queueChunk(payload))
      await queue
    },
    complete: async () => {
      try {
        await queue
        processor.complete()
      } finally {
        await cleanup()
      }
    },
    abort: async () => {
      try {
        await queue.catch(() => undefined)
      } finally {
        await cleanup()
      }
    }
  }
}
