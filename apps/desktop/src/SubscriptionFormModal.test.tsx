import { loadFromJson, type AppState, type SubscriptionRow } from "@ai-sub/core";
import { invoke } from "@tauri-apps/api/core";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionFormModal, type SubscriptionFormDraft } from "./SubscriptionFormModal";
import type { ConfirmationRequest } from "./ui/ConfirmDialog";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readImage: vi.fn(async () => {
    throw new Error("no image");
  }),
}));

function mockOcr(text: string) {
  vi.mocked(readImage).mockResolvedValueOnce({
    size: async () => ({ width: 2, height: 2 }),
    rgba: async () => new Uint8Array(16),
  } as never);
  vi.mocked(invoke).mockResolvedValueOnce(text);
}

const EMPTY_DRAFT: SubscriptionFormDraft = {
  category: "官方",
  plan: "",
  fee: "",
  subscribedAt: "",
  dueDate: "",
  usage: "",
  subscribed: false,
  expired: false,
  includeInBudget: true,
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
      includeInBudget: true,
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
  onRenew?: (index: number) => void | AppState | Promise<void | AppState>;
};

function setup(over: Overrides = {}) {
  const onCommit = vi.fn();
  const onClose = vi.fn();
  const onNotice = vi.fn();
  const onRenew = over.onRenew ?? vi.fn();
  const onRequestConfirmation = vi.fn<(request: ConfirmationRequest) => void>();
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
      onRenew={onRenew}
      onRequestConfirmation={onRequestConfirmation}
    />
  );
  return { onCommit, onClose, onNotice, onRenew, onRequestConfirmation, state };
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
    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    expect(screen.getByLabelText("Billing model")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

describe("预算选项", () => {
  it("移除订阅状态控件，计入预算默认选中", () => {
    setup();

    expect(screen.queryByText("已订阅")).not.toBeInTheDocument();
    expect(screen.queryByText("标记为已过期")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /计入预算/ })).toBeChecked();
  });

  it("取消计入预算后提交 false，并将新增订阅写为已订阅且未过期", async () => {
    const { onCommit } = setup();

    await userEvent.click(screen.getByRole("checkbox", { name: /计入预算/ }));
    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "__custom__");
    await userEvent.type(screen.getByLabelText("套餐 / 额度"), "ChatGPT Plus");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    expect((onCommit.mock.calls[0][0] as AppState).rows[0]).toMatchObject({
      includeInBudget: false,
      subscribed: true,
      expired: false,
    });
  });
});

describe("续费操作", () => {
  it("仅编辑周期订阅时显示续费按钮", () => {
    const state = ledger([{ billingModel: "月付", dueDate: "2026-08-01" }]);
    setup({
      mode: "edit",
      state,
      editIndex: 0,
      editRow: state.rows[0],
      draft: state.rows[0],
    });

    expect(screen.getByRole("button", { name: "续费" })).toHaveClass("btn--renew");
  });

  it("新增模式和非周期计费不显示续费按钮", () => {
    setup();
    expect(screen.queryByRole("button", { name: "续费" })).not.toBeInTheDocument();
  });

  it("额度包编辑时不显示续费按钮", () => {
    const state = ledger([{ billingModel: "额度包", dueDate: "" }]);
    setup({
      mode: "edit",
      state,
      editIndex: 0,
      editRow: state.rows[0],
      draft: state.rows[0],
    });

    expect(screen.queryByRole("button", { name: "续费" })).not.toBeInTheDocument();
  });

  it("点击续费调用回调并同步新的到期日，同时保留弹窗", async () => {
    const state = ledger([{ billingModel: "月付", dueDate: "2026-08-01" }]);
    const renewedState: AppState = {
      ...state,
      rows: state.rows.map((row, index) =>
        index === 0
          ? { ...row, dueDate: "2026-09-01", subscribed: true, expired: false }
          : row
      ),
    };
    const onRenew = vi.fn(() => renewedState);
    const { onClose } = setup({
      mode: "edit",
      state,
      editIndex: 0,
      editRow: state.rows[0],
      draft: state.rows[0],
      onRenew,
    });

    await userEvent.type(screen.getByLabelText("备注"), "未保存备注");
    await userEvent.click(screen.getByRole("button", { name: "续费" }));

    expect(onRenew).toHaveBeenCalledWith(0);
    await waitFor(() =>
      expect(
        (document.querySelector('input[name="dueDate"]') as HTMLInputElement).value
      ).toBe("2026-09-01")
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("备注")).toHaveValue("未保存备注");
  });
});

