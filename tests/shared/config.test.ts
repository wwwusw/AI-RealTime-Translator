import { describe, expect, it } from 'vitest'
import { defaultAppConfig, mergeConfig } from '../../src/shared/config'

describe('config defaults', () => {
  it('uses DeepSeek defaults for refinement, live translate defaults, and scripted ASR for local development', () => {
    expect(defaultAppConfig.inputMode).toBe('file')
    expect(defaultAppConfig.refiner.baseUrl).toBe('https://api.deepseek.com')
    expect(defaultAppConfig.refiner.model).toBe('deepseek-v4-flash')
    expect(defaultAppConfig.refiner.apiKey).toBe('')
    expect(defaultAppConfig.asr.provider).toBe('scripted')
    expect(defaultAppConfig.liveTranslate.model).toBe('qwen3.5-livetranslate-flash-realtime')
    expect(defaultAppConfig.blockDurationMs).toBe(2000)
  })

  it('merges a partial persisted config without dropping defaults', () => {
    const merged = mergeConfig({
      refiner: {
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'demo-key',
        model: 'deepseek-v4-pro'
      }
    })

    expect(merged.refiner.model).toBe('deepseek-v4-pro')
    expect(merged.chunkDurationMs).toBe(5000)
    expect(merged.blockDurationMs).toBe(2000)
    expect(merged.asr.provider).toBe('scripted')
  })

  it('falls back to defaults when the top-level value is not an object', () => {
    expect(mergeConfig('invalid')).toEqual(defaultAppConfig)
  })

  it('keeps default nested config when refiner, liveTranslate, or asr is null or an array', () => {
    const merged = mergeConfig({
      refiner: null,
      liveTranslate: [],
      asr: []
    })

    expect(merged.refiner).toEqual(defaultAppConfig.refiner)
    expect(merged.liveTranslate).toEqual(defaultAppConfig.liveTranslate)
    expect(merged.asr).toEqual(defaultAppConfig.asr)
  })

  it('keeps sibling defaults when only one nested field is overridden', () => {
    const merged = mergeConfig({
      inputMode: 'system-audio',
      refiner: {
        apiKey: 'demo-key'
      },
      liveTranslate: {
        targetLanguage: 'ja'
      },
      asr: {
        provider: 'dashscope-realtime',
        model: 'qwen3-asr-flash-realtime'
      }
    })

    expect(merged.refiner.apiKey).toBe('demo-key')
    expect(merged.inputMode).toBe('system-audio')
    expect(merged.refiner.baseUrl).toBe(defaultAppConfig.refiner.baseUrl)
    expect(merged.refiner.model).toBe(defaultAppConfig.refiner.model)
    expect(merged.liveTranslate.targetLanguage).toBe('ja')
    expect(merged.liveTranslate.model).toBe(defaultAppConfig.liveTranslate.model)
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
