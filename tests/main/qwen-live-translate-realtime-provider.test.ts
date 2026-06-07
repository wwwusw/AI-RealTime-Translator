import { afterEach, describe, expect, it, vi } from 'vitest'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []

  url: string
  options?: { headers?: Record<string, string> }
  readyState = 0
  sentMessages: string[] = []
  private listeners = new Map<string, Array<(payload?: unknown) => void>>()

  constructor(url: string, options?: { headers?: Record<string, string> }) {
    this.url = url
    this.options = options
    FakeWebSocket.instances.push(this)
  }

  send(payload: string) {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open')
    }

    this.sentMessages.push(payload)
  }

  close() {
    this.readyState = 3
    this.emit('close')
  }

  emitOpen() {
    this.readyState = 1
    this.emit('open')
  }

  emitMessage(payload: unknown) {
    this.emit('message', JSON.stringify(payload))
  }

  on(eventName: string, listener: (payload?: unknown) => void) {
    const nextListeners = this.listeners.get(eventName) ?? []
    nextListeners.push(listener)
    this.listeners.set(eventName, nextListeners)
    return this
  }

  removeAllListeners() {
    this.listeners.clear()
    return this
  }

  private emit(eventName: string, payload?: unknown) {
    for (const listener of this.listeners.get(eventName) ?? []) {
      listener(payload)
    }
  }
}

describe('createQwenLiveTranslateRealtimeProvider', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    FakeWebSocket.instances = []
  })

  it('surfaces an unexpected socket close after session setup as a readable runtime error', async () => {
    vi.doMock('ws', () => ({
      default: FakeWebSocket
    }))

    const { createQwenLiveTranslateRealtimeProvider } = await import(
      '../../src/main/services/providers/qwen-live-translate-realtime-provider'
    )

    const provider = createQwenLiveTranslateRealtimeProvider({
      baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
      apiKey: 'dashscope-key',
      model: 'qwen3.5-livetranslate-flash-realtime'
    })

    const sessionPromise = provider.startSession({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      onEvent: vi.fn()
    })

    await vi.waitFor(() => {
      expect(FakeWebSocket.instances).toHaveLength(1)
    })

    const socket = FakeWebSocket.instances[0]
    socket.emitOpen()
    socket.emitMessage({ type: 'session.updated' })

    const session = await sessionPromise
    socket.close()

    await expect(
      session.appendAudioChunk({
        bytes: new Uint8Array([1, 2, 3]),
        durationMs: 250,
        mimeType: 'audio/pcm'
      })
    ).rejects.toThrow('Live translation provider connection closed unexpectedly')
  })
})
