import { z } from 'zod'

export const translationConfigSchema = z.object({
  baseUrl: z.string().url().default('https://api.deepseek.com'),
  apiKey: z.string().default(''),
  model: z.string().min(1).default('deepseek-v4-flash')
})

export const asrConfigSchema = z.object({
  provider: z.enum(['scripted', 'openai-audio']).default('scripted'),
  baseUrl: z.string().url().default('https://api.openai.com/v1'),
  apiKey: z.string().default(''),
  model: z.string().min(1).default('gpt-4o-mini-transcribe')
})

export const appConfigSchema = z.object({
  translation: translationConfigSchema.default({}),
  asr: asrConfigSchema.default({}),
  revisionWindowSize: z.number().int().min(1).max(6).default(4),
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
  const translation = getNestedRecord(partial.translation)
  const asr = getNestedRecord(partial.asr)

  return appConfigSchema.parse({
    ...defaultAppConfig,
    ...partial,
    translation: {
      ...defaultAppConfig.translation,
      ...translation
    },
    asr: {
      ...defaultAppConfig.asr,
      ...asr
    }
  })
}
