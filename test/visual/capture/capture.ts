import type { Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import {
  type CaptureOptions,
  type ScreenshotMeta,
  DEFAULT_CAPTURE_OPTIONS,
} from './types.js'

const BASELINES_DIR = 'test/visual/baselines'

/** Build a deterministic filename for a screenshot */
export function screenshotKey(
  name: string,
  viewport: string,
  colorScheme: string,
  dpr: number,
  browser: string,
): string {
  return `${name}__${viewport}__${colorScheme}__${dpr}x__${browser}.png`
}

/**
 * Capture a single page screenshot with the given options applied.
 * Returns metadata describing what was captured.
 */
export async function capturePage(
  page: Page,
  url: string,
  name: string,
  opts: CaptureOptions = {},
): Promise<ScreenshotMeta[]> {
  const options = { ...DEFAULT_CAPTURE_OPTIONS, ...opts }
  const results: ScreenshotMeta[] = []
  const browser = page.context().browser()?.browserType().name() ?? 'unknown'

  for (const viewport of options.viewports) {
    for (const colorScheme of options.colorSchemes) {
      for (const dpr of options.dprs) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.emulateMedia({ colorScheme })

        if (options.animationsDisabled) {
          await page.addStyleTag({
            content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }',
          })
        }

        const masks = options.maskRegions.map((sel) => page.locator(sel))

        await page.goto(url, { waitUntil: 'networkidle' })

        const filename = screenshotKey(name, viewport.name, colorScheme, dpr, browser)
        const screenshotPath = path.join(BASELINES_DIR, filename)
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true })

        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          mask: masks,
          scale: 'device',
        })

        results.push({
          name,
          url,
          viewport,
          colorScheme,
          dpr,
          browser,
          timestamp: Date.now(),
          path: screenshotPath,
        })
      }
    }
  }

  return results
}

/** Capture only the bounding box of a specific CSS selector */
export async function captureElement(
  page: Page,
  selector: string,
  name: string,
  opts: CaptureOptions = {},
): Promise<string> {
  const options = { ...DEFAULT_CAPTURE_OPTIONS, ...opts }
  const filename = screenshotKey(name, 'element', 'light', 1, 'chromium')
  const screenshotPath = path.join(BASELINES_DIR, 'elements', filename)
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true })

  if (options.animationsDisabled) {
    await page.addStyleTag({
      content: '*, *::before, *::after { animation-duration: 0s !important; }',
    })
  }

  await page.locator(selector).screenshot({ path: screenshotPath })
  return screenshotPath
}
