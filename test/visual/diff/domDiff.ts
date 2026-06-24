import type { Page } from '@playwright/test'
import type { DomDiff } from './types.js'

export type SerializedNode = {
  tag: string
  id?: string
  classes: string[]
  attrs: Record<string, string>
  children: SerializedNode[]
}

/** Serialize the DOM tree from the page for snapshot comparison */
export async function serializeDom(page: Page, selector = 'body'): Promise<SerializedNode> {
  return page.evaluate((sel) => {
    function serialize(el: Element): SerializedNode {
      const attrs: Record<string, string> = {}
      for (const attr of Array.from(el.attributes) as Attr[]) {
        // Skip dynamic attributes
        if (['data-testid', 'aria-owns'].includes(attr.name)) continue
        attrs[attr.name] = attr.value
      }
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        classes: Array.from(el.classList).sort() as string[],
        attrs,
        children: Array.from(el.children).map(serialize),
      }
    }
    const root = document.querySelector(sel)
    if (!root) throw new Error(`Selector not found: ${sel}`)
    return serialize(root)
  }, selector)
}

/** Flatten a serialized tree to a list of CSS-path strings for diffing */
function flattenPaths(node: SerializedNode, prefix = ''): string[] {
  const self = `${prefix}${node.tag}${node.id ? `#${node.id}` : ''}${node.classes.map((c) => `.${c}`).join('')}`
  return [self, ...node.children.flatMap((child) => flattenPaths(child, `${self} > `))]
}

/** Compare two serialized DOM trees and return a structured diff */
export function diffDom(baseline: SerializedNode, current: SerializedNode): DomDiff {
  const baselinePaths = new Set(flattenPaths(baseline))
  const currentPaths = new Set(flattenPaths(current))

  const added = [...currentPaths].filter((p) => !baselinePaths.has(p))
  const removed = [...baselinePaths].filter((p) => !currentPaths.has(p))

  // Attribute-level diffs on shared elements
  const changed: DomDiff['changed'] = []
  function compareAttrs(a: SerializedNode, b: SerializedNode, path: string) {
    for (const [key, val] of Object.entries(b.attrs)) {
      if (a.attrs[key] !== val) {
        changed.push({ selector: path, attribute: key, from: a.attrs[key] ?? '(none)', to: val })
      }
    }
    const minChildren = Math.min(a.children.length, b.children.length)
    for (let i = 0; i < minChildren; i++) {
      compareAttrs(a.children[i], b.children[i], `${path} > ${b.children[i].tag}:nth-child(${i + 1})`)
    }
  }
  compareAttrs(baseline, current, baseline.tag)

  return { added, removed, changed }
}
