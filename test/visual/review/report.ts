import fs from 'fs'
import path from 'path'
import type { DiffResult } from '../diff/types.js'
import type { AnalysisResult } from '../ai/analyzer.js'

export type ReviewEntry = {
  name: string
  baselinePath: string
  currentPath: string
  diffImagePath?: string
  diff: DiffResult
  analysis: AnalysisResult
  status: 'pending' | 'approved' | 'rejected'
}

export type ReviewReport = {
  timestamp: number
  branch: string
  totalTests: number
  passed: number
  failed: number
  entries: ReviewEntry[]
}

const REPORT_PATH = 'test/visual/reports/review.json'

/** Build a Markdown summary suitable for a PR comment */
export function buildPrComment(report: ReviewReport): string {
  const { passed, failed, totalTests, entries } = report
  const icon = failed === 0 ? '✅' : '❌'
  const lines = [
    `## ${icon} Visual Regression Report`,
    `**Branch:** \`${report.branch}\` · **${passed}/${totalTests} passed**`,
    '',
  ]

  const failures = entries.filter((e) => !e.diff.passed)
  if (failures.length === 0) {
    lines.push('No visual regressions detected.')
  } else {
    lines.push(`### ${failures.length} regression(s) found`, '')
    lines.push('| Test | Severity | Pixels diff | SSIM | Fix suggestion |')
    lines.push('|------|----------|-------------|------|---------------|')
    for (const entry of failures) {
      const { severity, fixSuggestion } = entry.analysis
      const pct = (entry.diff.pixelDiffRatio * 100).toFixed(2)
      lines.push(
        `| \`${entry.name}\` | ${severity} | ${pct}% | ${entry.diff.ssimScore.toFixed(3)} | ${fixSuggestion} |`
      )
    }
  }
  return lines.join('\n')
}

/** Persist the review report to disk */
export function saveReport(report: ReviewReport): void {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
}

/** Load existing report if present */
export function loadReport(): ReviewReport | null {
  if (!fs.existsSync(REPORT_PATH)) return null
  return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8')) as ReviewReport
}

/** Approve all entries matching a predicate — supports bulk approve */
export function approveEntries(
  report: ReviewReport,
  predicate: (entry: ReviewEntry) => boolean,
): ReviewReport {
  return {
    ...report,
    entries: report.entries.map((e) =>
      predicate(e) ? { ...e, status: 'approved' } : e,
    ),
  }
}

/** Auto-approve trivial (cosmetic) changes */
export function autoApproveTrivial(report: ReviewReport): ReviewReport {
  return approveEntries(
    report,
    (e) => e.analysis.severity === 'cosmetic' && e.analysis.changeType === 'intentional',
  )
}
