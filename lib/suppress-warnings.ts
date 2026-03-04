/**
 * Suppress known harmless console errors from third-party libraries.
 *
 * THREE.js / three-globe emits "computeBoundingSphere() NaN" errors
 * when its internal geometry buffers are empty during initialization.
 * This is purely cosmetic — the globe renders correctly once data loads.
 *
 * This module must be imported BEFORE any Three.js code runs.
 */

if (typeof window !== 'undefined') {
  const _origConsoleError = console.error.bind(console)
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('computeBoundingSphere') &&
      args[0].includes('NaN')
    ) {
      return // silently suppress this specific THREE.js warning
    }
    _origConsoleError(...args)
  }
}