describe("服务商与计费方式", () => {
  it("选择服务商后内置套餐自动填充金额与计费方式", async () => {
    const { onCommit } = setup();
    const provider = screen.getByLabelText("服务商");

    expect(provider).toHaveAttribute("list", "sub-provider-options");
    expect(document.querySelectorAll("#sub-provider-options option")).toHaveLength(10);
    await userEvent.clear(provider);
    await userEvent.type(provider, "Claude");
    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "Claude Max 5x");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const added = (onCommit.mock.calls[0][0] as AppState).rows.at(-1)!;
    expect(added.plan).toBe("Claude Max 5x");
    expect(added.fee).toBe("US$100");
    expect(added.category).toBe("AI 服务");
    expect(added.billingModel).toBe("月付");
    expect(added.purchaseChannel).toBe("官方");
    expect(added.provider).toBe("Claude");
  });

  it("可手动输入服务商，提交后保留名称并切换为自定义套餐", async () => {
    const { onCommit } = setup();
    const provider = screen.getByLabelText("服务商");

    await userEvent.clear(provider);
    await userEvent.type(provider, "Canva");
    const plan = screen.getByLabelText("套餐 / 额度");
    expect(plan).toBeInstanceOf(HTMLInputElement);
    await userEvent.type(plan, "Canva Pro");
    await userEvent.type(screen.getByLabelText("金额"), "15");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const added = (onCommit.mock.calls[0][0] as AppState).rows.at(-1)!;
    expect(added).toMatchObject({ provider: "Canva", plan: "Canva Pro", fee: "15", category: "其他" });
  });

  it("团队版按人数计算总价，套餐名带人数后缀", async () => {
    const { onCommit } = setup();

    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "ChatGPT Team");
    // 默认 2 人：$25×2
    expect(screen.getByLabelText("金额")).toHaveValue("50");
    await userEvent.clear(screen.getByLabelText("人"));
    await userEvent.type(screen.getByLabelText("人"), "5");
    expect(screen.getByLabelText("金额")).toHaveValue("125");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const added = (onCommit.mock.calls[0][0] as AppState).rows.at(-1)!;
    expect(added.plan).toBe("ChatGPT Team（5人）");
    expect(added.fee).toBe("US$125");
  });

  it("切换计费周期自动重算金额（年付折扣、季付×3）", async () => {
    setup();

    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "ChatGPT Plus");
    expect(screen.getByLabelText("金额")).toHaveValue("20");
    await userEvent.selectOptions(screen.getByLabelText("计费方式"), "年付");
    expect(screen.getByLabelText("金额")).toHaveValue("200");
    await userEvent.selectOptions(screen.getByLabelText("计费方式"), "季付");
    expect(screen.getByLabelText("金额")).toHaveValue("60");
  });

  it("有折扣的套餐在年付选项上提示省的百分比", async () => {
    setup();
    // 未选内置套餐前，年付选项无提示
    expect(screen.getByRole("option", { name: "年付" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "ChatGPT Plus");
    expect(screen.getByRole("option", { name: "年付（省 17%）" })).toBeInTheDocument();
  });

  it("英文界面提交时仍写入稳定的中文数据值", async () => {
    const { onCommit } = setup({
      language: "en",
      draft: { category: "开发工具" },
    });

    await userEvent.clear(screen.getByLabelText("Provider"));
    await userEvent.type(screen.getByLabelText("Provider"), "My Relay");
    await userEvent.selectOptions(screen.getByLabelText("Billing model"), "年付");
    await userEvent.type(screen.getByLabelText("Plan / credits"), "My Relay");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const next = onCommit.mock.calls[0][0] as AppState;
    const added = next.rows[next.rows.length - 1];
    expect(added.category).toBe("其他");
    expect(added.purchaseChannel).toBe("官方");
    expect(added.billingModel).toBe("年付");
    expect(added.plan).toBe("My Relay");
    expect(added.provider).toBe("My Relay");
  });

  it("额度包无需续费日期", async () => {
    const { onCommit } = setup();

    await userEvent.clear(screen.getByLabelText("服务商"));
    await userEvent.type(screen.getByLabelText("服务商"), "自定义服务商");
    await userEvent.selectOptions(screen.getByLabelText("计费方式"), "额度包");
    expect(screen.getByText("续费日期")).toBeInTheDocument();
    expect(screen.getByText("此计费方式无需续费日期")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("套餐 / 额度"), "额度包 100 元");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const added = (onCommit.mock.calls[0][0] as AppState).rows.at(-1)!;
    expect(added.category).toBe("其他");
    expect(added.billingModel).toBe("额度包");
    expect(added.dueDate).toBe("");
  });

  it("填写实付后提交，actualFee 随订阅保存（含 0）", async () => {
    const { onCommit } = setup();

    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "ChatGPT Team");
    // 默认 2 人：$25×2
    expect(screen.getByLabelText("金额")).toHaveValue("50");
    await userEvent.type(screen.getByLabelText("实付"), "0");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const added = (onCommit.mock.calls[0][0] as AppState).rows.at(-1)!;
    expect(added.fee).toBe("US$50");
    expect(added.actualFee).toBe("US$0");
  });

  it("实付留空时提交，actualFee 为空、口径回退到金额", async () => {
    const { onCommit } = setup();

    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "ChatGPT Plus");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const added = (onCommit.mock.calls[0][0] as AppState).rows.at(-1)!;
    expect(added.fee).toBe("US$20");
    expect(added.actualFee ?? "").toBe("");
  });

  it("选 ChatGPT Plus 后未手改币种，保存为 US$20", async () => {
    const { onCommit } = setup();

    expect(screen.getByRole("radio", { name: "人民币" })).toBeChecked();
    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "ChatGPT Plus");
    expect(screen.getByRole("radio", { name: "美元" })).toBeChecked();
    expect(screen.getByLabelText("金额")).toHaveValue("20");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const added = (onCommit.mock.calls[0][0] as AppState).rows.at(-1)!;
    expect(added.fee).toBe("US$20");
  });

  it("Cursor 默认分类为开发工具", async () => {
    const { onCommit } = setup();
    const provider = screen.getByLabelText("服务商");
    await userEvent.clear(provider);
    await userEvent.type(provider, "Cursor");
    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "Cursor Pro");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const added = (onCommit.mock.calls[0][0] as AppState).rows.at(-1)!;
    expect(added.category).toBe("开发工具");
    expect(added.fee).toBe("US$20");
  });

  it("编辑时给服务商加空格不清空套餐", async () => {
    const state = ledger([{ provider: "OpenAI", plan: "ChatGPT Plus", fee: "US$20" }]);
    setup({
      mode: "edit",
      state,
      editIndex: 0,
      editRow: state.rows[0],
      draft: state.rows[0],
    });

    await userEvent.type(screen.getByLabelText("服务商"), " ");
    expect(screen.getByLabelText("套餐 / 额度")).toHaveValue("ChatGPT Plus");
  });

  it("编辑时保留已有订阅的用途分类", async () => {
    const state = ledger([{ category: "开发工具", provider: "自定义服务商", plan: "Cursor Pro" }]);
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
    expect((onCommit.mock.calls[0][0] as AppState).rows[0].provider).toBe("自定义服务商");
  });
});

