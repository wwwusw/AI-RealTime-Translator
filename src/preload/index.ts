import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfigBridge } from '../shared/app-config-bridge'
import { appConfigEvents, floatingWindowChannels } from '../shared/events'
import type { FloatingWindowBridge, PipelineTasksBridge } from '../shared/pipeline'
import { pipelineTaskChannels } from '../shared/pipeline'

const appConfigApi: AppConfigBridge = {
  load: () => ipcRenderer.invoke(appConfigEvents.load),
  save: (config) => ipcRenderer.invoke(appConfigEvents.save, config)
}

const pipelineTasksApi: PipelineTasksBridge = {
  pickMediaFile: () => ipcRenderer.invoke(pipelineTaskChannels.pickMediaFile),
  getTaskStatus: () => ipcRenderer.invoke(pipelineTaskChannels.getTaskStatus),
  startTask: (filePath) => ipcRenderer.invoke(pipelineTaskChannels.startTask, filePath),
  startSystemAudioTask: () => ipcRenderer.invoke(pipelineTaskChannels.startSystemAudioTask),
  pushSystemAudioChunk: (chunk) => ipcRenderer.invoke(pipelineTaskChannels.pushSystemAudioChunk, chunk),
  completeSystemAudioTask: () => ipcRenderer.invoke(pipelineTaskChannels.completeSystemAudioTask),
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

const floatingWindowApi: FloatingWindowBridge = {
  open: () => ipcRenderer.invoke(floatingWindowChannels.open),
  close: () => ipcRenderer.invoke(floatingWindowChannels.close),
  toggle: () => ipcRenderer.invoke(floatingWindowChannels.toggle),
  getState: () => ipcRenderer.invoke(floatingWindowChannels.getState),
  onStateChanged: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      listener(state as Parameters<typeof listener>[0])
    }

    ipcRenderer.on(floatingWindowChannels.stateChanged, wrappedListener)

    return () => {
      ipcRenderer.removeListener(floatingWindowChannels.stateChanged, wrappedListener)
    }
  }
}

contextBridge.exposeInMainWorld('appConfig', appConfigApi)
contextBridge.exposeInMainWorld('pipelineTasks', pipelineTasksApi)
contextBridge.exposeInMainWorld('floatingWindow', floatingWindowApi)
