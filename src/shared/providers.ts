import type { SystemAudioChunkPayload } from './pipeline'

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

export type SubtitleBlockRefinementInput = {
  id: string
  sourceTranscript: string
  liveTranslation: string
  refinedTranslation: string
}

export type SubtitleBlockRefinementResult = {
  id: string
  translatedText: string
}

export type LiveTranslateStreamEvent =
  | {
      type: 'source-partial'
      itemId: string
      fullText: string
      deltaText: string
    }
  | {
      type: 'source-final'
      itemId: string
      fullText: string
      deltaText: string
    }
  | {
      type: 'translation-partial'
      itemId: string
      fullText: string
      deltaText: string
    }
  | {
      type: 'translation-final'
      itemId: string
      fullText: string
      deltaText: string
    }

export type LiveTranslateSession = {
  appendAudioChunk: (chunk: SystemAudioChunkPayload, signal?: AbortSignal) => Promise<void>
  finish: (signal?: AbortSignal) => Promise<void>
  abort: () => Promise<void>
}

export type LiveTranslateProvider = {
  startSession: (
    options: {
      targetLanguage: string
      sourceLanguage?: string
      signal?: AbortSignal
      onEvent: (event: LiveTranslateStreamEvent) => void
    }
  ) => Promise<LiveTranslateSession>
}

export type AsrProvider = {
  transcribeChunk: (input: AsrProviderInput, signal?: AbortSignal) => Promise<string>
}

export type TranslationProvider = {
  translateBatch: (
    subtitles: TranslationProviderSubtitle[],
    signal?: AbortSignal
  ) => Promise<TranslationProviderResult[]>
  reviseBatch: (
    subtitles: TranslationProviderSubtitle[],
    signal?: AbortSignal
  ) => Promise<TranslationProviderResult[]>
}

export type RefinementProvider = {
  refineBlocks: (
    input: {
      refinedContextBlocks: SubtitleBlockRefinementInput[]
      pendingBlocks: SubtitleBlockRefinementInput[]
    },
    signal?: AbortSignal
  ) => Promise<SubtitleBlockRefinementResult[]>
}
