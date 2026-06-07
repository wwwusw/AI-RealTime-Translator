import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { PlannedChunk } from '../../shared/pipeline'
import { planChunks } from './chunk-planner'
import {
  extractAudioChunkToMono16kWav,
  normalizeAudioToMono16kWav
} from './ffmpeg-service'

const WAV_HEADER_MIN_BYTES = 44
const PCM_MONO_16K_BYTE_RATE = 16_000 * 2

const readChunkAscii = (buffer: Buffer, offset: number, length: number): string =>
  buffer.toString('ascii', offset, offset + length)

const findChunkOffset = (buffer: Buffer, chunkId: string): number => {
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

export const readNormalizedWavDurationMs = (buffer: Buffer): number => {
  if (
    buffer.length < WAV_HEADER_MIN_BYTES ||
    readChunkAscii(buffer, 0, 4) !== 'RIFF' ||
    readChunkAscii(buffer, 8, 4) !== 'WAVE'
  ) {
    throw new Error('normalized audio is not a supported WAV file')
  }

  const dataChunkOffset = findChunkOffset(buffer, 'data')
  if (dataChunkOffset === -1) {
    throw new Error('normalized audio is not a supported WAV file')
  }

  const byteRate = buffer.readUInt32LE(28)
  const dataSize = buffer.readUInt32LE(dataChunkOffset + 4)

  if (byteRate <= 0) {
    throw new Error('normalized audio is not a supported WAV file')
  }

  return Math.round((dataSize / byteRate) * 1000)
}

export const preparePipelineChunks = async (
  inputFilePath: string,
  {
    chunkDurationMs,
    chunkOverlapMs
  }: {
    chunkDurationMs: number
    chunkOverlapMs: number
  }
): Promise<{
  normalizedFilePath: string
  chunks: PlannedChunk[]
  cleanup: () => Promise<void>
}> => {
  const workingDirectory = await mkdtemp(join(tmpdir(), 'ai-realtime-translator-'))
  const normalizedFilePath = join(workingDirectory, 'normalized.wav')

  const cleanup = async () => {
    await rm(workingDirectory, { recursive: true, force: true })
  }

  try {
    await normalizeAudioToMono16kWav(inputFilePath, normalizedFilePath)

    const normalizedAudio = await readFile(normalizedFilePath)
    const totalDurationMs = readNormalizedWavDurationMs(normalizedAudio)
    const plannedChunks = planChunks({
      totalDurationMs,
      chunkDurationMs,
      chunkOverlapMs
    })

    const chunks = await Promise.all(
      plannedChunks.map(async (chunk) => {
        const chunkFilePath = join(workingDirectory, `chunk-${chunk.index}.wav`)
        await extractAudioChunkToMono16kWav({
          inputFilePath: normalizedFilePath,
          outputFilePath: chunkFilePath,
          startMs: chunk.startMs,
          durationMs: chunk.endMs - chunk.startMs
        })

        return {
          ...chunk,
          filePath: chunkFilePath
        }
      })
    )

    return {
      normalizedFilePath,
      chunks,
      cleanup
    }
  } catch (error) {
    await cleanup()
    throw error
  }
}

export const expectedNormalizedWavByteRate = PCM_MONO_16K_BYTE_RATE

export const prepareNormalizedAudio = async (
  inputFilePath: string
): Promise<{
  normalizedFilePath: string
  cleanup: () => Promise<void>
}> => {
  const workingDirectory = await mkdtemp(join(tmpdir(), 'ai-realtime-translator-'))
  const normalizedFilePath = join(workingDirectory, 'normalized.wav')

  const cleanup = async () => {
    await rm(workingDirectory, { recursive: true, force: true })
  }

  try {
    await normalizeAudioToMono16kWav(inputFilePath, normalizedFilePath)
    return { normalizedFilePath, cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}
