// Extends Vitest's `expect` with jest-dom matchers (toBeInTheDocument, etc.)
// for component tests. Safe to load for every test file, including plain
// node-environment ones, since it only adds matchers and touches no globals
// those tests rely on.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// Unmounts whatever a component test rendered after each test, so one
// test's DOM tree can't leak into the next and produce duplicate-element
// query failures. A no-op for plain node-environment tests that never
// called `render()`.
afterEach(() => {
  cleanup();
});
