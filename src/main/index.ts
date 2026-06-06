import { app, BrowserWindow, desktopCapturer, session } from 'electron'
import { join } from 'node:path'
import { registerConfigHandlers } from './ipc/config'
import { registerTaskHandlers } from './ipc/tasks'
import { getPreloadPath } from './paths'

const registerSystemAudioCapture = () => {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] })
        const primarySource = sources[0]

        if (!primarySource) {
          callback({})
          return
        }

        callback({
          video: primarySource,
          audio: process.platform === 'win32' ? 'loopback' : undefined
        })
      } catch {
        callback({})
      }
    },
    { useSystemPicker: false }
  )
}

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
  registerSystemAudioCapture()
  await createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
