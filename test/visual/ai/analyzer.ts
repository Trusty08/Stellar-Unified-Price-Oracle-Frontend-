import type { DiffResult } from '../diff/types.js'
import type { DomDiff } from '../diff/types.js'

export type Severity = 'cosmetic' | 'minor' | 'major' | 'critical'
export type ChangeType = 'intentional' | 'regression' | 'unknown'

export type AnalysisResult = {
  severity: Severity
  changeType: ChangeType
  affectedComponents: string[]
  rootCauseSuggestion: string
  fixSuggestion: string
  clusterKey: string
}

/**
 * Classify severity based on diff metrics.
 * Rules are heuristic — no ML model dependency, fully deterministic.
 */
export function classifySeverity(diff: DiffResult): Severity {
  const { pixelDiffRatio, ssimScore } = diff
  if (pixelDiffRatio > 0.3 || ssimScore < 0.7) return 'critical'
  if (pixelDiffRatio > 0.1 || ssimScore < 0.85) return 'major'
  if (pixelDiffRatio > 0.02 || ssimScore < 0.95) return 'minor'
  return 'cosmetic'
}

/**
 * Infer change type from DOM diff and pixel metrics.
 * Content-only DOM changes with low pixel diff → likely intentional.
 * Structural DOM changes → regression signal.
 */
export function classifyChangeType(diff: DiffResult, domDiff: DomDiff): ChangeType {
  const hasStructuralChange = domDiff.added.length > 0 || domDiff.removed.length > 0
  const hasAttrChange = domDiff.changed.length > 0

  if (!hasStructuralChange && diff.pixelDiffRatio < 0.05) return 'intentional'
  if (hasStructuralChange && diff.pixelDiffRatio > 0.1) return 'regression'
  if (hasAttrChange && !hasStructuralChange) return 'intentional'
  return 'unknown'
}

/** Extract likely component names from changed DOM selectors */
function extractComponents(domDiff: DomDiff): string[] {
  const all = [
    ...domDiff.added,
    ...domDiff.removed,
    ...domDiff.changed.map((c) => c.selector),
  ]
  const components = new Set<string>()
  for (const selector of all) {
    // Match React component class names (PascalCase-derived e.g. price-card → PriceCard)
    const match = selector.match(/\.([\w-]+)/)
    if (match) {
      const name = match[1]
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('')
      components.add(name)
    }
  }
  return [...components].slice(0, 5)
}

/** Generate a fix suggestion based on diff characteristics */
function buildFixSuggestion(diff: DiffResult, domDiff: DomDiff, severity: Severity): string {
  if (domDiff.changed.length > 0) {
    const first = domDiff.changed[0]
    return `Check CSS property '${first.attribute}' on '${first.selector}' — changed from '${first.from}' to '${first.to}'`
  }
  if (domDiff.removed.length > 0) {
    return `Element removed from DOM: ${domDiff.removed[0]} — check conditional rendering logic`
  }
  if (domDiff.added.length > 0) {
    return `New element added: ${domDiff.added[0]} — verify if intentional`
  }
  if (severity === 'cosmetic') {
    return 'Minor rendering difference — likely anti-aliasing or font rendering. Consider widening threshold.'
  }
  return `Pixel diff ratio ${(diff.pixelDiffRatio * 100).toFixed(1)}%, SSIM ${diff.ssimScore.toFixed(3)}. Review diff image for changed region.`
}

/** Generate a cluster key for grouping similar regressions */
function clusterKey(diff: DiffResult, domDiff: DomDiff): string {
  if (domDiff.changed.length > 0) return `attr:${domDiff.changed[0].attribute}`
  if (domDiff.removed.length > 0) return 'structural:removed'
  if (domDiff.added.length > 0) return 'structural:added'
  if (diff.pixelDiffRatio < 0.01) return 'cosmetic:antialiasing'
  return 'visual:layout'
}

/** Full AI-powered analysis of a visual regression */
export function analyzeRegression(diff: DiffResult, domDiff: DomDiff): AnalysisResult {
  const severity = classifySeverity(diff)
  const changeType = classifyChangeType(diff, domDiff)
  const affectedComponents = extractComponents(domDiff)
  const rootCauseSuggestion = domDiff.changed.length > 0
    ? `CSS attribute '${domDiff.changed[0].attribute}' changed on '${domDiff.changed[0].selector}'`
    : `Visual layout shift detected — check flexbox/grid rules or component re-renders`
  const fixSuggestion = buildFixSuggestion(diff, domDiff, severity)

  return {
    severity,
    changeType,
    affectedComponents,
    rootCauseSuggestion,
    fixSuggestion,
    clusterKey: clusterKey(diff, domDiff),
  }
}
