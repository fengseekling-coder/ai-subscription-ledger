import { loadFromJson, visibleRowEntries, type AppState, type SubscriptionRow } from "@ai-sub/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubTable, type SubTableHandlers } from "./SubTable";

const REF_DATE = new Date("2026-07-31T10:00:00"); // 固定参考日期

function handlers(): SubTableHandlers {
  return {
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onPickDue: vi.fn(),
    onRenew: vi.fn(),
    onMarkUnrenewed: vi.fn(),
    onMarkExpired: vi.fn(),
    onClearExpired: vi.fn(),
    onDelete: vi.fn(),
  };
}

function ledger(rows: Partial<SubscriptionRow>[]): AppState {
  return loadFromJson({
    budget: 500,
    rows: rows.map((r, i) => ({
      id: `r${i + 1}`,
      category: "AI 服务",
      purchaseChannel: "官方",
      billingModel: "月付",
      plan: `Plan ${i + 1}`,
      fee: "",
      subscribed: true,
      usage: "",
      dueDate: "",
      subscribedAt: "2026-01-01",
      expired: false,
      ...r,
    })),
    bills: [],
  });
}

/** 相对固定参考日期的 ISO 日期，让「剩余 N 天」在任何一天跑都稳定。 */
function iso(offsetDays: number): string {
  const d = new Date(REF_DATE);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe("SubTable 表头与账单分类", () => {
  it("中文模式下显示账单分类表头与预算/普通账单", () => {
    const s = ledger([{ includeInBudget: true }, { includeInBudget: false }]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="zh-CN" {...handlers()} />);
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "账单分类",
      "套餐",
      "金额",
      "备注",
      "状态",
      "到期时间",
      "操作",
    ]);
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    expect(screen.getByText("预算账单")).toBeInTheDocument();
    expect(screen.getByText("普通账单")).toBeInTheDocument();
  });

  it("英文模式下显示自然的账单类型文案，且旧数据非 false 归入预算账单", () => {
    const s = ledger([
      { category: "AI 服务", includeInBudget: true },
      { category: "开发工具", includeInBudget: false },
      { category: "自定义分类" },
    ]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="en" {...handlers()} />);
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Bill type",
      "Plan",
      "Fee",
      "Note",
      "Status",
      "Expires",
      "Actions",
    ]);
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    expect(screen.getAllByText("Budget bill")).toHaveLength(2);
    expect(screen.getByText("Regular bill")).toBeInTheDocument();
    expect(screen.queryByText("AI services")).not.toBeInTheDocument();
    expect(screen.queryByText("Developer tools")).not.toBeInTheDocument();
    expect(screen.queryByText("自定义分类")).not.toBeInTheDocument();
  });
});

describe("SubTable 订阅详情与状态", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(REF_DATE);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("长备注完整保留在自己的备注单元格中", () => {
    const longNote = "Account note with renewal details and support contact";
    const s = ledger([{ usage: longNote }]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="en" {...handlers()} />);

    const noteCell = screen.getByText(longNote);
    expect(noteCell).toBeInTheDocument();
    expect(noteCell).toHaveClass("subscription-list__note");
    expect(noteCell.closest("td")?.cellIndex).toBe(3);
  });

  it("不显示订阅日期，到期日期位于状态列之后", () => {
    const dueDate = iso(2);
    const s = ledger([{ fee: "49", subscribedAt: "2026-01-01", dueDate }]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="en" {...handlers()} />);

    const dueCell = screen.getByText(dueDate).closest("td");
    expect(dueCell).not.toBeNull();
    expect(dueCell).toHaveClass("subscription-list__date-cell");
    expect(dueCell?.cellIndex).toBe(5);
    expect(screen.queryByText("2026-01-01")).not.toBeInTheDocument();

    const status = screen.getByText("2 days left");
    const statusCell = status.closest("td");
    expect(statusCell).not.toBeNull();
    expect(statusCell).toHaveClass("subscription-list__status");
    expect(statusCell?.cellIndex).toBe(4);
    expect(statusCell).not.toContainElement(screen.getByText(dueDate));
  });

  it("每行都有始终可见且按原始索引映射的编辑按钮", async () => {
    vi.useRealTimers();
    const s = ledger([
      { plan: "A", dueDate: iso(30) },
      { plan: "B", dueDate: iso(2) },
      { plan: "C", dueDate: iso(1) },
    ]);
    const entries = visibleRowEntries(s, REF_DATE);
    const h = handlers();
    render(<SubTable entries={entries} language="zh-CN" {...h} />);

    const editButtons = screen.getAllByRole("button", { name: "编辑" });
    expect(editButtons).toHaveLength(entries.length);
    for (const button of editButtons) await userEvent.click(button);
    entries.forEach(({ index }, callIndex) => {
      expect(h.onEdit).toHaveBeenNthCalledWith(callIndex + 1, index);
    });
  });
});

