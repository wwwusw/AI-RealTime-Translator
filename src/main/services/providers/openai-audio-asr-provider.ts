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
  transcribeChunk: async ({ filePath }) => {
    const formData = new FormData()
    formData.set('model', model)
    formData.set('file', await createAudioFile(filePath))

    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`ASR provider request failed with status ${response.status}`)
    }

    const parsedResponse = transcriptionResponseSchema.safeParse(await response.json())

    if (!parsedResponse.success) {
      throw new Error('ASR provider returned invalid transcription response structure')
    }

    return parsedResponse.data.text
  }
})
