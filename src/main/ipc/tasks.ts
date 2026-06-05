import { ipcMain } from 'electron'
import { pipelineTaskChannels } from '../../shared/pipeline'
import { pickMediaFile } from '../services/file-picker'

export const registerTaskHandlers = () => {
  ipcMain.handle(pipelineTaskChannels.pickMediaFile, () => pickMediaFile())
}
