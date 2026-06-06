import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerConfigHandlers } from './ipc/config'
import { registerTaskHandlers } from './ipc/tasks'
import { getPreloadPath } from './paths'

const createWindow = async () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: getPreloadPath(__dirname),
      contextIsolation: true,
      sandbox: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL)
    return
  }

  await window.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  registerConfigHandlers()
  registerTaskHandlers()
  await createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
