import { loadFromJson, type AppState } from "@ai-sub/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MonitorModal } from "./MonitorModal";
import type { ConfirmationRequest } from "./ui/ConfirmDialog";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(() => new Promise<never>(() => {})) }));

function ledger(): AppState {
  return loadFromJson({
    budget: 500,
    language: "zh-CN",
    rows: [],
    bills: [],
    monitors: [
      {
        id: "monitor-1",
        type: "api",
        apiKey: "test-key-one",
        serviceId: "service-one",
        lastChecked: "",
        status: "unknown",
        statusDetail: "",
        remotePlan: "",
        remoteAmount: 0,
        remoteRenewalDate: "",
        errorMessage: "",
      },
      {
        id: "monitor-2",
        type: "api",
        apiKey: "test-key-two",
        serviceId: "service-two",
        lastChecked: "",
        status: "unknown",
        statusDetail: "",
        remotePlan: "",
        remoteAmount: 0,
        remoteRenewalDate: "",
        errorMessage: "",
      },
    ],
  });
}

describe("自动监控删除", () => {
  it("请求确认，确认后只移除选择的监控", async () => {
    const state = ledger();
    const onCommit = vi.fn();
    const onRequestConfirmation = vi.fn<(request: ConfirmationRequest) => void>();
    render(
      <MonitorModal
        state={state}
        onClose={vi.fn()}
        onCommit={onCommit}
        onRequestConfirmation={onRequestConfirmation}
      />
    );

    await userEvent.click(screen.getAllByRole("button", { name: "删除" })[0]);

    expect(onCommit).not.toHaveBeenCalled();
    const request = onRequestConfirmation.mock.calls[0][0];
    expect(request.message).toBe("确定移除此自动监控？");

    request.onConfirm();
    expect((onCommit.mock.calls[0][0] as AppState).monitors.map((monitor) => monitor.id)).toEqual(["monitor-2"]);
  });
});
