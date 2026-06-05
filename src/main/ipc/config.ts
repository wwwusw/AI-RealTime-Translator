import { ipcMain } from 'electron'
import type { AppConfigBridge } from '../../shared/app-config-bridge'
import { appConfigEvents } from '../../shared/events'
import { loadConfig, saveConfig } from '../services/config-store'

export const registerConfigHandlers = () => {
  ipcMain.handle(appConfigEvents.load, () => loadConfig())
  ipcMain.handle(
    appConfigEvents.save,
    (_event, config: Parameters<AppConfigBridge['save']>[0]) => saveConfig(config)
  )
}
