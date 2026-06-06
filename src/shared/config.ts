import { z } from 'zod'

export const refinerConfigSchema = z.object({
  baseUrl: z.string().url().default('https://api.deepseek.com'),
  apiKey: z.string().default(''),
  model: z.string().min(1).default('deepseek-v4-flash')
})

export const asrConfigSchema = z.object({
  provider: z.enum(['scripted', 'openai-audio', 'dashscope-realtime']).default('scripted'),
  baseUrl: z.string().url().default('wss://dashscope.aliyuncs.com/api-ws/v1/realtime'),
  apiKey: z.string().default(''),
  model: z.string().min(1).default('qwen3-asr-flash-realtime')
})

export const liveTranslateConfigSchema = z.object({
  baseUrl: z.string().url().default('wss://dashscope.aliyuncs.com/api-ws/v1/realtime'),
  apiKey: z.string().default(''),
  model: z.string().min(1).default('qwen3.5-livetranslate-flash-realtime'),
  sourceLanguage: z.string().default('en'),
  targetLanguage: z.string().default('zh')
})

export const appConfigSchema = z.object({
  inputMode: z.enum(['file', 'system-audio']).default('file'),
  refiner: refinerConfigSchema.default({}),
  asr: asrConfigSchema.default({}),
  liveTranslate: liveTranslateConfigSchema.default({}),
  revisionWindowSize: z.number().int().min(1).max(6).default(4),
  blockDurationMs: z.number().int().min(2000).max(4000).default(2000),
  chunkDurationMs: z.number().int().min(1000).max(10000).default(5000),
  chunkOverlapMs: z.number().int().min(0).max(2000).default(1000)
})

export type AppConfig = z.infer<typeof appConfigSchema>

export const defaultAppConfig: AppConfig = appConfigSchema.parse({})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getNestedRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {}

export const mergeConfig = (value: unknown): AppConfig => {
  const partial = getNestedRecord(value)
  const refiner = getNestedRecord(partial.refiner)
  const asr = getNestedRecord(partial.asr)
  const liveTranslate = getNestedRecord(partial.liveTranslate)

  return appConfigSchema.parse({
    ...defaultAppConfig,
    ...partial,
    refiner: {
      ...defaultAppConfig.refiner,
      ...refiner
    },
    asr: {
      ...defaultAppConfig.asr,
      ...asr
    },
    liveTranslate: {
      ...defaultAppConfig.liveTranslate,
      ...liveTranslate
    }
  })
}
