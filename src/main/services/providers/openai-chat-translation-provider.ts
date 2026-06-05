import { z } from 'zod'
import type {
  TranslationProvider,
  TranslationProviderResult,
  TranslationProviderSubtitle
} from '../../../shared/providers'

type OpenAiChatTranslationProviderOptions = {
  baseUrl: string
  apiKey: string
  model: string
}

const chatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string()
        })
      })
    )
    .min(1)
})

const subtitlesPayloadSchema = z.object({
  subtitles: z.array(
    z.object({
      id: z.string().min(1),
      chinese: z.string()
    })
  )
})

const buildSystemPrompt = (operation: 'translate' | 'revise'): string =>
  operation === 'translate'
    ? 'Translate each subtitle into natural Simplified Chinese. Return JSON only in the shape {"subtitles":[{"id":"...","chinese":"..."}]}.'
    : 'Revise each provided Simplified Chinese subtitle for accuracy and fluency. Return JSON only in the shape {"subtitles":[{"id":"...","chinese":"..."}]}.'

const buildUserPrompt = (subtitles: TranslationProviderSubtitle[]): string =>
  JSON.stringify({
    subtitles: subtitles.map((subtitle) => ({
      id: subtitle.id,
      english: subtitle.english,
      chinese: subtitle.chinese
    }))
  })

const parseChatCompletionContent = (payload: unknown): string => {
  const parsedPayload = chatCompletionResponseSchema.safeParse(payload)

  if (!parsedPayload.success) {
    throw new Error('Translation provider returned invalid chat response structure')
  }

  return parsedPayload.data.choices[0].message.content
}

const parseResults = (content: string): TranslationProviderResult[] => {
  let parsedContent: unknown

  try {
    parsedContent = JSON.parse(content)
  } catch (error) {
    throw new Error(
      `Translation provider returned invalid JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`
    )
  }

  const parsedPayload = subtitlesPayloadSchema.safeParse(parsedContent)

  if (!parsedPayload.success) {
    throw new Error('Translation provider returned invalid subtitles payload structure')
  }

  return parsedPayload.data.subtitles
}

const createBatchHandler =
  (
    options: OpenAiChatTranslationProviderOptions,
    operation: 'translate' | 'revise'
  ) =>
  async (
    subtitles: TranslationProviderSubtitle[],
    signal?: AbortSignal
  ): Promise<TranslationProviderResult[]> => {
    const response = await fetch(`${options.baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`
      },
      body: JSON.stringify({
        model: options.model,
        response_format: {
          type: 'json_object'
        },
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(operation)
          },
          {
            role: 'user',
            content: buildUserPrompt(subtitles)
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Translation provider request failed with status ${response.status}`)
    }

    return parseResults(parseChatCompletionContent(await response.json()))
  }

export const createOpenAiChatTranslationProvider = ({
  baseUrl,
  apiKey,
  model
}: OpenAiChatTranslationProviderOptions): TranslationProvider => ({
  translateBatch: createBatchHandler({ baseUrl, apiKey, model }, 'translate'),
  reviseBatch: createBatchHandler({ baseUrl, apiKey, model }, 'revise')
})
