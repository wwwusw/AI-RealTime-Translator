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
  pickMediaFile: () => ipcRenderer.invoke(pipelineTaskChannels.pickMediaFile),
  getTaskStatus: () => ipcRenderer.invoke(pipelineTaskChannels.getTaskStatus),
  startTask: (filePath) => ipcRenderer.invoke(pipelineTaskChannels.startTask, filePath),
  pauseTask: () => ipcRenderer.invoke(pipelineTaskChannels.pauseTask),
  resetTask: () => ipcRenderer.invoke(pipelineTaskChannels.resetTask),
  onPipelineEvent: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, pipelineEvent: unknown) => {
      listener(pipelineEvent as Parameters<typeof listener>[0])
    }

    ipcRenderer.on(pipelineTaskChannels.pipelineEvent, wrappedListener)

    return () => {
      ipcRenderer.removeListener(pipelineTaskChannels.pipelineEvent, wrappedListener)
    }
  }
}

contextBridge.exposeInMainWorld('appConfig', appConfigApi)
contextBridge.exposeInMainWorld('pipelineTasks', pipelineTasksApi)
