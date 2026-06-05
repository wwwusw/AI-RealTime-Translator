import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

export const normalizeAudioToMono16kWav = async (
  inputFilePath: string,
  outputFilePath: string
): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg-static path is unavailable'))
      return
    }

    const ffmpeg = spawn(ffmpegPath, [
      '-y',
      '-i',
      inputFilePath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      outputFilePath
    ])

    let stderr = ''

    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    ffmpeg.on('error', reject)
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputFilePath)
        return
      }

      reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`))
    })
  })
