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
      translation: {
        apiKey: 'secret'
      }
    })

    const configStore = createConfigStore(store)
    const loaded = configStore.loadConfig()

    expect(loaded.translation.apiKey).toBe('secret')
    expect(loaded.translation.baseUrl).toBe(defaultAppConfig.translation.baseUrl)
    expect(loaded.asr).toEqual(defaultAppConfig.asr)
  })

  it('saves a normalized config and returns the merged result', () => {
    const store = createFakeStore()
    const configStore = createConfigStore(store)

    const saved = configStore.saveConfig({
      translation: {
        model: 'deepseek-v4-pro'
      }
    })

    expect(saved.translation.model).toBe('deepseek-v4-pro')
    expect(saved.translation.baseUrl).toBe(defaultAppConfig.translation.baseUrl)
    expect(store.data.config).toEqual(saved)
  })
})
