import { z } from 'zod'
import type {
  RefinementProvider,
  SubtitleBlockRefinementInput,
  SubtitleBlockRefinementResult,
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

const refinedBlocksPayloadSchema = z.object({
  blocks: z.array(
    z.object({
      id: z.string().min(1),
      translatedText: z.string()
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

const buildRefinementSystemPrompt = (): string =>
  [
    'You refine realtime subtitle blocks into natural Simplified Chinese.',
    'You will receive two sections:',
    '1. already refined context blocks',
    '2. pending blocks that still need correction',
    'Use the refined context only as context.',
    'Return JSON only in the shape {"blocks":[{"id":"...","translatedText":"..."}]}.',
    'Return results only for the pending blocks, preserving their ids and order.'
  ].join(' ')

const buildRefinementUserPrompt = (input: {
  refinedContextBlocks: SubtitleBlockRefinementInput[]
  pendingBlocks: SubtitleBlockRefinementInput[]
}): string =>
  JSON.stringify({
    refinedContextBlocks: input.refinedContextBlocks.map((block) => ({
      id: block.id,
      sourceTranscript: block.sourceTranscript,
      liveTranslation: block.liveTranslation,
      refinedTranslation: block.refinedTranslation
    })),
    pendingBlocks: input.pendingBlocks.map((block) => ({
      id: block.id,
      sourceTranscript: block.sourceTranscript,
      liveTranslation: block.liveTranslation
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

const parseRefinementResults = (content: string): SubtitleBlockRefinementResult[] => {
  let parsedContent: unknown

  try {
    parsedContent = JSON.parse(content)
  } catch (error) {
    throw new Error(
      `Refinement provider returned invalid JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`
    )
  }

  const parsedPayload = refinedBlocksPayloadSchema.safeParse(parsedContent)

  if (!parsedPayload.success) {
    throw new Error('Refinement provider returned invalid blocks payload structure')
  }

  return parsedPayload.data.blocks
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

export const createOpenAiChatRefinementProvider = ({
  baseUrl,
  apiKey,
  model
}: OpenAiChatTranslationProviderOptions): RefinementProvider => ({
  refineBlocks: async (input, signal) => {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        response_format: {
          type: 'json_object'
        },
        messages: [
          {
            role: 'system',
            content: buildRefinementSystemPrompt()
          },
          {
            role: 'user',
            content: buildRefinementUserPrompt(input)
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Refinement provider request failed with status ${response.status}`)
    }

    return parseRefinementResults(parseChatCompletionContent(await response.json()))
  }
})
