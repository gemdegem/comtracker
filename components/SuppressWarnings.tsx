'use client'

/**
 * Suppress known harmless console errors from third-party libraries.
 * This module-level side effect runs immediately when the module is imported,
 * BEFORE any React lifecycle / useEffect.
 */

// Apply immediately at module evaluation time (not in useEffect)
if (typeof window !== 'undefined') {
  const origError = console.error.bind(console)
  console.error = (...args: any[]) => {
    // THREE.js / three-globe: empty geometry NaN bounding sphere
    if (
      typeof args[0] === 'string' &&
      args[0].includes('computeBoundingSphere') &&
      args[0].includes('NaN')
    ) {
      return
    }
    origError(...args)
  }
}

export default function SuppressWarnings() {
  return null
}
