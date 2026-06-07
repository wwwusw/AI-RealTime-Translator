import { readFile } from 'node:fs/promises'
import type { PipelineEvent, SystemAudioChunkPayload } from '../../shared/pipeline'
import type {
  LiveTranslateProvider,
  RefinementProvider
} from '../../shared/providers'
import {
  createSystemAudioPipelineSession,
  type SystemAudioPipelineSession
} from './system-audio-session'

type FilePipelineSessionOptions = {
  wavFilePath: string
  liveTranslateProvider: LiveTranslateProvider
  refinementProvider: RefinementProvider
  emitEvent: (event: PipelineEvent) => void
  blockDurationMs: number
  sourceLanguage?: string
  targetLanguage: string
  speedMultiplier?: number
  signal?: AbortSignal
}

const WAV_HEADER_MIN_BYTES = 44
const PCM_APPEND_CHUNK_SAMPLES = 4_000
const BYTES_PER_SAMPLE = 2

const readChunkAscii = (buffer: Buffer, offset: number, length: number): string =>
  buffer.toString('ascii', offset, offset + length)

const findWavChunkOffset = (buffer: Buffer, chunkId: string): number => {
  for (let offset = 12; offset <= buffer.length - 8; ) {
    const currentChunkId = readChunkAscii(buffer, offset, 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)

    if (currentChunkId === chunkId) {
      return offset
    }

    offset += 8 + chunkSize + (chunkSize % 2)
  }

  return -1
}

export const extractMono16kPcmData = (buffer: Buffer): Buffer => {
  if (
    buffer.length < WAV_HEADER_MIN_BYTES ||
    readChunkAscii(buffer, 0, 4) !== 'RIFF' ||
    readChunkAscii(buffer, 8, 4) !== 'WAVE'
  ) {
    throw new Error('File pipeline expects a mono 16k WAV input')
  }

  const dataChunkOffset = findWavChunkOffset(buffer, 'data')
  if (dataChunkOffset === -1) {
    throw new Error('File pipeline expects a mono 16k WAV input')
  }

  const dataSize = buffer.readUInt32LE(dataChunkOffset + 4)
  const dataStart = dataChunkOffset + 8
  return buffer.subarray(dataStart, dataStart + dataSize)
}

const buildPcmChunks = (pcmData: Buffer): SystemAudioChunkPayload[] => {
  const chunkByteLength = PCM_APPEND_CHUNK_SAMPLES * BYTES_PER_SAMPLE
  const chunks: SystemAudioChunkPayload[] = []

  for (let offset = 0; offset < pcmData.length; offset += chunkByteLength) {
    const chunkBytes = pcmData.subarray(offset, offset + chunkByteLength)
    chunks.push({
      bytes: new Uint8Array(chunkBytes),
      durationMs: Math.round((chunkBytes.length / BYTES_PER_SAMPLE / 16_000) * 1000),
      mimeType: 'audio/pcm'
    })
  }

  return chunks
}

export type FilePipelineSessionHandle = {
  run: () => Promise<void>
  getSession: () => SystemAudioPipelineSession
}

export const createFilePipelineSession = async ({
  wavFilePath,
  liveTranslateProvider,
  refinementProvider,
  emitEvent,
  blockDurationMs,
  sourceLanguage,
  targetLanguage,
  speedMultiplier = 1,
  signal
}: FilePipelineSessionOptions): Promise<FilePipelineSessionHandle> => {
  const session = await createSystemAudioPipelineSession({
    liveTranslateProvider,
    refinementProvider,
    emitEvent,
    blockDurationMs,
    sourceLanguage,
    targetLanguage,
    signal
  })

  const run = async () => {
    const wavBuffer = await readFile(wavFilePath)
    const pcmData = extractMono16kPcmData(wavBuffer)
    const totalDurationSec = (pcmData.length / (16_000 * 2)).toFixed(1)

    console.log(
      `[file-pipeline] Normalized audio loaded: ${pcmData.length} bytes PCM, ~${totalDurationSec}s`
    )

    if (signal?.aborted) {
      return
    }

    const pcmChunks = buildPcmChunks(pcmData)
    console.log(`[file-pipeline] Sending ${pcmChunks.length} PCM chunks to Live Translate provider`)

    const delayMs = Math.max(1, Math.round(pcmChunks[0]?.durationMs ?? 250) / speedMultiplier)
    console.log(`[file-pipeline] Streaming at ${speedMultiplier}x real-time, ${delayMs}ms per chunk`)

    for (let i = 0; i < pcmChunks.length; i += 1) {
      signal?.throwIfAborted?.()
      await session.appendChunk(pcmChunks[i]!)

      if ((i + 1) % 20 === 0 || i === pcmChunks.length - 1) {
        console.log(`[file-pipeline] Sent ${i + 1}/${pcmChunks.length} PCM chunks`)
      }

      if (i < pcmChunks.length - 1) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delayMs)
          signal?.addEventListener?.('abort', () => {
            clearTimeout(timer)
            resolve()
          }, { once: true })
        })
      }
    }

    console.log('[file-pipeline] All PCM chunks sent, completing session...')
    signal?.throwIfAborted?.()
    await session.complete()
    console.log('[file-pipeline] Session completed')
  }

  return {
    run,
    getSession: () => session
  }
}
