import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyState, type Monitor } from "@ai-sub/core";
import { loadAppState, persistAppState } from "./storage";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const monitor: Monitor = {
  id: "monitor-1",
  type: "api",
  apiKey: "secret",
  serviceId: "openai",
  lastChecked: "2026-07-27T00:00:00.000Z",
  status: "active",
  statusDetail: "API Key 有效",
  remotePlan: "Pay-as-you-go",
  remoteAmount: 12.5,
  remoteRenewalDate: "",
  errorMessage: "",
};

describe("Tauri storage DTO", () => {
  beforeEach(() => {
    invoke.mockReset();
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("persists monitors with the rest of the app state", async () => {
    await persistAppState({ ...createEmptyState(), monitors: [monitor] });

    expect(invoke).toHaveBeenCalledWith("set_app_state", {
      state: expect.objectContaining({ monitors: [monitor] }),
    });
  });

  it("loads monitors and ignores a legacy catalogId field", async () => {
    invoke.mockResolvedValue({
      budget: 500,
      rows: [],
      bills: [],
      monitors: [{ ...monitor, catalogId: "chatgpt-plus" }],
    });

    const state = await loadAppState();

    expect(state.monitors).toEqual([monitor]);
    expect(state.monitors[0]).not.toHaveProperty("catalogId");
  });
});
