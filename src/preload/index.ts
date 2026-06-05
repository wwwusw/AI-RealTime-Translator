import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfigBridge } from '../shared/app-config-bridge'
import { appConfigEvents } from '../shared/events'
import type { PipelineTasksBridge } from '../shared/pipeline'
import { pipelineTaskChannels } from '../shared/pipeline'

const appConfigApi: AppConfigBridge = {
  load: () => ipcRenderer.invoke(appConfigEvents.load),
  save: (config) => ipcRenderer.invoke(appConfigEvents.save, config)
}

const pipelineTasksApi: PipelineTasksBridge = {
  pickMediaFile: () => ipcRenderer.invoke(pipelineTaskChannels.pickMediaFile)
}

contextBridge.exposeInMainWorld('appConfig', appConfigApi)
contextBridge.exposeInMainWorld('pipelineTasks', pipelineTasksApi)
