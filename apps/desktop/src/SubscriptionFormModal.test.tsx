import { loadFromJson, type AppState, type SubscriptionRow } from "@ai-sub/core";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionFormModal, type SubscriptionFormDraft } from "./SubscriptionFormModal";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readImage: vi.fn(async () => {
    throw new Error("no image");
  }),
}));

const EMPTY_DRAFT: SubscriptionFormDraft = {
  category: "官方",
  plan: "",
  fee: "",
  subscribedAt: "",
  dueDate: "",
  usage: "",
  subscribed: false,
  expired: false,
};

function ledger(rows: Partial<SubscriptionRow>[] = []): AppState {
  return loadFromJson({
    budget: 500,
    rows: rows.map((r, i) => ({
      id: `r${i + 1}`,
      category: "官方",
      plan: `Plan ${i + 1}`,
      fee: "49",
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

type Overrides = {
  mode?: "add" | "edit";
  draft?: Partial<SubscriptionFormDraft>;
  state?: AppState;
  editIndex?: number | null;
  editRow?: SubscriptionRow | null;
  language?: AppState["language"];
};

function setup(over: Overrides = {}) {
  const onCommit = vi.fn();
  const onClose = vi.fn();
  const onNotice = vi.fn();
  const state = over.state ?? ledger();
  render(
    <SubscriptionFormModal
      mode={over.mode ?? "add"}
      draft={{ ...EMPTY_DRAFT, ...over.draft }}
      state={state}
      editIndex={over.editIndex ?? null}
      editRow={over.editRow ?? null}
      language={over.language ?? "zh-CN"}
      onClose={onClose}
      onCommit={onCommit}
      onNotice={onNotice}
    />
  );
  return { onCommit, onClose, onNotice, state };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("标题与副标题", () => {
  it("新增模式（中文）", () => {
    setup();
    expect(screen.getByRole("heading", { name: "新增订阅" })).toBeInTheDocument();
    expect(screen.getByText("填写套餐与续费信息，或粘贴订单快速填充")).toBeInTheDocument();
  });

  it("编辑模式（中文）", () => {
    const s = ledger([{ plan: "Claude Pro" }]);
    setup({ mode: "edit", state: s, editIndex: 0, editRow: s.rows[0] });
    expect(screen.getByRole("heading", { name: "编辑订阅" })).toBeInTheDocument();
    expect(screen.getByText("修改套餐、金额与续费日期")).toBeInTheDocument();
  });

  it("英文模式下标题与字段标签都翻译", () => {
    setup({ language: "en" });
    expect(screen.getByRole("heading", { name: "Add subscription" })).toBeInTheDocument();
    expect(screen.getByLabelText("Purchase channel")).toBeInTheDocument();
    expect(screen.getByLabelText("Billing model")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

describe("购买渠道与计费方式", () => {
  it("英文界面提交时仍写入稳定的中文数据值", async () => {
    const { onCommit } = setup({
      language: "en",
      draft: { category: "开发工具" },
    });

    await userEvent.selectOptions(screen.getByLabelText("Purchase channel"), "中转");
    await userEvent.selectOptions(screen.getByLabelText("Billing model"), "年付");
    await userEvent.type(screen.getByLabelText("Plan / credits"), "My Relay");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const next = onCommit.mock.calls[0][0] as AppState;
    const added = next.rows[next.rows.length - 1];
    expect(added.category).toBe("AI 服务");
    expect(added.purchaseChannel).toBe("中转");
    expect(added.billingModel).toBe("年付");
    expect(added.plan).toBe("My Relay");
  });

  it("额度包无需续费日期", async () => {
    const { onCommit } = setup();

    await userEvent.selectOptions(screen.getByLabelText("计费方式"), "额度包");
    expect(screen.getByText("续费日期")).toBeInTheDocument();
    expect(screen.getByText("此计费方式无需续费日期")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("套餐 / 额度"), "额度包 100 元");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const added = (onCommit.mock.calls[0][0] as AppState).rows.at(-1)!;
    expect(added.category).toBe("AI 服务");
    expect(added.billingModel).toBe("额度包");
    expect(added.dueDate).toBe("");
  });

  it("编辑时保留已有订阅的用途分类", async () => {
    const state = ledger([{ category: "开发工具", plan: "Cursor Pro" }]);
    const { onCommit } = setup({
      mode: "edit",
      state,
      editIndex: 0,
      editRow: state.rows[0],
      draft: state.rows[0],
    });

    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    expect((onCommit.mock.calls[0][0] as AppState).rows[0].category).toBe("开发工具");
  });
});

describe("提交校验", () => {
  /**
   * 套餐名输入框带 required，完全为空时被浏览器原生约束校验拦下，
   * submit 事件根本不会触发（jsdom 行为与浏览器一致），所以这里只断言「没提交」。
   */
  it("套餐名为空时不提交（原生校验拦住）", async () => {
    const { onCommit } = setup();
    await userEvent.click(screen.getByRole("button", { name: "添加" }));
    expect(screen.getByLabelText("套餐 / 额度")).toBeInvalid();
    expect(onCommit).not.toHaveBeenCalled();
  });

  /** 只有空白字符能通过 required，再由 JS 的 trim 校验拦下——这才是提示文案的实际触发路径。 */
  it("只填空白的套餐名由 JS 校验拦下并给出提示", async () => {
    const { onCommit } = setup();
    await userEvent.type(screen.getByLabelText("套餐 / 额度"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));
    expect(await screen.findByText("请填写套餐名称")).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("英文模式下该提示也翻译", async () => {
    const { onCommit } = setup({ language: "en" });
    await userEvent.type(screen.getByLabelText("Plan / credits"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Enter a plan name")).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe("新增与编辑的提交结果", () => {
  it("新增：把表单字段写成一条新订阅", async () => {
    const { onCommit } = setup();

    await userEvent.type(screen.getByLabelText("套餐 / 额度"), "ChatGPT Plus");
    await userEvent.type(screen.getByLabelText("金额"), "US$20");
    await userEvent.type(screen.getByLabelText("备注"), "月付");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const next = onCommit.mock.calls[0][0] as AppState;
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0]).toMatchObject({
      category: "AI 服务",
      purchaseChannel: "官方",
      billingModel: "月付",
      plan: "ChatGPT Plus",
      fee: "US$20",
      usage: "月付",
    });
  });

  it("编辑：预填原值并原地更新，不新增行", async () => {
    const s = ledger([{ plan: "Claude Pro", fee: "US$20", usage: "旧备注" }]);
    const { onCommit } = setup({
      mode: "edit",
      state: s,
      editIndex: 0,
      editRow: s.rows[0],
      draft: {
        category: s.rows[0].category,
        plan: s.rows[0].plan,
        fee: s.rows[0].fee,
        usage: s.rows[0].usage,
        subscribed: true,
      },
    });

    const planInput = screen.getByLabelText("套餐 / 额度");
    expect(planInput).toHaveValue("Claude Pro");

    await userEvent.clear(planInput);
    await userEvent.type(planInput, "Claude Max");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const next = onCommit.mock.calls[0][0] as AppState;
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0].plan).toBe("Claude Max");
    expect(next.rows[0].fee).toBe("US$20");
  });
});

describe("关闭", () => {
  it("点取消触发 onClose", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onClose).toHaveBeenCalled();
  });
});
