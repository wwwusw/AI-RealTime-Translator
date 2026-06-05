import type { AsrProvider } from '../../../shared/providers'

type ScriptedAsrProviderOptions = {
  getEnglishByChunkIndex: (chunkIndex: number) => Promise<string> | string
}

export const createScriptedAsrProvider = ({
  getEnglishByChunkIndex
}: ScriptedAsrProviderOptions): AsrProvider => ({
  transcribeChunk: async (chunk) => getEnglishByChunkIndex(chunk.index)
})
