export type DiffResult = {
  /** Fraction of pixels that differ (0–1) */
  pixelDiffRatio: number
  /** SSIM score (0–1, higher = more similar) */
  ssimScore: number
  /** Number of differing pixels */
  diffPixels: number
  /** Total pixels compared */
  totalPixels: number
  /** Path to the diff image (if generated) */
  diffImagePath?: string
  /** Whether the images are considered visually equal given the threshold */
  passed: boolean
}

export type DomDiff = {
  added: string[]
  removed: string[]
  changed: Array<{ selector: string; attribute: string; from: string; to: string }>
}

export type DiffOptions = {
  /** Max allowed pixel diff ratio (0–1). Default: 0.02 */
  threshold?: number
  /** Min SSIM score to pass (0–1). Default: 0.98 */
  ssimThreshold?: number
  /** Generate a visual diff image */
  generateDiffImage?: boolean
  /** pixelmatch color sensitivity (0–1). Default: 0.1 */
  colorSensitivity?: number
}

export const DEFAULT_DIFF_OPTIONS: Required<DiffOptions> = {
  threshold: 0.02,
  ssimThreshold: 0.98,
  generateDiffImage: true,
  colorSensitivity: 0.1,
}
