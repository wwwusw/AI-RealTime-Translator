import { describe, expect, it } from 'vitest'
import { defaultAppConfig, mergeConfig } from '../../src/shared/config'

describe('config defaults', () => {
  it('uses DeepSeek defaults for translation and scripted ASR for local development', () => {
    expect(defaultAppConfig.translation.baseUrl).toBe('https://api.deepseek.com')
    expect(defaultAppConfig.translation.model).toBe('deepseek-v4-flash')
    expect(defaultAppConfig.asr.provider).toBe('scripted')
  })

  it('merges a partial persisted config without dropping defaults', () => {
    const merged = mergeConfig({
      translation: {
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'demo-key',
        model: 'deepseek-v4-pro'
      }
    })

    expect(merged.translation.model).toBe('deepseek-v4-pro')
    expect(merged.chunkDurationMs).toBe(5000)
    expect(merged.asr.provider).toBe('scripted')
  })
})
