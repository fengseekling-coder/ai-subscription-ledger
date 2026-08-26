import { loadFromJson, pendingRenewItems, type AppState, type SubscriptionRow } from "@ai-sub/core";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PendingView } from "./PendingView";
import type { ConfirmationRequest } from "./ui/ConfirmDialog";

const REF_DATE = new Date("2026-07-31T10:00:00"); // 固定参考日期，确保测试可重现

function iso(offsetDays: number): string {
  const d = new Date(REF_DATE);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function ledger(rows: Partial<SubscriptionRow>[]): AppState {
  return loadFromJson({
    budget: 500,
    rows: rows.map((r, i) => ({
      id: `r${i + 1}`,
      category: "官方",
      plan: `Plan ${i + 1}`,
      fee: "49",
      subscribed: true,
      usage: "",
      dueDate: iso(1),
      subscribedAt: "2026-01-01",
      expired: false,
      ...r,
    })),
    bills: [],
  });
}

function renderPending(state: AppState, language: AppState["language"] = "zh-CN") {
  const onCommit = vi.fn();
  const showNotice = vi.fn();
  const onRequestConfirmation = vi.fn<(request: ConfirmationRequest) => void>();
  const view = render(
    <PendingView
      state={{ ...state, language }}
      pending={pendingRenewItems(state.rows, REF_DATE)}
      onCommit={onCommit}
      showNotice={showNotice}
      onRequestConfirmation={onRequestConfirmation}
    />
  );
  return { ...view, onCommit, showNotice, onRequestConfirmation };
}

describe("PendingView 费用显示", () => {
  /**
   * 回归：这里曾用 fmtMoney(moneyValue(fee))，moneyValue 只取数字、fmtMoney 无条件
   * 加 ¥ 前缀，于是 US$20 被显示成「¥20」——货币符号错误，金额少一个汇率倍数。
   */
  it("美元订阅保留 $ 并给出约合人民币，不显示成 ¥20", () => {
    renderPending(ledger([{ plan: "Claude Pro", fee: "US$20" }]));
    const meta = document.querySelector(".renew-item__meta")?.textContent ?? "";
    expect(meta).toContain("$20");
    expect(meta).toContain("≈¥144");
    // 「¥20」后面不能紧跟数字，否则会把 ≈¥144 里的片段也算进来
    expect(meta).not.toMatch(/(?<!≈)¥20(?!\d)/);
  });

  it("待续费展示实付而不是定价", () => {
    renderPending(ledger([{ plan: "Claude Pro", fee: "75", actualFee: "30" }]));
    const meta = document.querySelector(".renew-item__meta")?.textContent ?? "";
    expect(meta).toContain("30");
    expect(meta).not.toContain("75");
  });

  it("人民币订阅原样显示，不加约价", () => {
    renderPending(ledger([{ plan: "中转月卡", fee: "49" }]));
    const meta = document.querySelector(".renew-item__meta");
    expect(meta?.textContent).toContain("49");
    expect(meta?.textContent).not.toContain("≈¥");
  });
});

describe("PendingView 元信息", () => {
  it("中文模式给出日期与剩余天数", () => {
    renderPending(ledger([{ fee: "49", dueDate: iso(2) }]));
    const meta = document.querySelector(".renew-item__meta");
    expect(meta?.textContent).toContain(iso(2));
    expect(meta?.textContent).toContain("剩余 2 天");
  });

  it("英文模式翻译并处理单复数", () => {
    renderPending(ledger([{ fee: "49", dueDate: iso(1) }]), "en");
    expect(document.querySelector(".renew-item__meta")?.textContent).toContain("1 day left");

    cleanup();
    renderPending(ledger([{ fee: "49", dueDate: iso(2) }]), "en");
    expect(document.querySelector(".renew-item__meta")?.textContent).toContain("2 days left");
  });

  it("英文模式下按钮文案翻译", () => {
    renderPending(ledger([{ fee: "49" }]), "en");
    expect(screen.getByRole("button", { name: "Renewed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not renewed" })).toBeInTheDocument();
  });
});

describe("PendingView 列表内容", () => {
  it("只列出 3 天内待续费的订阅", () => {
    const s = ledger([
      { plan: "紧急", fee: "49", dueDate: iso(1) },
      { plan: "还早", fee: "49", dueDate: iso(30) },
    ]);
    renderPending(s);
    expect(screen.getByText("紧急")).toBeInTheDocument();
    expect(screen.queryByText("还早")).not.toBeInTheDocument();
  });

  it("按紧急程度排序", () => {
    const s = ledger([
      { plan: "第二", fee: "49", dueDate: iso(2) },
      { plan: "第一", fee: "49", dueDate: iso(0) },
    ]);
    renderPending(s);
    const plans = Array.from(document.querySelectorAll(".renew-item__plan")).map(
      (e) => e.textContent
    );
    expect(plans).toEqual(["第一", "第二"]);
  });

  it("未续费请求明确操作，未确认时不改变订阅", async () => {
    const state = ledger([{ plan: "即将到期", fee: "49", dueDate: iso(1) }]);
    const { onCommit, onRequestConfirmation } = renderPending(state);

    await userEvent.click(screen.getByRole("button", { name: "未续费" }));

    expect(onCommit).not.toHaveBeenCalled();
    const request = onRequestConfirmation.mock.calls[0][0];
    expect(request.confirmLabel).toBe("删除");
    expect(request.secondaryLabel).toBe("改为未订阅");

    request.onSecondary?.();
    expect((onCommit.mock.calls[0][0] as AppState).rows[0].subscribed).toBe(false);
  });
});
