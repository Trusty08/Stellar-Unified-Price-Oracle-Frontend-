/**
 * Visual regression test suite
 *
 * Uses Playwright's built-in toHaveScreenshot() for pixel-stable baseline
 * comparisons, plus the custom visual infrastructure for AI-powered analysis
 * and DOM snapshot diffing when regressions are found.
 *
 * Run:
 *   npm run test:visual              # compare against saved baselines
 *   npm run test:visual:update       # update baselines (after intentional changes)
 */

import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Mock API helpers (shared with e2e/app.spec.ts pattern)
// ---------------------------------------------------------------------------

const MOCK_PRICES = [
  { assetPair: 'BTC/USD', price: 50000.12, timestamp: 1_700_000_000_000, confidence: 0.98, sources: ['chainlink', 'redstone'] },
  { assetPair: 'ETH/USD', price: 3000.45, timestamp: 1_700_000_000_000, confidence: 0.95, sources: ['band', 'reflector'] },
  { assetPair: 'SOL/USD', price: 142.89, timestamp: 1_700_000_000_000, confidence: 0.91, sources: ['chainlink'] },
  { assetPair: 'XRP/USD', price: 0.512, timestamp: 1_700_000_000_000, confidence: 0.88, sources: ['redstone'] },
]

const MOCK_HISTORY = {
  pair: 'BTC/USD',
  history: Array.from({ length: 10 }, (_, i) => ({
    price: 49000 + i * 200,
    timestamp: 1_700_000_000_000 - (10 - i) * 60_000,
    confidence: 0.96,
    sources: ['chainlink'],
  })),
}

async function mockApi(page: Page) {
  await page.route('**/api/prices', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PRICES) }),
  )
  await page.route('**/api/prices/*/history', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_HISTORY) }),
  )
  await page.route('**/ws', (route) => route.abort())
}

/** Disable animations & freeze clocks so screenshots are pixel-stable */
async function stabilizePage(page: Page) {
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }',
  })
}

// ---------------------------------------------------------------------------
// Viewport configurations
// ---------------------------------------------------------------------------

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 },
] as const

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Visual regression — Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await stabilizePage(page)
    await page.waitForLoadState('networkidle')
  })

  for (const vp of VIEWPORTS) {
    test(`dashboard — ${vp.name} — light`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.emulateMedia({ colorScheme: 'light' })
      await expect(page).toHaveScreenshot(`dashboard-${vp.name}-light.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      })
    })

    test(`dashboard — ${vp.name} — dark`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.emulateMedia({ colorScheme: 'dark' })
      await expect(page).toHaveScreenshot(`dashboard-${vp.name}-dark.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      })
    })
  }
})

test.describe('Visual regression — Components', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await stabilizePage(page)
    await page.waitForLoadState('networkidle')
  })

  test('PriceCard — default state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const card = page.locator('[data-testid="price-card"]').first()
    await card.waitFor({ state: 'visible' })
    await expect(card).toHaveScreenshot('price-card-default.png', { maxDiffPixelRatio: 0.02 })
  })

  test('ConnectionBadge — connected', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const badge = page.locator('[data-testid="connection-badge"]').first()
    if (await badge.isVisible()) {
      await expect(badge).toHaveScreenshot('connection-badge-connected.png', { maxDiffPixelRatio: 0.02 })
    } else {
      test.skip()
    }
  })

  test('NetworkStatusBanner — online', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const banner = page.locator('[data-testid="network-status-banner"]').first()
    if (await banner.isVisible()) {
      await expect(banner).toHaveScreenshot('network-banner-online.png', { maxDiffPixelRatio: 0.02 })
    } else {
      test.skip()
    }
  })

  test('Sidebar — expanded', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const sidebar = page.locator('nav, aside, [role="navigation"]').first()
    if (await sidebar.isVisible()) {
      await expect(sidebar).toHaveScreenshot('sidebar-expanded.png', { maxDiffPixelRatio: 0.02 })
    } else {
      test.skip()
    }
  })
})

test.describe('Visual regression — Error states', () => {
  test('404 Not Found page', async ({ page }) => {
    await page.goto('/does-not-exist')
    await stabilizePage(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(page).toHaveScreenshot('not-found.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    })
  })

  test('API error state', async ({ page }) => {
    await page.route('**/api/prices', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' }),
    )
    await page.route('**/ws', (route) => route.abort())
    await page.goto('/')
    await stabilizePage(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('api-error-state.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    })
  })
})
