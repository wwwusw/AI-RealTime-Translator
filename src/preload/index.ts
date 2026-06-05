import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig } from '../shared/config'
import { appConfigEvents } from '../shared/events'

const appConfigApi = {
  load: () => ipcRenderer.invoke(appConfigEvents.load) as Promise<AppConfig>,
  save: (config: AppConfig) => ipcRenderer.invoke(appConfigEvents.save, config) as Promise<AppConfig>
}

contextBridge.exposeInMainWorld('appConfig', appConfigApi)
