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

describe("SubTable 表头与分类", () => {
  it("中文模式下用中文表头", () => {
    const s = ledger([{}]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="zh-CN" {...handlers()} />);
    expect(screen.getByText("分类")).toBeInTheDocument();
    expect(screen.getByText("套餐")).toBeInTheDocument();
    expect(screen.getByText("剩余")).toBeInTheDocument();
  });

  it("英文模式下表头与用途分类都翻译", () => {
    const s = ledger([
      { category: "AI 服务" },
      { category: "开发工具" },
      { category: "云服务 / VPS" },
      { category: "域名 / 网络" },
      { category: "设计创作" },
      { category: "办公协作" },
      { category: "影音娱乐" },
      { category: "其他" },
    ]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="en" {...handlers()} />);
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("AI services")).toBeInTheDocument();
    expect(screen.getByText("Developer tools")).toBeInTheDocument();
    expect(screen.getByText("Cloud / VPS")).toBeInTheDocument();
    expect(screen.getByText("Domains / network")).toBeInTheDocument();
    expect(screen.getByText("Design & creation")).toBeInTheDocument();
    expect(screen.getByText("Productivity")).toBeInTheDocument();
    expect(screen.getByText("Media")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  /** category 是用户数据：自定义分类必须原样显示，不能被翻译或改写。 */
  it("自定义分类在英文模式下原样透出", () => {
    const s = ledger([{ category: "我自己的分类" }]);
    render(<SubTable entries={visibleRowEntries(s, REF_DATE)} language="en" {...handlers()} />);
    expect(screen.getByText("我自己的分类")).toBeInTheDocument();
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
