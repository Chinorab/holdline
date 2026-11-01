import { defineConfig } from 'vitest/config';

// Unit tests run the simulation and pure logic in Node: no DOM, no WebGL, no IWSDK.
export default defineConfig({
  test: {
    include: ['tests/sim/**/*.test.ts', 'tests/logic/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
