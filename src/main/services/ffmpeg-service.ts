import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

const runFfmpeg = async (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg-static path is unavailable'))
      return
    }

    const ffmpeg = spawn(ffmpegPath, args)
    let stderr = ''

    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    ffmpeg.on('error', reject)
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`))
    })
  })

export const normalizeAudioToMono16kWav = async (
  inputFilePath: string,
  outputFilePath: string
): Promise<string> => {
  await runFfmpeg([
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

  return outputFilePath
}

export const extractAudioChunkToMono16kWav = async ({
  inputFilePath,
  outputFilePath,
  startMs,
  durationMs
}: {
  inputFilePath: string
  outputFilePath: string
  startMs: number
  durationMs: number
}): Promise<string> => {
  await runFfmpeg([
    '-y',
    '-ss',
    (startMs / 1000).toFixed(3),
    '-t',
    (durationMs / 1000).toFixed(3),
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

  return outputFilePath
}
