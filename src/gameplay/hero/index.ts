/**
 * Hero System — Barrel Export
 *
 * Re-exports everything needed by other gameplay systems and UI layers.
 * Import from here rather than from individual files to keep import paths stable.
 *
 * @module src/gameplay/hero
 */

export * from './types'
export * from './heroConfig'
export * from './statCalculation'
export * from './heroFactory'
export * from './testHeroes'