describe("SubTable 续费日徽标", () => {
  // 组件内部用 new Date() 计算剩余天数，固定系统时间保证跨天稳定。
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(REF_DATE);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("按剩余天数给出中文文案", () => {
    const s = ledger([{ fee: "49", dueDate: iso(2) }]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="zh-CN" {...handlers()} />);
    expect(screen.getByText("剩余 2 天")).toBeInTheDocument();
  });

  it("英文单复数正确：1 day / 2 days", () => {
    const one = ledger([{ fee: "49", dueDate: iso(1) }]);
    const { unmount } = render(
      <SubTable entries={visibleRowEntries(one, REF_DATE)} language="en" {...handlers()} />
    );
    expect(screen.getByText("1 day left")).toBeInTheDocument();
    unmount();

    const two = ledger([{ fee: "49", dueDate: iso(2) }]);
    render(<SubTable entries={visibleRowEntries(two, REF_DATE)} language="en" {...handlers()} />);
    expect(screen.getByText("2 days left")).toBeInTheDocument();
  });

  it("当天到期显示 Due today", () => {
    const s = ledger([{ fee: "49", dueDate: iso(0) }]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="en" {...handlers()} />);
    expect(screen.getByText("Due today")).toBeInTheDocument();
  });

  it("额度类订阅显示为非周期，不显示剩余天数", () => {
    const s = ledger([
      {
        category: "AI 服务",
        purchaseChannel: "中转",
        billingModel: "额度包",
        plan: "额度包 100 元（不限时）",
        fee: "100",
      },
    ]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="en" {...handlers()} />);
    expect(screen.getByText("One-off")).toBeInTheDocument();
  });
});

describe("SubTable 费用显示", () => {
  it("美元费用保留 $ 并给出约合人民币", () => {
    const s = ledger([{ fee: "US$20", dueDate: iso(5) }]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="zh-CN" {...handlers()} />);
    expect(screen.getByText("$20")).toBeInTheDocument();
    expect(screen.getByText("≈¥144")).toBeInTheDocument();
  });

  it("人民币费用不加约价", () => {
    const s = ledger([{ fee: "49", dueDate: iso(5) }]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="zh-CN" {...handlers()} />);
    expect(screen.getByText("49")).toBeInTheDocument();
    expect(screen.queryByText(/≈¥/)).not.toBeInTheDocument();
  });

  it("设置实付（含 0）后金额列只显示实付，不显示原定价", () => {
    const s = ledger([{ fee: "US$75", actualFee: "0", dueDate: iso(5) }]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="zh-CN" {...handlers()} />);
    // 主文案是实付 0；原定价和约合人民币均不在列表中重复显示。
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("$75")).not.toBeInTheDocument();
    expect(screen.queryByText(/≈¥/)).not.toBeInTheDocument();
  });

  it("实付非 0 时金额列不显示原定价", () => {
    const s = ledger([{ fee: "75", actualFee: "30", dueDate: iso(5) }]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="zh-CN" {...handlers()} />);
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.queryByText("75")).not.toBeInTheDocument();
  });
});

describe("SubTable 索引映射", () => {
  /**
   * 表格显示的是排序后的顺序，而 handler 收的是 state.rows 的下标。
   * entries 必须把原始 index 带下去，否则点第一行会改到别的订阅。
   */
  it("点击排序后的第一行，回调收到的是该行在 state.rows 里的原始下标", async () => {
    const s = ledger([
      { plan: "A-远期", dueDate: iso(300) },
      { plan: "B-未订阅", subscribed: false, dueDate: "" },
      { plan: "C-最紧急", fee: "49", dueDate: iso(1) },
    ]);
    const entries = visibleRowEntries(s, REF_DATE);
    // 最紧急的排在最前，它在 state.rows 里的下标是 2
    expect(entries[0].row.plan).toBe("C-最紧急");
    expect(entries[0].index).toBe(2);

    const h = handlers();
    render(<SubTable entries={entries} language="zh-CN" {...h} />);

    await userEvent.click(screen.getAllByRole("button", { name: "编辑" })[0]);
    expect(h.onEdit).toHaveBeenCalledWith(2);
  });

  it("未订阅行的「订阅」按钮传原始下标", async () => {
    const s = ledger([
      { plan: "A", fee: "49", dueDate: iso(1) },
      { plan: "B", subscribed: false, dueDate: "" },
    ]);
    const h = handlers();
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="zh-CN" {...h} />);

    await userEvent.click(screen.getByRole("button", { name: "订阅" }));
    expect(h.onToggle).toHaveBeenCalledWith(1);
  });
});

describe("SubTable 空态", () => {
  it("没有条目时给出空态文案", () => {
    render(<SubTable entries={[]} language="en" {...handlers()} />);
    expect(screen.getByText("No subscriptions yet")).toBeInTheDocument();
  });

  it("空态自身就是唯一的卡片容器，不再额外渲染表格卡片", () => {
    render(<SubTable entries={[]} language="zh-CN" {...handlers()} />);
    expect(document.querySelectorAll(".empty-state")).toHaveLength(1);
    expect(document.querySelector(".table-card")).not.toBeInTheDocument();
    expect(document.querySelector(".list-container")).not.toBeInTheDocument();
  });
});
