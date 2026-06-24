import fs from 'fs'
import path from 'path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { ssim } from 'ssim.js'
import { type DiffOptions, type DiffResult, DEFAULT_DIFF_OPTIONS } from './types.js'

const DIFFS_DIR = 'test/visual/diffs'

function readPng(filePath: string): PNG {
  return PNG.sync.read(fs.readFileSync(filePath))
}

type SsimInput = { data: Uint8ClampedArray; width: number; height: number }

function toImageData(png: PNG): SsimInput {
  return {
    data: new Uint8ClampedArray(png.data),
    width: png.width,
    height: png.height,
  }
}

/**
 * Compare two screenshot files and return diff metrics.
 * Generates a diff image at test/visual/diffs/ when generateDiffImage is true.
 */
export async function diffScreenshots(
  baselinePath: string,
  currentPath: string,
  diffName: string,
  opts: DiffOptions = {},
): Promise<DiffResult> {
  const options = { ...DEFAULT_DIFF_OPTIONS, ...opts }

  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Baseline not found: ${baselinePath}`)
  }
  if (!fs.existsSync(currentPath)) {
    throw new Error(`Current screenshot not found: ${currentPath}`)
  }

  const baseline = readPng(baselinePath)
  const current = readPng(currentPath)

  // Dimensions must match — if not, that itself is a regression
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      pixelDiffRatio: 1,
      ssimScore: 0,
      diffPixels: baseline.width * baseline.height,
      totalPixels: baseline.width * baseline.height,
      passed: false,
    }
  }

  const { width, height } = baseline
  const totalPixels = width * height
  const diffPng = new PNG({ width, height })

  const diffPixels = pixelmatch(
    baseline.data,
    current.data,
    diffPng.data,
    width,
    height,
    { threshold: options.colorSensitivity, includeAA: false },
  )

  const ssimResult = ssim(toImageData(baseline), toImageData(current))
  const ssimScore = ssimResult.mssim

  const pixelDiffRatio = diffPixels / totalPixels
  const passed =
    pixelDiffRatio <= options.threshold && ssimScore >= options.ssimThreshold

  let diffImagePath: string | undefined
  if (options.generateDiffImage && diffPixels > 0) {
    fs.mkdirSync(DIFFS_DIR, { recursive: true })
    diffImagePath = path.join(DIFFS_DIR, `${diffName}.png`)
    fs.writeFileSync(diffImagePath, PNG.sync.write(diffPng))
  }

  return { pixelDiffRatio, ssimScore, diffPixels, totalPixels, diffImagePath, passed }
}
