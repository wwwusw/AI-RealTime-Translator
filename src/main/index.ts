import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { getPreloadPath } from './paths'

const createWindow = async () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: getPreloadPath(__dirname)
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL)
    return
  }

  await window.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
