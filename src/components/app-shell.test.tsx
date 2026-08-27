// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/investigations",
}));

import { AppShell } from "./app-shell";
import { VoiceConsultantProvider } from "@/lib/voice/voice-context";

describe("AppShell navigation", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("never warns about duplicate React keys, even though 'Investigations' and 'History' intentionally share a destination", () => {
    render(
      <VoiceConsultantProvider>
        <AppShell email="consultant@example.com" onSignOut={() => {}}>
          <p>content</p>
        </AppShell>
      </VoiceConsultantProvider>,
    );

    const duplicateKeyWarning = consoleError.mock.calls.find((call: unknown[]) =>
      String(call[0]).includes("same key"),
    );
    expect(duplicateKeyWarning).toBeUndefined();
  });
});
