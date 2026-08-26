import { loadFromJson, type AppState } from "@ai-sub/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BillsView } from "./BillsView";
import type { ConfirmationRequest } from "./ui/ConfirmDialog";

function ledger(): AppState {
  return loadFromJson({
    budget: 500,
    rows: [
      {
        id: "sub-1",
        category: "AI 服务",
        purchaseChannel: "官方",
        billingModel: "月付",
        plan: "ChatGPT Plus",
        fee: "20",
        subscribed: true,
        subscribedAt: "2026-01-01",
        dueDate: "2026-02-01",
        expired: false,
        usage: "",
      },
    ],
    bills: [
      { id: "bill-1", subscriptionId: "sub-1", amount: 20, paidAt: "2026-01-01", orderId: "a", note: "", kind: "payment" },
      { id: "bill-2", subscriptionId: "sub-1", amount: 20, paidAt: "2026-02-01", orderId: "b", note: "", kind: "renewal" },
    ],
  });
}

describe("账单删除", () => {
  it("请求确认，确认后只删除选中的账单", async () => {
    const state = ledger();
    const onCommit = vi.fn();
    const onNotice = vi.fn();
    const onRequestConfirmation = vi.fn<(request: ConfirmationRequest) => void>();
    render(
      <BillsView
        state={state}
        bills={state.bills}
        onCommit={onCommit}
        onNotice={onNotice}
        onEdit={vi.fn()}
        language="zh-CN"
        onRequestConfirmation={onRequestConfirmation}
      />
    );

    await userEvent.click(screen.getByText("b").closest("tr")!.querySelector("button:last-child")!);

    expect(onCommit).not.toHaveBeenCalled();
    const request = onRequestConfirmation.mock.calls[0][0];
    expect(request.message).toBe("确定删除这笔账单？");

    request.onConfirm();
    expect((onCommit.mock.calls[0][0] as AppState).bills.map((bill) => bill.id)).toEqual(["bill-1"]);
    expect(onNotice).toHaveBeenCalledWith("账单已删除");
  });
});

describe("美元换汇快照", () => {
  it("显示入账时锁定的美元金额、汇率与生效日", () => {
    const state = ledger();
    const bills = [
      {
        ...state.bills[0],
        amount: 146.2,
        originalAmount: 20,
        originalCurrency: "USD" as const,
        exchangeRate: 7.31,
        exchangeRateDate: "2026-01-01",
      },
    ];
    render(
      <BillsView
        state={state}
        bills={bills}
        onCommit={vi.fn()}
        onNotice={vi.fn()}
        onEdit={vi.fn()}
        language="zh-CN"
        onRequestConfirmation={vi.fn()}
      />
    );

    expect(screen.getByText("¥146.2")).toBeInTheDocument();
    expect(screen.getByText("US$20 × 7.31 · 2026-01-01 汇率")).toBeInTheDocument();
  });
});
