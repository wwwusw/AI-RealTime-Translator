import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpenAiAudioAsrProvider } from '../../src/main/services/providers/openai-audio-asr-provider'

describe('createOpenAiAudioAsrProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('transcribes a chunk through an OpenAI-compatible audio transcription response', async () => {
    const signal = new AbortController().signal
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        text: 'hello conference'
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createOpenAiAudioAsrProvider({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'demo-key',
      model: 'gpt-4o-mini-transcribe'
    })

    const result = await provider.transcribeChunk({
      chunkIndex: 0,
      filePath: 'fixtures/chunk-0.wav'
    }, signal)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
        signal,
        headers: expect.objectContaining({
          Authorization: 'Bearer demo-key'
        }),
        body: expect.any(FormData)
      })
    )
    expect(result).toBe('hello conference')
  })

  it('includes response text when the transcription request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid api key'
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createOpenAiAudioAsrProvider({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'demo-key',
      model: 'gpt-4o-mini-transcribe'
    })

    await expect(
      provider.transcribeChunk({
        chunkIndex: 0,
        filePath: 'fixtures/chunk-0.wav'
      })
    ).rejects.toThrow('ASR provider request failed with status 401: invalid api key')
  })

  it('throws a readable error when the transcription payload is not valid JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('Unexpected token < in JSON')
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createOpenAiAudioAsrProvider({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'demo-key',
      model: 'gpt-4o-mini-transcribe'
    })

    await expect(
      provider.transcribeChunk({
        chunkIndex: 0,
        filePath: 'fixtures/chunk-0.wav'
      })
    ).rejects.toThrow('ASR provider returned invalid JSON: Unexpected token < in JSON')
  })
})
