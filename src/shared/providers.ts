import type { PlannedChunk } from './pipeline'

export type AsrProvider = {
  transcribeChunk: (chunk: PlannedChunk) => Promise<string>
}

export type TranslationProvider = {
  translateBatch: (englishLines: string[]) => Promise<string[]>
  reviseBatch: (englishLines: string[]) => Promise<string[]>
}
