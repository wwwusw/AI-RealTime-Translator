import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpenAiAudioAsrProvider } from '../../src/main/services/providers/openai-audio-asr-provider'

describe('createOpenAiAudioAsrProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('transcribes a chunk through an OpenAI-compatible audio transcription response', async () => {
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
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer demo-key'
        }),
        body: expect.any(FormData)
      })
    )
    expect(result).toBe('hello conference')
  })
})
