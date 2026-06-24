export type Viewport = {
  name: string
  width: number
  height: number
}

export type ColorScheme = 'light' | 'dark'

export type DPR = 1 | 2 | 3

export type CaptureOptions = {
  viewports?: Viewport[]
  colorSchemes?: ColorScheme[]
  dprs?: DPR[]
  animationsDisabled?: boolean
  /** CSS regions to mask (dynamic content like timestamps) */
  maskRegions?: string[]
}

export type ScreenshotMeta = {
  name: string
  url: string
  viewport: Viewport
  colorScheme: ColorScheme
  dpr: DPR
  browser: string
  timestamp: number
  path: string
}

export const VIEWPORTS: Viewport[] = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 },
]

export const DEFAULT_CAPTURE_OPTIONS: Required<CaptureOptions> = {
  viewports: VIEWPORTS,
  colorSchemes: ['light', 'dark'],
  dprs: [1, 2],
  animationsDisabled: true,
  maskRegions: [],
}
