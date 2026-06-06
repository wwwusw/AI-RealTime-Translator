import { describe, expect, it } from 'vitest'
import { defaultAppConfig, mergeConfig } from '../../src/shared/config'

describe('config defaults', () => {
  it('uses DeepSeek defaults for translation and scripted ASR for local development', () => {
    expect(defaultAppConfig.translation.baseUrl).toBe('https://api.deepseek.com')
    expect(defaultAppConfig.translation.model).toBe('deepseek-v4-flash')
    expect(defaultAppConfig.translation.apiKey).toBe('')
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

  it('falls back to defaults when the top-level value is not an object', () => {
    expect(mergeConfig('invalid')).toEqual(defaultAppConfig)
  })

  it('keeps default nested config when translation or asr is null or an array', () => {
    const merged = mergeConfig({
      translation: null,
      asr: []
    })

    expect(merged.translation).toEqual(defaultAppConfig.translation)
    expect(merged.asr).toEqual(defaultAppConfig.asr)
  })

  it('keeps sibling defaults when only one nested field is overridden', () => {
    const merged = mergeConfig({
      translation: {
        apiKey: 'demo-key'
      },
      asr: {
        provider: 'dashscope-realtime',
        model: 'qwen3-asr-flash-realtime'
      }
    })

    expect(merged.translation.apiKey).toBe('demo-key')
    expect(merged.translation.baseUrl).toBe(defaultAppConfig.translation.baseUrl)
    expect(merged.translation.model).toBe(defaultAppConfig.translation.model)
    expect(merged.asr.provider).toBe('dashscope-realtime')
    expect(merged.asr.model).toBe('qwen3-asr-flash-realtime')
    expect(merged.asr.baseUrl).toBe(defaultAppConfig.asr.baseUrl)
  })

  it('throws when a leaf field has an invalid type', () => {
    expect(() =>
      mergeConfig({
        chunkDurationMs: 'oops'
      })
    ).toThrow()
  })
})
