import '@testing-library/jest-dom/vitest'
import { toHaveNoViolations } from 'vitest-axe/dist/matchers.js'
import { expect, vi } from 'vitest'

expect.extend({ toHaveNoViolations })

class ResizeObserverMock {
  observe = () => {}
  unobserve = () => {}
  disconnect = () => {}
}

window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

// matchMedia is not implemented in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// SVGPathElement.getTotalLength is not implemented in jsdom (used by Recharts)
if (typeof SVGPathElement !== 'undefined' && !SVGPathElement.prototype.getTotalLength) {
  SVGPathElement.prototype.getTotalLength = () => 0
}

// HTMLCanvasElement.getContext is not implemented in jsdom and is required by axe-core.
if (typeof HTMLCanvasElement !== 'undefined') {
  const canvasProto = HTMLCanvasElement.prototype as unknown as {
    getContext?: (contextId: string) => CanvasRenderingContext2D | null
  }

  const createCanvasContext = (): CanvasRenderingContext2D =>
    ({
      canvas: null as unknown as HTMLCanvasElement,
      fillText: () => {},
      measureText: () => ({ width: 0 }),
      getImageData: () => ({ data: [] } as unknown as ImageData),
      putImageData: () => {},
      setTransform: () => {},
      drawImage: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} } as unknown as CanvasGradient),
      createRadialGradient: () => ({ addColorStop: () => {} } as unknown as CanvasGradient),
      createPattern: () => null,
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      translate: () => {},
      scale: () => {},
      transform: () => {},
      rotate: () => {},
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      rect: () => {},
      arc: () => {},
      arcTo: () => {},
      quadraticCurveTo: () => {},
      bezierCurveTo: () => {},
      clip: () => {},
      isPointInPath: () => false,
      isPointInStroke: () => false,
      setLineDash: () => {},
      getLineDash: () => [],
      lineDashOffset: 0,
      globalCompositeOperation: 'source-over',
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      filter: 'none',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'low',
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      direction: 'inherit',
      globalAlpha: 1,
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      miterLimit: 10,
      getContextAttributes: () => null,
      addHitRegion: () => {},
      removeHitRegion: () => {},
      drawFocusIfNeeded: () => {},
      scrollPathIntoView: () => {},
      resetTransform: () => {},
      currentTransform: null as unknown as DOMMatrix,
    } as unknown as CanvasRenderingContext2D)

  const overrideContext = function (this: HTMLCanvasElement, contextId: string) {
    if (!contextId) {
      throw new TypeError("Failed to execute 'getContext' on 'HTMLCanvasElement': 1 argument required, but only 0 present.")
    }
    const ctx = createCanvasContext()
    ;(ctx as any).canvas = this
    return ctx
  }

  try {
    canvasProto.getContext = overrideContext as unknown as typeof canvasProto.getContext
  } catch {
    Object.defineProperty(canvasProto, 'getContext', {
      configurable: true,
      writable: true,
      value: overrideContext,
    })
  }

  
}

const computedStyleDefaults = {
  getPropertyValue: (_: string) => '',
  getPropertyPriority: () => '',
  item: () => '',
  getPropertyCSSValue: () => null,
  contains: () => false,
  getPropertyValueByPriority: () => '',
  toString: () => '',
}

const getComputedStyleMock = (_elt: Element, _pseudoElt?: string) =>
  new Proxy(computedStyleDefaults, {
    get(target, prop) {
      if (prop in target) return (target as any)[prop]
      return ''
    },
  })

const overrideGetComputedStyle = (owner: any) => {
  try {
    Object.defineProperty(owner, 'getComputedStyle', {
      configurable: true,
      writable: true,
      value: getComputedStyleMock,
    })
  } catch {
    owner.getComputedStyle = getComputedStyleMock
  }
}

overrideGetComputedStyle(window)
overrideGetComputedStyle(globalThis)
const windowProto = Object.getPrototypeOf(window)
if (windowProto) overrideGetComputedStyle(windowProto)

// Mock fetch globally so components that call the REST API in unit tests
// don't fail with "fetch is not defined".
// Individual tests can override this with vi.spyOn(global, 'fetch') as needed.
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ pair: '', history: [] }),
  text: async () => '',
} as unknown as Response)

