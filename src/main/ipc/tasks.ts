import { ipcMain } from 'electron'
import {
  pipelineTaskChannels,
  type PipelineTaskStage,
  type PipelineTaskStatus
} from '../../shared/pipeline'
import { pickMediaFile } from '../services/file-picker'

const buildTaskStatus = ({
  filePath,
  stage,
  lastRevisionSummary
}: {
  filePath: string | null
  stage: PipelineTaskStage
  lastRevisionSummary: string
}): PipelineTaskStatus => ({
  filePath,
  stage,
  isRunning: stage === 'running',
  canStart: filePath !== null && stage !== 'running',
  lastRevisionSummary
})

const initialTaskStatus = (): PipelineTaskStatus =>
  buildTaskStatus({
    filePath: null,
    stage: 'idle',
    lastRevisionSummary: 'No task has run yet.'
  })

let currentTaskStatus = initialTaskStatus()

export const registerTaskHandlers = () => {
  ipcMain.handle(pipelineTaskChannels.pickMediaFile, async () => {
    const file = await pickMediaFile()

    if (file) {
      currentTaskStatus = buildTaskStatus({
        filePath: file.filePath,
        stage: 'ready',
        lastRevisionSummary: 'File selected. Ready to start the MVP task flow.'
      })
    }

    return file
  })
  ipcMain.handle(pipelineTaskChannels.getTaskStatus, () => currentTaskStatus)
  ipcMain.handle(pipelineTaskChannels.startTask, (_event, filePath: string | null) => {
    const nextFilePath = filePath ?? currentTaskStatus.filePath

    if (!nextFilePath) {
      return currentTaskStatus
    }

    currentTaskStatus = buildTaskStatus({
      filePath: nextFilePath,
      stage: 'running',
      lastRevisionSummary: 'Task started. Execution controls are wired, with deeper pipeline work still pending.'
    })

    return currentTaskStatus
  })
  ipcMain.handle(pipelineTaskChannels.pauseTask, () => {
    if (!currentTaskStatus.filePath) {
      return currentTaskStatus
    }

    currentTaskStatus = buildTaskStatus({
      filePath: currentTaskStatus.filePath,
      stage: 'paused',
      lastRevisionSummary: 'Pause requested. Abort hooks are ready for a fuller pipeline integration.'
    })

    return currentTaskStatus
  })
  ipcMain.handle(pipelineTaskChannels.resetTask, () => {
    currentTaskStatus = initialTaskStatus()
    return currentTaskStatus
  })
}
