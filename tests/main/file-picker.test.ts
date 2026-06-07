import { beforeEach, describe, expect, it, vi } from 'vitest'

const showOpenDialogMock = vi.fn()

vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: showOpenDialogMock
  }
}))

describe('pickMediaFile', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('uses Chinese text in the native file selection dialog', async () => {
    showOpenDialogMock.mockResolvedValue({
      canceled: true,
      filePaths: []
    })

    const { pickMediaFile } = await import('../../src/main/services/file-picker')
    await pickMediaFile()

    expect(showOpenDialogMock).toHaveBeenCalledWith(undefined, {
      title: '选择媒体文件',
      properties: ['openFile'],
      filters: [
        {
          name: '媒体文件',
          extensions: ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'mp4', 'mov', 'mkv']
        }
      ]
    })
  })
})