describe("金额币种", () => {
  it("新增订阅默认选择人民币", () => {
    setup();

    expect(screen.getByRole("radiogroup", { name: "币种" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "人民币" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "美元" })).not.toBeChecked();
  });

  it("选择美元后以 US$ 前缀保存金额与实付", async () => {
    const { onCommit } = setup();

    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "__custom__");
    await userEvent.type(screen.getByLabelText("套餐 / 额度"), "ChatGPT Plus");
    await userEvent.click(screen.getByRole("radio", { name: "美元" }));
    await userEvent.type(screen.getByLabelText("金额"), "20");
    await userEvent.type(screen.getByLabelText("实付"), "18");

    expect(screen.getByLabelText("金额")).toHaveValue("20");
    expect(screen.getByLabelText("实付")).toHaveValue("18");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const added = (onCommit.mock.calls[0][0] as AppState).rows.at(-1)!;
    expect(added.fee).toBe("US$20");
    expect(added.actualFee).toBe("US$18");
  });

  it("编辑 legacy US$ 金额时保留美元并去掉输入前缀", async () => {
    const state = ledger([{ plan: "Claude Pro", fee: "US$20", actualFee: "US$18" }]);
    const { onCommit } = setup({
      mode: "edit",
      state,
      editIndex: 0,
      editRow: state.rows[0],
      draft: state.rows[0],
    });

    expect(screen.getByRole("radio", { name: "美元" })).toBeChecked();
    expect(screen.getByLabelText("金额")).toHaveValue("20");
    expect(screen.getByLabelText("实付")).toHaveValue("18");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const updated = (onCommit.mock.calls[0][0] as AppState).rows[0];
    expect(updated.fee).toBe("US$20");
    expect(updated.actualFee).toBe("US$18");
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
    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "__custom__");
    await userEvent.type(screen.getByLabelText("套餐 / 额度"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));
    expect(await screen.findByText("请填写套餐名称")).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("英文模式下该提示也翻译", async () => {
    const { onCommit } = setup({ language: "en" });
    await userEvent.selectOptions(screen.getByLabelText("Plan / credits"), "__custom__");
    await userEvent.type(screen.getByLabelText("Plan / credits"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Enter a plan name")).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe("新增与编辑的提交结果", () => {
  it("新增：把表单字段写成一条新订阅", async () => {
    const { onCommit } = setup();

    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "__custom__");
    await userEvent.type(screen.getByLabelText("套餐 / 额度"), "ChatGPT Plus");
    await userEvent.click(screen.getByRole("radio", { name: "美元" }));
    await userEvent.type(screen.getByLabelText("金额"), "20");
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

    const planField = screen.getByLabelText("套餐 / 额度");
    expect(planField).toHaveValue("Claude Pro");

    await userEvent.selectOptions(planField, "__custom__");
    await userEvent.type(screen.getByLabelText("套餐 / 额度"), "Claude Max");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const next = onCommit.mock.calls[0][0] as AppState;
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0].plan).toBe("Claude Max");
    expect(next.rows[0].fee).toBe("US$20");
  });

  it("编辑时保留原订阅状态，并提交计入预算选择", async () => {
    const s = ledger([
      { plan: "Claude Pro", subscribed: true, dueDate: "2026-08-01", expired: true, includeInBudget: true },
    ]);
    const { onCommit } = setup({
      mode: "edit",
      state: s,
      editIndex: 0,
      editRow: s.rows[0],
      draft: s.rows[0],
    });

    await userEvent.click(screen.getByRole("checkbox", { name: /计入预算/ }));
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    expect((onCommit.mock.calls[0][0] as AppState).rows[0]).toMatchObject({
      includeInBudget: false,
      subscribed: true,
      expired: true,
    });
  });
});

describe("关闭", () => {
  it("点取消触发 onClose", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("删除订阅", () => {
  it("请求应用内确认；仅在确认后删除订阅及其关联账单", async () => {
    const state = ledger([{ plan: "Canva Pro" }]);
    const { onClose, onCommit, onNotice, onRequestConfirmation } = setup({
      mode: "edit",
      state,
      editIndex: 0,
      editRow: state.rows[0],
      draft: state.rows[0],
    });

    await userEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(onRequestConfirmation).toHaveBeenCalledOnce();
    const request = onRequestConfirmation.mock.calls[0][0];
    expect(request.message).toBe("确定删除「Canva Pro」及其关联账单？");
    expect(onCommit).not.toHaveBeenCalled();

    request.onConfirm();
    expect((onCommit.mock.calls[0][0] as AppState).rows).toEqual([]);
    expect(onNotice).toHaveBeenCalledWith("已删除");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("不确认时不会删除订阅", async () => {
    const state = ledger([{ plan: "Canva Pro" }]);
    const { onCommit, onRequestConfirmation } = setup({
      mode: "edit",
      state,
      editIndex: 0,
      editRow: state.rows[0],
      draft: state.rows[0],
    });

    await userEvent.click(screen.getByRole("button", { name: "删除" }));

    expect(onRequestConfirmation).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();
  });
});

describe("OCR 匹配已有订阅", () => {
  const ocrBackup = (plan: string, fee: string) =>
    JSON.stringify({ budget: 500, rows: [{ plan, fee }], bills: [] });

  async function matchExisting(plan: string, fee: string) {
    await userEvent.click(screen.getByRole("button", { name: "粘贴快速填充" }));
    mockOcr(ocrBackup(plan, fee));
    await userEvent.click(screen.getByRole("button", { name: "粘贴图片 OCR" }));
    expect(
      await screen.findByText(`已匹配「${plan}」，确认后将为其添加账单`, {
        selector: ".form-match-banner",
      })
    ).toBeInTheDocument();
  }

  it("选美元后按汇率写入账单", async () => {
    const state = ledger([{ plan: "ChatGPT Plus", fee: "US$20", subscribed: true }]);
    const { onCommit } = setup({ state });
    await matchExisting("ChatGPT Plus", "20");

    await userEvent.click(screen.getByRole("checkbox", { name: /计入预算/ }));
    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "ChatGPT Plus");
    vi.mocked(invoke).mockResolvedValueOnce({
      rate: 7.31,
      rateDate: "2026-01-01",
      source: "Frankfurter / ECB reference rates",
    });
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const next = onCommit.mock.calls[0][0] as AppState;
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0].includeInBudget).toBe(false);
    expect(next.bills).toHaveLength(1);
    expect(next.bills[0]).toMatchObject({
      amount: 146.2,
      originalAmount: 20,
      originalCurrency: "USD",
      exchangeRate: 7.31,
      exchangeRateDate: "2026-01-01",
    });
    expect(next.bills[0].subscriptionId).toBe(state.rows[0].id);
  });

  it("匹配过期订阅时恢复兼容状态并同步计入预算选择", async () => {
    const state = ledger([{ plan: "ChatGPT Plus", fee: "US$20", subscribed: true, expired: true }]);
    const { onCommit } = setup({ state });
    await matchExisting("ChatGPT Plus", "20");

    await userEvent.click(screen.getByRole("checkbox", { name: /计入预算/ }));
    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "ChatGPT Plus");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    expect((onCommit.mock.calls[0][0] as AppState).rows[0]).toMatchObject({
      includeInBudget: false,
      subscribed: true,
      expired: false,
    });
  });

  it("实付 0 时不写账单", async () => {
    const state = ledger([{ plan: "ChatGPT Plus", fee: "US$20", subscribed: true }]);
    const { onCommit, onClose } = setup({ state });
    await matchExisting("ChatGPT Plus", "20");

    await userEvent.selectOptions(screen.getByLabelText("套餐 / 额度"), "ChatGPT Plus");
    await userEvent.type(screen.getByLabelText("实付"), "0");
    await userEvent.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onCommit).not.toHaveBeenCalled();
  });
});
