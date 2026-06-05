import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpenAiChatTranslationProvider } from '../../src/main/services/providers/openai-chat-translation-provider'

describe('createOpenAiChatTranslationProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('translates a subtitle batch through an OpenAI-compatible chat completions response', async () => {
    const signal = new AbortController().signal
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                subtitles: [{ id: 'subtitle-0', chinese: '你好，世界' }]
              })
            }
          }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createOpenAiChatTranslationProvider({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'demo-key',
      model: 'deepseek-v4-flash'
    })

    const result = await provider.translateBatch(
      [{ id: 'subtitle-0', english: 'hello world', chinese: '' }],
      signal
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        signal
      })
    )
    expect(result).toEqual([{ id: 'subtitle-0', chinese: '你好，世界' }])
  })

  it('throws a readable error when the chat response content is not valid JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'not json'
            }
          }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = createOpenAiChatTranslationProvider({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'demo-key',
      model: 'deepseek-v4-flash'
    })

    await expect(
      provider.translateBatch([{ id: 'subtitle-0', english: 'hello world', chinese: '' }])
    ).rejects.toThrow('Translation provider returned invalid JSON')
  })
})
