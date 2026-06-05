export type AsrProviderInput = {
  chunkIndex: number
  filePath: string
}

export type TranslationProviderSubtitle = {
  id: string
  english: string
  chinese: string
}

export type TranslationProviderResult = {
  id: string
  chinese: string
}

export type AsrProvider = {
  transcribeChunk: (input: AsrProviderInput) => Promise<string>
}

export type TranslationProvider = {
  translateBatch: (
    subtitles: TranslationProviderSubtitle[]
  ) => Promise<TranslationProviderResult[]>
  reviseBatch: (
    subtitles: TranslationProviderSubtitle[]
  ) => Promise<TranslationProviderResult[]>
}
