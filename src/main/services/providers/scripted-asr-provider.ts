import type { AsrProvider } from '../../../shared/providers'

type ScriptedAsrProviderOptions = {
  getEnglishByChunk: (input: {
    chunkIndex: number
    filePath: string
  }) => Promise<string> | string
}

export const createScriptedAsrProvider = ({
  getEnglishByChunk
}: ScriptedAsrProviderOptions): AsrProvider => ({
  transcribeChunk: async (input) => getEnglishByChunk(input)
})
