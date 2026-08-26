import { loadFromJson, type AppState, type SubscriptionRow } from "@ai-sub/core";
import { describe, expect, it, vi } from "vitest";
import { buildSubTableHandlers } from "./subTableHandlers";
import type { ConfirmationRequest } from "./ui/ConfirmDialog";

function ledger(rows: Partial<SubscriptionRow>[]): AppState {
  return loadFromJson({
    budget: 500,
    language: "zh-CN",
    rows: rows.map((row, index) => ({
      id: `row-${index + 1}`,
      category: "AI 服务",
      purchaseChannel: "官方",
      billingModel: "月付",
      plan: `Plan ${index + 1}`,
      fee: "20",
      subscribed: true,
      subscribedAt: "2026-01-01",
      dueDate: "2026-07-30",
      expired: false,
      usage: "",
      ...row,
    })),
    bills: [
      {
        id: "linked-bill",
        subscriptionId: "row-1",
        amount: 20,
        paidAt: "2026-01-01",
        orderId: "",
        note: "",
        kind: "payment",
      },
    ],
  });
}

function setup(state: AppState) {
  const commit = vi.fn();
  const notice = vi.fn();
  const requestConfirmation = vi.fn<(request: ConfirmationRequest) => void>();
  const handlers = buildSubTableHandlers(
    state,
    commit,
    notice,
    vi.fn(),
    vi.fn(),
    requestConfirmation
  );
  return { commit, notice, requestConfirmation, handlers };
}

describe("订阅表删除确认", () => {
  it("已过期列表的删除先请求确认，确认后才删除订阅及关联账单", () => {
    const state = ledger([{ plan: "ChatGPT Plus", expired: true, dueDate: "" }]);
    const { commit, requestConfirmation, handlers } = setup(state);

    handlers.onDelete(0);

    expect(commit).not.toHaveBeenCalled();
    const request = requestConfirmation.mock.calls[0][0];
    expect(request.message).toBe("确定删除「ChatGPT Plus」及其关联账单？");

    request.onConfirm();
    const next = commit.mock.calls[0][0] as AppState;
    expect(next.rows).toEqual([]);
    expect(next.bills).toEqual([]);
  });

  it("逾期未续费提供明确的删除和改为未订阅操作", () => {
    const state = ledger([{ plan: "Claude Pro" }]);
    const { commit, requestConfirmation, handlers } = setup(state);

    handlers.onMarkUnrenewed(0);

    const request = requestConfirmation.mock.calls[0][0];
    expect(request.confirmLabel).toBe("删除");
    expect(request.secondaryLabel).toBe("改为未订阅");
    expect(commit).not.toHaveBeenCalled();

    request.onSecondary?.();
    const unsubscribed = commit.mock.calls[0][0] as AppState;
    expect(unsubscribed.rows[0]).toMatchObject({ subscribed: false, dueDate: "", expired: false });
    expect(unsubscribed.bills).toHaveLength(1);
  });
});
