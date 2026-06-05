import { create } from 'zustand'
import { defaultAppConfig, type AppConfig } from '../../../shared/config'

type AppConfigBridge = {
  load: () => Promise<AppConfig>
  save: (config: AppConfig) => Promise<AppConfig>
}

type AppStore = {
  config: AppConfig
  hydrateConfig: () => Promise<void>
  saveConfig: (config: AppConfig) => Promise<void>
}

const getAppConfigBridge = (): AppConfigBridge | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.appConfig
}

export const useAppStore = create<AppStore>((set) => ({
  config: defaultAppConfig,
  hydrateConfig: async () => {
    const bridge = getAppConfigBridge()
    if (!bridge) {
      return
    }

    const config = await bridge.load()
    set({ config })
  },
  saveConfig: async (config) => {
    const bridge = getAppConfigBridge()
    if (!bridge) {
      set({ config })
      return
    }

    const next = await bridge.save(config)
    set({ config: next })
  }
}))
