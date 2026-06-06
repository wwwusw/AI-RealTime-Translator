import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []

  url: string
  options?: { headers?: Record<string, string> }
  private listeners = new Map<string, Array<(payload?: unknown) => void>>()
  sentMessages: string[] = []

  constructor(url: string, options?: { headers?: Record<string, string> }) {
    this.url = url
    this.options = options
    FakeWebSocket.instances.push(this)
  }

  send(payload: string) {
    this.sentMessages.push(payload)
  }

  close() {
    this.emit('close')
  }

  emitOpen() {
    this.emit('open')
  }

  emitMessage(payload: unknown) {
    this.emit('message', JSON.stringify(payload))
  }

  emitError(message: string) {
    this.emit('error', new Error(message))
  }

  on(eventName: string, listener: (payload?: unknown) => void) {
    const nextListeners = this.listeners.get(eventName) ?? []
    nextListeners.push(listener)
    this.listeners.set(eventName, nextListeners)
    return this
  }

  once(eventName: string, listener: (payload?: unknown) => void) {
    const wrappedListener = (payload?: unknown) => {
      this.off(eventName, wrappedListener)
      listener(payload)
    }

    return this.on(eventName, wrappedListener)
  }

  off(eventName: string, listener: (payload?: unknown) => void) {
    const nextListeners = (this.listeners.get(eventName) ?? []).filter(
      (registeredListener) => registeredListener !== listener
    )
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

const createMono16kPcmWav = (sampleCount: number): Buffer => {
  const bytesPerSample = 2
  const sampleRate = 16_000
  const dataSize = sampleCount * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28)
  buffer.writeUInt16LE(bytesPerSample, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < sampleCount; index += 1) {
    buffer.writeInt16LE(index % 32, 44 + index * bytesPerSample)
  }

  return buffer
}

describe('createDashScopeRealtimeAsrProvider', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    FakeWebSocket.instances = []
  })

  it('streams PCM audio over WebSocket and resolves the final transcript', async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), 'dashscope-asr-test-'))
    const chunkFilePath = join(workingDirectory, 'chunk.wav')
    await writeFile(chunkFilePath, createMono16kPcmWav(320))

    vi.doMock('ws', () => ({
      default: FakeWebSocket
    }))
    const { createDashScopeRealtimeAsrProvider } = await import(
      '../../src/main/services/providers/dashscope-realtime-asr-provider'
    )

    const provider = createDashScopeRealtimeAsrProvider({
      baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
      apiKey: 'dashscope-key',
      model: 'qwen3-asr-flash-realtime'
    })

    const transcriptionPromise = provider.transcribeChunk({
      chunkIndex: 0,
      filePath: chunkFilePath
    })

    await vi.waitFor(() => {
      expect(FakeWebSocket.instances).toHaveLength(1)
    })

    const socket = FakeWebSocket.instances[0]
    expect(socket?.url).toBe(
      'wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3-asr-flash-realtime'
    )
    expect(socket?.options?.headers).toEqual({
      Authorization: 'Bearer dashscope-key',
      'OpenAI-Beta': 'realtime=v1'
    })

    socket?.emitOpen()
    socket?.emitMessage({ type: 'session.created' })
    socket?.emitMessage({ type: 'session.updated' })
    socket?.emitMessage({
      type: 'conversation.item.input_audio_transcription.text',
      text: 'hello'
    })
    socket?.emitMessage({
      type: 'conversation.item.input_audio_transcription.completed',
      text: 'hello conference'
    })
    socket?.emitMessage({ type: 'session.finished' })

    await expect(transcriptionPromise).resolves.toBe('hello conference')

    const sentMessages = socket?.sentMessages.map((payload) => JSON.parse(payload))
    expect(sentMessages?.[0]).toMatchObject({
      type: 'session.update',
      session: {
        input_audio_format: 'pcm',
        sample_rate: 16000,
        input_audio_transcription: {},
        turn_detection: null
      }
    })
    expect(sentMessages?.some((message) => message.type === 'input_audio_buffer.append')).toBe(true)
    expect(sentMessages?.some((message) => message.type === 'input_audio_buffer.commit')).toBe(true)
    expect(sentMessages?.some((message) => message.type === 'session.finish')).toBe(true)

    await rm(workingDirectory, { recursive: true, force: true })
  })

  it('surfaces server-side errors from the realtime session', async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), 'dashscope-asr-test-'))
    const chunkFilePath = join(workingDirectory, 'chunk.wav')
    await writeFile(chunkFilePath, createMono16kPcmWav(320))

    vi.doMock('ws', () => ({
      default: FakeWebSocket
    }))
    const { createDashScopeRealtimeAsrProvider } = await import(
      '../../src/main/services/providers/dashscope-realtime-asr-provider'
    )

    const provider = createDashScopeRealtimeAsrProvider({
      baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
      apiKey: 'dashscope-key',
      model: 'qwen3-asr-flash-realtime'
    })

    const transcriptionPromise = provider.transcribeChunk({
      chunkIndex: 0,
      filePath: chunkFilePath
    })

    await vi.waitFor(() => {
      expect(FakeWebSocket.instances).toHaveLength(1)
    })

    const socket = FakeWebSocket.instances[0]
    socket?.emitOpen()
    socket?.emitMessage({ type: 'session.created' })
    socket?.emitMessage({
      type: 'error',
      error: {
        message: 'invalid audio payload'
      }
    })

    await expect(transcriptionPromise).rejects.toThrow(
      'DashScope realtime ASR request failed: invalid audio payload'
    )

    await rm(workingDirectory, { recursive: true, force: true })
  })

  it('resolves an empty transcript instead of failing the whole session when no text is returned', async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), 'dashscope-asr-test-'))
    const chunkFilePath = join(workingDirectory, 'chunk.wav')
    await writeFile(chunkFilePath, createMono16kPcmWav(320))

    vi.doMock('ws', () => ({
      default: FakeWebSocket
    }))
    const { createDashScopeRealtimeAsrProvider } = await import(
      '../../src/main/services/providers/dashscope-realtime-asr-provider'
    )

    const provider = createDashScopeRealtimeAsrProvider({
      baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
      apiKey: 'dashscope-key',
      model: 'qwen3-asr-flash-realtime'
    })

    const transcriptionPromise = provider.transcribeChunk({
      chunkIndex: 0,
      filePath: chunkFilePath
    })

    await vi.waitFor(() => {
      expect(FakeWebSocket.instances).toHaveLength(1)
    })

    const socket = FakeWebSocket.instances[0]
    socket?.emitOpen()
    socket?.emitMessage({ type: 'session.created' })
    socket?.emitMessage({ type: 'session.updated' })
    socket?.emitMessage({
      type: 'conversation.item.input_audio_transcription.completed',
      text: ''
    })
    socket?.emitMessage({ type: 'session.finished' })

    await expect(transcriptionPromise).resolves.toBe('')

    await rm(workingDirectory, { recursive: true, force: true })
  })
})
