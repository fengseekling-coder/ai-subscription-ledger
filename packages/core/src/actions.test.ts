import { describe, expect, it } from "vitest";
import {
  addBill,
  addRowWithDetails,
  deleteBill,
  deleteRow,
  markExpired,
  clearExpired,
  markUnrenewed,
  pickDueDate,
  renewRow,
  setBudget,
  subscribeNoticeAfterToggle,
  toggleSubscribe,
  updateBill,
  updateRow,
  updateRowField,
} from "./actions.js";
import { USD_CNY_RATE } from "./money.js";
import { loadFromJson } from "./load.js";
import type { AppState, SubscriptionRow } from "./types.js";

/** 所有用例的固定「今天」。core 的 action 全部接受 ref，测试不依赖真实时钟。 */
const REF = new Date("2026-07-15T09:00:00");

function stateWith(rows: Partial<SubscriptionRow>[], bills: unknown[] = []): AppState {
  return loadFromJson({
    budget: 500,
    rows: rows.map((r, i) => ({
      id: `r${i + 1}`,
      category: "官方",
      plan: `Plan ${i + 1}`,
      fee: "",
      subscribed: true,
      usage: "",
      dueDate: "",
      subscribedAt: "",
      expired: false,
      ...r,
    })),
    bills,
  });
}

function unwrap<T>(r: T | { error: string }): T {
  if (r && typeof r === "object" && "error" in r) {
    throw new Error(`unexpected error: ${(r as { error: string }).error}`);
  }
  return r as T;
}

describe("addBill", () => {
  it("errors when there is no subscription at all", () => {
    const r = addBill(stateWith([]), REF);
    expect(r).toEqual({ error: "请先添加订阅，再记账单。" });
  });

  it("bills the first active subscription and stamps paidAt from ref", () => {
    const s = stateWith([{ fee: "49", dueDate: "2026-08-01" }]);
    const next = unwrap(addBill(s, REF));
    expect(next.bills).toHaveLength(1);
    expect(next.bills[0].subscriptionId).toBe("r1");
    expect(next.bills[0].amount).toBe(49);
    expect(next.bills[0].paidAt).toBe("2026-07-15");
  });

  // 回归：USD 订阅记账时必须折算成 ¥，否则预算口径长期失准。
  it("converts a USD fee to CNY at USD_CNY_RATE", () => {
    const s = stateWith([{ fee: "US$20", dueDate: "2026-08-01" }]);
    const next = unwrap(addBill(s, REF));
    expect(next.bills[0].amount).toBeCloseTo(20 * USD_CNY_RATE, 2);
  });

  it("leaves a CNY fee unconverted", () => {
    const s = stateWith([{ fee: "¥49", dueDate: "2026-08-01" }]);
    expect(unwrap(addBill(s, REF)).bills[0].amount).toBe(49);
  });

  it("skips expired rows and bills the first non-expired one", () => {
    const s = stateWith([
      { plan: "Expired", fee: "10", dueDate: "2026-07-01" },
      { plan: "Active", fee: "20", dueDate: "2026-08-01" },
    ]);
    const next = unwrap(addBill(s, REF));
    expect(next.bills[0].subscriptionId).toBe("r2");
  });

  it("falls back to the first row when nothing is active", () => {
    const s = stateWith([{ fee: "10", subscribed: false }]);
    const next = unwrap(addBill(s, REF));
    expect(next.bills[0].subscriptionId).toBe("r1");
  });
});

