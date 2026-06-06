import Store from 'electron-store'
import { defaultAppConfig, mergeConfig, type AppConfig } from '../../shared/config'

type PersistedShape = {
  config: AppConfig
}

type StoreShape = {
  get: (key: 'config') => unknown
  set: (key: 'config', value: AppConfig) => void
}

export const createConfigStore = (store: StoreShape) => ({
  loadConfig: (): AppConfig => mergeConfig(store.get('config')),
  saveConfig: (config: unknown): AppConfig => {
    const next = mergeConfig(config)
    store.set('config', next)
    return next
  }
})

let storeSingleton: ReturnType<typeof createConfigStore> | undefined

const getStoreSingleton = () => {
  if (!storeSingleton) {
    storeSingleton = createConfigStore(
      new Store<PersistedShape>({
        name: 'ai-realtime-translator',
        defaults: {
          config: defaultAppConfig
        }
      })
    )
  }

  return storeSingleton
}

export const loadConfig = (): AppConfig => getStoreSingleton().loadConfig()

export const saveConfig = (config: unknown): AppConfig => getStoreSingleton().saveConfig(config)
