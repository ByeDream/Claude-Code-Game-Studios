/**
 * Smoke test — verifies the test infrastructure works.
 * @module tests/unit/smoke.test
 */
describe('Test Infrastructure', () => {
  it('should run a basic assertion', () => {
    expect(1 + 1).toBe(2)
  })

  it('should support TypeScript strict mode', () => {
    const value: number = 42
    expect(value).toBe(42)
  })
})