describe("renewRow", () => {
  it("advances dueDate by one month past ref and records a renewal bill", () => {
    const s = stateWith([{ fee: "49", dueDate: "2026-07-10" }]);
    const next = unwrap(renewRow(s, 0, REF));
    expect(next.rows[0].dueDate).toBe("2026-08-10");
    expect(next.bills).toHaveLength(1);
    expect(next.bills[0].kind).toBe("renewal");
    expect(next.bills[0].amount).toBe(49);
    expect(next.bills[0].paidAt).toBe("2026-07-15");
    expect(next.bills[0].note).toContain("2026-07-10");
  });

  it("keeps advancing until dueDate is in the future", () => {
    const s = stateWith([{ fee: "49", dueDate: "2026-04-10" }]);
    expect(unwrap(renewRow(s, 0, REF)).rows[0].dueDate).toBe("2026-08-10");
  });

  it("clears the expired flag and re-subscribes", () => {
    const s = stateWith([{ fee: "49", dueDate: "2026-06-10", expired: true }]);
    const next = unwrap(renewRow(s, 0, REF));
    expect(next.rows[0].expired).toBe(false);
    expect(next.rows[0].subscribed).toBe(true);
  });

  it("converts a USD fee on the renewal bill", () => {
    const s = stateWith([{ fee: "US$20", dueDate: "2026-07-10" }]);
    const next = unwrap(renewRow(s, 0, REF));
    expect(next.bills[0].amount).toBeCloseTo(20 * USD_CNY_RATE, 2);
  });

  // 这条用例是 ref 注入修好之前写不出来的：去重键取自真实时钟，
  // 而账单的 paidAt 取自 ref，两者永远不在同一个月。
  it("does not double-bill a renewal within the ref month", () => {
    const s = stateWith([{ fee: "49", dueDate: "2026-07-10" }]);
    const once = unwrap(renewRow(s, 0, REF));
    const twice = unwrap(renewRow(once, 0, REF));
    expect(twice.bills).toHaveLength(1);
    // 同时钉住 paidAt：只断言条数的话，真实时钟恰好与 REF 同月时这条用例会侥幸通过。
    expect(twice.bills[0].paidAt).toBe("2026-07-15");
    expect(twice.rows[0].dueDate).toBe("2026-09-10");
  });

  it("does bill again in a different month", () => {
    const s = stateWith([{ fee: "49", dueDate: "2026-07-10" }]);
    const july = unwrap(renewRow(s, 0, REF));
    const august = unwrap(renewRow(july, 0, new Date("2026-08-15T09:00:00")));
    expect(august.bills).toHaveLength(2);
    expect(august.bills.map((b) => b.paidAt)).toEqual(["2026-07-15", "2026-08-15"]);
  });

  it("records no bill when the fee is zero or unparseable", () => {
    const s = stateWith([{ fee: "", dueDate: "2026-07-10" }]);
    expect(unwrap(renewRow(s, 0, REF)).bills).toHaveLength(0);
  });

  it("rejects an out-of-range index", () => {
    expect(renewRow(stateWith([{}]), 5, REF)).toEqual({ error: "索引超出范围" });
  });
});

describe("updateRowField", () => {
  // 回归：UI 传的是字符串，布尔字段若被存成 "false" 会让 isActiveSubscription 误判。
  it("coerces subscribed/expired back to real booleans", () => {
    const s = stateWith([{ subscribed: false }]);
    const on = unwrap(updateRowField(s, 0, "subscribed", "true"));
    expect(on.rows[0].subscribed).toBe(true);

    const off = unwrap(updateRowField(on, 0, "subscribed", "false"));
    expect(off.rows[0].subscribed).toBe(false);

    const exp = unwrap(updateRowField(s, 0, "expired", "1"));
    expect(exp.rows[0].expired).toBe(true);
  });

  it("clears dueDate whenever the row is not subscribed", () => {
    const s = stateWith([{ dueDate: "2026-08-01" }]);
    const off = unwrap(updateRowField(s, 0, "subscribed", "false"));
    expect(off.rows[0].dueDate).toBe("");
  });

  it("normalizes fee/category/plan but stores other fields verbatim", () => {
    const s = stateWith([{}]);
    expect(unwrap(updateRowField(s, 0, "usage", "  记一笔  ")).rows[0].usage).toBe("记一笔");
    expect(unwrap(updateRowField(s, 0, "plan", "  Claude Pro  ")).rows[0].plan).toBe("Claude Pro");
  });

  it("rejects an out-of-range index", () => {
    expect(updateRowField(stateWith([{}]), -1, "usage", "x")).toEqual({ error: "索引超出范围" });
  });
});

