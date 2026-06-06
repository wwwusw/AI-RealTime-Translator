import { describe, expect, it } from 'vitest'
import { defaultAppConfig } from '../../src/shared/config'
import { createConfigStore } from '../../src/main/services/config-store'

type FakeStore = {
  data: Record<string, unknown>
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
}

const createFakeStore = (initialConfig?: unknown): FakeStore => {
  const data: Record<string, unknown> = {}

  if (initialConfig !== undefined) {
    data.config = initialConfig
  }

  return {
    data,
    get: (key) => data[key],
    set: (key, value) => {
      data[key] = value
    }
  }
}

describe('config store', () => {
  it('loads a partial persisted config without dropping defaults', () => {
    const store = createFakeStore({
      refiner: {
        apiKey: 'secret'
      },
      liveTranslate: {
        targetLanguage: 'ja'
      }
    })

    const configStore = createConfigStore(store)
    const loaded = configStore.loadConfig()

    expect(loaded.refiner.apiKey).toBe('secret')
    expect(loaded.refiner.baseUrl).toBe(defaultAppConfig.refiner.baseUrl)
    expect(loaded.liveTranslate.targetLanguage).toBe('ja')
    expect(loaded.asr).toEqual(defaultAppConfig.asr)
  })

  it('saves a normalized config and returns the merged result', () => {
    const store = createFakeStore()
    const configStore = createConfigStore(store)

    const saved = configStore.saveConfig({
      refiner: {
        model: 'deepseek-v4-pro'
      }
    })

    expect(saved.refiner.model).toBe('deepseek-v4-pro')
    expect(saved.refiner.baseUrl).toBe(defaultAppConfig.refiner.baseUrl)
    expect(store.data.config).toEqual(saved)
  })
})
