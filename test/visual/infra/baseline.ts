import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const BASELINES_DIR = 'test/visual/baselines'
const INDEX_PATH = path.join(BASELINES_DIR, 'index.json')

export type BaselineEntry = {
  key: string
  path: string
  branch: string
  commit: string
  platform: string
  createdAt: number
  hash: string
}

type BaselineIndex = Record<string, BaselineEntry>

function loadIndex(): BaselineIndex {
  if (!fs.existsSync(INDEX_PATH)) return {}
  return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')) as BaselineIndex
}

function saveIndex(index: BaselineIndex): void {
  fs.mkdirSync(BASELINES_DIR, { recursive: true })
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2))
}

function hashFile(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

/** Register a captured screenshot as the new baseline */
export function registerBaseline(
  key: string,
  screenshotPath: string,
  branch: string,
  commit: string,
  platform: string,
): BaselineEntry {
  const index = loadIndex()
  const entry: BaselineEntry = {
    key,
    path: screenshotPath,
    branch,
    commit,
    platform,
    createdAt: Date.now(),
    hash: hashFile(screenshotPath),
  }
  index[key] = entry
  saveIndex(index)
  return entry
}

/** Get the baseline path for a given key, or null if not found */
export function getBaseline(key: string): BaselineEntry | null {
  return loadIndex()[key] ?? null
}

/** Update a baseline from an approved screenshot (promote current → baseline) */
export function promoteToBaseline(
  key: string,
  currentPath: string,
  branch: string,
  commit: string,
  platform: string,
): BaselineEntry {
  const baselinePath = path.join(BASELINES_DIR, path.basename(currentPath))
  fs.copyFileSync(currentPath, baselinePath)
  return registerBaseline(key, baselinePath, branch, commit, platform)
}

/** Remove baselines older than maxAgeDays that are not on the given branches */
export function pruneBaselines(maxAgeDays = 30, keepBranches: string[] = ['main']): number {
  const index = loadIndex()
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  let removed = 0
  for (const [key, entry] of Object.entries(index)) {
    if (entry.createdAt < cutoff && !keepBranches.includes(entry.branch)) {
      if (fs.existsSync(entry.path)) fs.unlinkSync(entry.path)
      delete index[key]
      removed++
    }
  }
  saveIndex(index)
  return removed
}

/** List all baselines, optionally filtered by branch */
export function listBaselines(branch?: string): BaselineEntry[] {
  const index = loadIndex()
  const entries = Object.values(index)
  return branch ? entries.filter((e) => e.branch === branch) : entries
}
