import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfigBridge } from '../shared/app-config-bridge'
import { appConfigEvents } from '../shared/events'

const appConfigApi: AppConfigBridge = {
  load: () => ipcRenderer.invoke(appConfigEvents.load),
  save: (config) => ipcRenderer.invoke(appConfigEvents.save, config)
}

contextBridge.exposeInMainWorld('appConfig', appConfigApi)
