import WebSocket from 'ws'
import type { RawData } from 'ws'
import type {
  LiveTranslateProvider,
  LiveTranslateSession,
  LiveTranslateStreamEvent
} from '../../../shared/providers'

type QwenLiveTranslateRealtimeProviderOptions = {
  baseUrl: string
  apiKey: string
  model: string
}

const buildRealtimeUrl = (baseUrl: string, model: string): string => {
  const url = new URL(baseUrl)
  url.searchParams.set('model', model)
  return url.toString()
}

const createAbortError = (): Error => {
  const error = new Error('The live translation request was aborted.')
  error.name = 'AbortError'
  return error
}

const parseRealtimeMessage = (payload: RawData): Record<string, unknown> => {
  const binaryPayload = Array.isArray(payload) ? Buffer.concat(payload) : Buffer.from(payload)
  const text = typeof payload === 'string' ? payload : binaryPayload.toString('utf8')

  try {
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch (error) {
    throw new Error(
      `Live translation provider returned invalid JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`
    )
  }
}

const getString = (value: unknown): string => (typeof value === 'string' ? value : '')

const computeDeltaText = (previousFullText: string, nextFullText: string): string => {
  if (nextFullText.startsWith(previousFullText)) {
    return nextFullText.slice(previousFullText.length)
  }

  return nextFullText
}

export const createQwenLiveTranslateRealtimeProvider = ({
  baseUrl,
  apiKey,
  model
}: QwenLiveTranslateRealtimeProviderOptions): LiveTranslateProvider => ({
  startSession: async ({
    targetLanguage,
    sourceLanguage,
    signal,
    onEvent
  }): Promise<LiveTranslateSession> => {
    const websocketUrl = buildRealtimeUrl(baseUrl, model)

    return await new Promise<LiveTranslateSession>((resolve, reject) => {
      const socket = new WebSocket(websocketUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      })

      let ready = false
      let settled = false
      let finished = false
      let sessionFinished = false
      let abortRequested = false
      let socketOpen = false
      let fatalError: Error | null = null
      const latestFullTextByKey = new Map<string, string>()

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
        fatalError = error
        settle(() => reject(error))
      }

      const handleAbort = () => {
        abortRequested = true
        socket.close()
        rejectWith(createAbortError())
      }

      const getLatestFullText = (key: string): string => latestFullTextByKey.get(key) ?? ''

      const emitStreamEvent = (
        keyPrefix: 'source' | 'translation',
        itemId: string,
        eventType: LiveTranslateStreamEvent['type'],
        fullText: string
      ) => {
        const mapKey = `${keyPrefix}:${itemId}`
        const previousFullText = getLatestFullText(mapKey)
        const deltaText = computeDeltaText(previousFullText, fullText)
        latestFullTextByKey.set(mapKey, fullText)
        onEvent({
          type: eventType,
          itemId,
          fullText,
          deltaText
        })
      }

      const ensureReady = async () => {
        if (fatalError) {
          throw fatalError
        }

        if (ready) {
          return
        }

        await new Promise<void>((innerResolve, innerReject) => {
          const interval = setInterval(() => {
            if (fatalError) {
              clearInterval(interval)
              innerReject(fatalError)
              return
            }

            if (ready) {
              clearInterval(interval)
              innerResolve()
            }
          }, 10)
        })
      }

      if (signal?.aborted) {
        handleAbort()
        return
      }

      signal?.addEventListener?.('abort', handleAbort, { once: true })

      socket.on('open', () => {
        console.log('[qwen-live-translate] websocket opened')
        socketOpen = true
        socket.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text'],
              sample_rate: 16_000,
              input_audio_format: 'pcm',
              input_audio_transcription: {
                model: 'qwen3-asr-flash-realtime',
                ...(sourceLanguage ? { language: sourceLanguage } : {})
              },
              translation: {
                language: targetLanguage
              }
            }
          })
        )
      })

      socket.on('message', (payload) => {
        try {
          const message = parseRealtimeMessage(payload)
          const messageType = getString(message.type)
          console.log(`[qwen-live-translate] received: ${messageType}`)

          if (messageType === 'session.updated') {
            console.log('[qwen-live-translate] session ready')
            ready = true

            resolve({
              appendAudioChunk: async (chunk, nextSignal) => {
                if (nextSignal?.aborted) {
                  throw createAbortError()
                }

                await ensureReady()
                if (!socketOpen) {
                  throw fatalError ?? new Error('Live translation provider connection closed unexpectedly')
                }
                socket.send(
                  JSON.stringify({
                    type: 'input_audio_buffer.append',
                    audio: Buffer.from(chunk.bytes).toString('base64')
                  })
                )
              },
              finish: async (nextSignal) => {
                if (finished) {
                  return
                }

                if (nextSignal?.aborted) {
                  throw createAbortError()
                }

                await ensureReady()
                finished = true
                if (!socketOpen && !sessionFinished) {
                  throw fatalError ?? new Error('Live translation provider connection closed before session finished')
                }
                socket.send(JSON.stringify({ type: 'session.finish' }))

                await new Promise<void>((innerResolve, innerReject) => {
                  const interval = setInterval(() => {
                    if (fatalError) {
                      clearInterval(interval)
                      innerReject(fatalError)
                      return
                    }

                    if (sessionFinished) {
                      clearInterval(interval)
                      innerResolve()
                    }
                  }, 10)
                })
              },
              abort: async () => {
                abortRequested = true
                socket.close()
              }
            })

            return
          }

          if (messageType === 'conversation.item.input_audio_transcription.text') {
            emitStreamEvent(
              'source',
              getString(message.item_id),
              'source-partial',
              `${getString(message.text)}${getString(message.stash)}`
            )
            return
          }

          if (messageType === 'conversation.item.input_audio_transcription.completed') {
            emitStreamEvent(
              'source',
              getString(message.item_id),
              'source-final',
              getString(message.transcript)
            )
            return
          }

          if (messageType === 'response.text.text') {
            emitStreamEvent(
              'translation',
              getString(message.item_id),
              'translation-partial',
              `${getString(message.text)}${getString(message.stash)}`
            )
            return
          }

          if (messageType === 'response.text.done') {
            emitStreamEvent(
              'translation',
              getString(message.item_id),
              'translation-final',
              getString(message.text)
            )
            return
          }

          if (messageType === 'session.finished') {
            console.log('[qwen-live-translate] session finished')
            sessionFinished = true
            socket.close()
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

            console.error(`[qwen-live-translate] error: ${errorMessage}`)
            const error = new Error(`Live translation provider request failed: ${errorMessage}`)

            if (ready) {
              fatalError = error
              socket.close()
              return
            }

            rejectWith(error)
          }
        } catch (error) {
          const nextError =
            error instanceof Error ? error : new Error('unknown live translation parse error')

          if (ready) {
            fatalError = nextError
            socket.close()
            return
          }

          rejectWith(nextError)
        }
      })

      socket.on('error', (error) => {
        const nextError = new Error(
          `Live translation provider request failed: ${error instanceof Error ? error.message : 'unknown realtime error'}`
        )

        if (ready) {
          fatalError = nextError
          return
        }

        rejectWith(nextError)
      })

      socket.on('close', () => {
        socketOpen = false

        if (settled) {
          return
        }

        if (abortRequested) {
          sessionFinished = true
          return
        }

        if (ready && sessionFinished) {
          return
        }

        if (ready) {
          fatalError = new Error('Live translation provider connection closed unexpectedly')
          sessionFinished = true
          return
        }

        rejectWith(new Error('Live translation provider connection closed before session update completed'))
      })
    })
  }
})