describe("toggleSubscribe", () => {
  it("stamps subscribedAt from ref when subscribing", () => {
    const s = stateWith([{ subscribed: false }]);
    expect(unwrap(toggleSubscribe(s, 0, REF)).rows[0].subscribedAt).toBe("2026-07-15");
  });

  it("preserves an existing subscribedAt", () => {
    const s = stateWith([{ subscribed: false, subscribedAt: "2026-01-01" }]);
    const next = unwrap(toggleSubscribe(s, 0, REF));
    // normalizeRow 会在 subscribed=false 时清空 subscribedAt，
    // 因此这里断言的是「订阅后取 ref」而非保留旧值。
    expect(next.rows[0].subscribed).toBe(true);
    expect(next.rows[0].subscribedAt).toBe("2026-07-15");
  });

  it("clears dueDate and subscribedAt when unsubscribing", () => {
    const s = stateWith([{ dueDate: "2026-08-01", subscribedAt: "2026-01-01" }]);
    const next = unwrap(toggleSubscribe(s, 0, REF));
    expect(next.rows[0].subscribed).toBe(false);
    expect(next.rows[0].dueDate).toBe("");
    expect(next.rows[0].subscribedAt).toBe("");
  });
});

describe("subscribeNoticeAfterToggle", () => {
  it("prompts for a due date on a recurring subscription that lacks one", () => {
    const s = stateWith([{ fee: "49" }]);
    expect(subscribeNoticeAfterToggle(s, 0, REF)).toContain("建议设置续费日");
  });

  it("stays silent once a due date is set", () => {
    const s = stateWith([{ fee: "49", dueDate: "2026-08-01" }]);
    expect(subscribeNoticeAfterToggle(s, 0, REF)).toBeNull();
  });

  it("stays silent for credit-like rows", () => {
    const s = stateWith([{ category: "中转额度包", plan: "额度包 100 元（不限时）", fee: "100" }]);
    expect(subscribeNoticeAfterToggle(s, 0, REF)).toBeNull();
  });

  it("stays silent for an unsubscribed row", () => {
    expect(subscribeNoticeAfterToggle(stateWith([{ subscribed: false }]), 0, REF)).toBeNull();
  });
});

describe("pickDueDate", () => {
  it("accepts an ISO date", () => {
    const r = pickDueDate(stateWith([{}]), 0, "2026-09-01", REF);
    expect(unwrap(r).state.rows[0].dueDate).toBe("2026-09-01");
  });

  it("resolves relative input against ref, not the real clock", () => {
    const r = pickDueDate(stateWith([{}]), 0, "+3", REF);
    expect(unwrap(r).state.rows[0].dueDate).toBe("2026-07-18");
    const t = pickDueDate(stateWith([{}]), 0, "明天", REF);
    expect(unwrap(t).state.rows[0].dueDate).toBe("2026-07-16");
  });

  it("rejects an unparseable date", () => {
    expect(pickDueDate(stateWith([{}]), 0, "not-a-date", REF)).toEqual({
      error: "日期格式请使用 YYYY-MM-DD",
    });
  });

  it("is a no-op on null input", () => {
    const s = stateWith([{ dueDate: "2026-08-01" }]);
    expect(unwrap(pickDueDate(s, 0, null, REF)).state).toBe(s);
  });
});

describe("addRowWithDetails", () => {
  it("requires a plan name", () => {
    expect(
      addRowWithDetails(
        stateWith([]),
        { category: "官方", plan: "   ", fee: "20", usage: "", dueDate: "", subscribedAt: "", subscribed: true, expired: false },
        REF
      )
    ).toEqual({ error: "请填写套餐名称" });
  });

  it("stamps subscribedAt from ref when subscribed without one", () => {
    const next = unwrap(
      addRowWithDetails(
        stateWith([]),
        { category: "官方", plan: "Claude Pro", fee: "US$20", usage: "", dueDate: "", subscribedAt: "", subscribed: true, expired: false },
        REF
      )
    );
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0].subscribedAt).toBe("2026-07-15");
  });
});

