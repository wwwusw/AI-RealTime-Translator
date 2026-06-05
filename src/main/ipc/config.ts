import { ipcMain } from 'electron'
import { appConfigEvents } from '../../shared/events'
import { loadConfig, saveConfig } from '../services/config-store'

export const registerConfigHandlers = () => {
  ipcMain.handle(appConfigEvents.load, () => loadConfig())
  ipcMain.handle(appConfigEvents.save, (_event, config: unknown) => saveConfig(config))
}
