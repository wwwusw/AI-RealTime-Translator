import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { z } from 'zod'
import type { AsrProvider } from '../../../shared/providers'

type OpenAiAudioAsrProviderOptions = {
  baseUrl: string
  apiKey: string
  model: string
}

const transcriptionResponseSchema = z.object({
  text: z.string()
})

const summarizeResponseText = (text: string): string => text.trim().replace(/\s+/g, ' ').slice(0, 160)

const parseJsonPayload = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch (error) {
    throw new Error(
      `ASR provider returned invalid JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`
    )
  }
}

const createAudioFile = async (filePath: string): Promise<File> => {
  const resolvedFilePath = resolve(filePath)
  const contents = await readFile(resolvedFilePath)

  return new File([contents], basename(resolvedFilePath), {
    type: 'audio/wav'
  })
}

export const createOpenAiAudioAsrProvider = ({
  baseUrl,
  apiKey,
  model
}: OpenAiAudioAsrProviderOptions): AsrProvider => ({
  transcribeChunk: async ({ filePath }, signal) => {
    const formData = new FormData()
    formData.set('model', model)
    formData.set('file', await createAudioFile(filePath))

    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    })

    if (!response.ok) {
      const responseText = summarizeResponseText(await response.text())
      throw new Error(
        responseText.length > 0
          ? `ASR provider request failed with status ${response.status}: ${responseText}`
          : `ASR provider request failed with status ${response.status}`
      )
    }

    const parsedResponse = transcriptionResponseSchema.safeParse(await parseJsonPayload(response))

    if (!parsedResponse.success) {
      throw new Error('ASR provider returned invalid transcription response structure')
    }

    return parsedResponse.data.text
  }
})
