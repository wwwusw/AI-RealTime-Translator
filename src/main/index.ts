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

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL

  if (devServerUrl) {
    await window.loadURL(devServerUrl)
    return
  }

  const rendererPath = join(__dirname, '../renderer/index.html')

  try {
    await window.loadFile(rendererPath)
  } catch {
    await window.loadURL('http://localhost:5173/')
  }
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