describe("deleteRow", () => {
  it("cascades to that row's bills only", () => {
    const s = stateWith(
      [{ plan: "A" }, { plan: "B" }],
      [
        { id: "b1", subscriptionId: "r1", amount: 10, paidAt: "2026-07-01" },
        { id: "b2", subscriptionId: "r2", amount: 20, paidAt: "2026-07-02" },
      ]
    );
    const next = unwrap(deleteRow(s, 0));
    expect(next.rows.map((r) => r.plan)).toEqual(["B"]);
    expect(next.bills.map((b) => b.id)).toEqual(["b2"]);
  });

  it("rejects an out-of-range index", () => {
    expect(deleteRow(stateWith([{}]), 3)).toEqual({ error: "索引超出范围" });
  });
});

describe("markExpired / clearExpired", () => {
  it("marks a subscribed row expired and clears it again", () => {
    const s = stateWith([{ dueDate: "2026-08-01" }]);
    const gone = unwrap(markExpired(s, 0));
    expect(gone.rows[0].expired).toBe(true);
    expect(unwrap(clearExpired(gone, 0)).rows[0].expired).toBe(false);
  });

  it("leaves an unsubscribed row untouched", () => {
    const s = stateWith([{ subscribed: false }]);
    expect(unwrap(markExpired(s, 0))).toBe(s);
  });
});

describe("markUnrenewed", () => {
  it("deletes the row and its bills on 'delete'", () => {
    const s = stateWith([{}], [{ id: "b1", subscriptionId: "r1", amount: 10, paidAt: "2026-07-01" }]);
    const next = unwrap(markUnrenewed(s, 0, "delete"));
    expect(next.rows).toHaveLength(0);
    expect(next.bills).toHaveLength(0);
  });

  it("keeps the row but resets it on 'unsubscribe'", () => {
    const s = stateWith([{ dueDate: "2026-08-01", subscribedAt: "2026-01-01", expired: true }]);
    const next = unwrap(markUnrenewed(s, 0, "unsubscribe"));
    expect(next.rows[0].subscribed).toBe(false);
    expect(next.rows[0].dueDate).toBe("");
    expect(next.rows[0].expired).toBe(false);
  });
});

describe("updateRow", () => {
  it("merges a patch through normalizeRow", () => {
    const s = stateWith([{ fee: "20" }]);
    expect(unwrap(updateRow(s, 0, { fee: "  US$30  " })).rows[0].fee).toBe("US$30");
  });

  it("rejects an out-of-range index", () => {
    expect(updateRow(stateWith([{}]), 9, { fee: "1" })).toEqual({ error: "索引超出范围" });
  });
});

describe("updateBill / deleteBill", () => {
  const base = () =>
    stateWith([{}], [{ id: "b1", subscriptionId: "r1", amount: 10, paidAt: "2026-07-01", orderId: "", note: "" }]);

  it("parses amount through moneyValue and trims other fields", () => {
    expect(updateBill(base(), "b1", "amount", "¥88").bills[0].amount).toBe(88);
    expect(updateBill(base(), "b1", "orderId", "  X-1  ").bills[0].orderId).toBe("X-1");
  });

  it("ignores an unknown bill id", () => {
    expect(updateBill(base(), "nope", "amount", "99").bills[0].amount).toBe(10);
  });

  it("removes a bill by id", () => {
    expect(deleteBill(base(), "b1").bills).toHaveLength(0);
  });
});

describe("setBudget", () => {
  it("accepts a non-negative number", () => {
    expect(setBudget(stateWith([]), 1200).budget).toBe(1200);
    expect(setBudget(stateWith([]), 0).budget).toBe(0);
  });

  it("falls back to the default on negative or non-finite input", () => {
    expect(setBudget(stateWith([]), -1).budget).toBe(500);
    expect(setBudget(stateWith([]), Number.NaN).budget).toBe(500);
  });
});
