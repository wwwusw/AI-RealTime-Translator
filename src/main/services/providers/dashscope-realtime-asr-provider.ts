import { readFile } from 'node:fs/promises'
import WebSocket from 'ws'
import type { RawData } from 'ws'
import type { AsrProvider } from '../../../shared/providers'

type DashScopeRealtimeAsrProviderOptions = {
  baseUrl: string
  apiKey: string
  model: string
}

const PCM_APPEND_CHUNK_BYTES = 3_200
const WAV_HEADER_MIN_BYTES = 44

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

const extractMono16kPcmData = (buffer: Buffer): Buffer => {
  if (
    buffer.length < WAV_HEADER_MIN_BYTES ||
    readChunkAscii(buffer, 0, 4) !== 'RIFF' ||
    readChunkAscii(buffer, 8, 4) !== 'WAVE'
  ) {
    throw new Error('DashScope realtime ASR expects mono 16k WAV input')
  }

  const dataChunkOffset = findWavChunkOffset(buffer, 'data')
  if (dataChunkOffset === -1) {
    throw new Error('DashScope realtime ASR expects mono 16k WAV input')
  }

  const dataSize = buffer.readUInt32LE(dataChunkOffset + 4)
  const dataStart = dataChunkOffset + 8
  return buffer.subarray(dataStart, dataStart + dataSize)
}

const createAbortError = (): Error => {
  const error = new Error('The realtime ASR request was aborted.')
  error.name = 'AbortError'
  return error
}

const buildRealtimeUrl = (baseUrl: string, model: string): string => {
  const url = new URL(baseUrl)
  url.searchParams.set('model', model)
  return url.toString()
}

const parseRealtimeMessage = (payload: RawData): Record<string, unknown> => {
  const binaryPayload = Array.isArray(payload) ? Buffer.concat(payload) : Buffer.from(payload)
  const text = typeof payload === 'string' ? payload : binaryPayload.toString('utf8')

  try {
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch (error) {
    throw new Error(
      `DashScope realtime ASR returned invalid JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`
    )
  }
}

const getEventText = (message: Record<string, unknown>): string => {
  const text =
    typeof message.text === 'string'
      ? message.text
      : typeof message.transcript === 'string'
        ? message.transcript
        : ''

  return text.trim()
}

export const createDashScopeRealtimeAsrProvider = ({
  baseUrl,
  apiKey,
  model
}: DashScopeRealtimeAsrProviderOptions): AsrProvider => ({
  transcribeChunk: async ({ filePath }, signal) => {
    const wavContents = await readFile(filePath)
    const pcmData = extractMono16kPcmData(wavContents)
    const websocketUrl = buildRealtimeUrl(baseUrl, model)

    return await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(websocketUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      })

      let settled = false
      let latestTranscript = ''
      let audioCommitted = false

      const cleanup = () => {
        socket.removeAllListeners()
        signal?.removeEventListener?.('abort', handleAbort)
      }

      const settle = (callback: () => void) => {
        if (settled) {
          return
        }

        settled = true
        cleanup()
        callback()
      }

      const rejectWith = (error: Error) => {
        settle(() => reject(error))
      }

      const handleAbort = () => {
        socket.close()
        rejectWith(createAbortError())
      }

      const sendAudio = () => {
        if (audioCommitted) {
          return
        }

        audioCommitted = true

        for (let offset = 0; offset < pcmData.length; offset += PCM_APPEND_CHUNK_BYTES) {
          const audioChunk = pcmData.subarray(offset, offset + PCM_APPEND_CHUNK_BYTES)
          socket.send(
            JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: audioChunk.toString('base64')
            })
          )
        }

        socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
      }

      if (signal?.aborted) {
        handleAbort()
        return
      }

      signal?.addEventListener?.('abort', handleAbort, { once: true })

      socket.on('open', () => {
        socket.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              input_audio_format: 'pcm',
              sample_rate: 16_000,
              input_audio_transcription: {},
              turn_detection: null
            }
          })
        )
      })

      socket.on('message', (payload) => {
        try {
          const message = parseRealtimeMessage(payload)
          const messageType = typeof message.type === 'string' ? message.type : ''

          if (messageType === 'session.updated') {
            sendAudio()
            return
          }

          if (
            messageType === 'conversation.item.input_audio_transcription.text' ||
            messageType === 'conversation.item.input_audio_transcription.completed'
          ) {
            const nextTranscript = getEventText(message)
            if (nextTranscript.length > 0) {
              latestTranscript = nextTranscript
            }

            if (messageType === 'conversation.item.input_audio_transcription.completed') {
              socket.send(JSON.stringify({ type: 'session.finish' }))
            }

            return
          }

          if (messageType === 'session.finished') {
            if (latestTranscript.length === 0) {
              rejectWith(new Error('DashScope realtime ASR finished without a transcript'))
              return
            }

            settle(() => resolve(latestTranscript))
            return
          }

          if (messageType === 'error') {
            const errorPayload =
              typeof message.error === 'object' && message.error !== null
                ? (message.error as Record<string, unknown>)
                : {}
            const errorMessage =
              typeof errorPayload.message === 'string'
                ? errorPayload.message
                : 'unknown realtime error'

            rejectWith(new Error(`DashScope realtime ASR request failed: ${errorMessage}`))
          }
        } catch (error) {
          rejectWith(error instanceof Error ? error : new Error('unknown realtime parse error'))
        }
      })

      socket.on('error', (error) => {
        const message = error instanceof Error ? error.message : 'unknown realtime error'
        rejectWith(new Error(`DashScope realtime ASR request failed: ${message}`))
      })

      socket.on('close', () => {
        if (settled) {
          return
        }

        if (latestTranscript.length > 0) {
          settle(() => resolve(latestTranscript))
          return
        }

        rejectWith(new Error('DashScope realtime ASR connection closed before completion'))
      })
    })
  }
})
