export type Lang = "zh-CN" | "en";
export type LangPref = "auto" | Lang;

export const LANGS: { value: LangPref; label: Record<Lang, string> }[] = [
  { value: "auto", label: { "zh-CN": "跟随系统", en: "Follow system" } },
  { value: "zh-CN", label: { "zh-CN": "简体中文", en: "简体中文" } },
  { value: "en", label: { "zh-CN": "English", en: "English" } },
];

export type Dict = {
  brand: string;
  nav: { subs: string; stats: string; expired: string; bills: string; pending: string };
  toolbar: { add: string; addBill: string; catalog: string; theme: string; settings: string };
  dashboard: {
    monthSpend: string;
    budgetLeft: string;
    nextRenew: string;
    totalBudget: (n: string) => string;
    editBudget: string;
    addBudget: string;
    budgetPrefix: string;
    budgetUnit: string;
    noRenew: string;
    overdue: string;
    daysLeft: (n: number) => string;
    due: (d: string) => string;
    summaryLabel: string;
    budgetInputAria: string;
    monitor: string;
    monitorErrors: (n: number) => string;
    monitorConnected: (n: number, errors: number) => string;
    monitorNotChecked: string;
  };
  empty: { title: string; desc: string; add: string; fromCatalog: string };
  notice: { copied: string; failed: string; deleted: string; saved: string };
  settings: {
    title: string;
    language: string;
    languageDesc: string;
    appearance: string;
    appearanceDesc: string;
    themeMode: string;
    themeModeDesc: string;
    accent: string;
    accentDesc: string;
    themeSystem: string;
    themeLight: string;
    themeDark: string;
    security: string;
    securityNote1: string;
    securityNote2: string;
  };
  form: {
    addTitle: string;
    editTitle: string;
    addSubtitle: string;
    editSubtitle: string;
    paste: string;
    pastePlaceholder: string;
    parseText: string;
    parseOcr: string;
    parsing: string;
    basic: string;
    category: string;
    plan: string;
    planPlaceholder: string;
    fee: string;
    feePlaceholder: string;
    dates: string;
    subDate: string;
    dueDate: string;
    other: string;
    note: string;
    notePlaceholder: string;
    subscribed: string;
    subscribedDesc: string;
    expired: string;
    expiredDesc: string;
    delete: string;
    cancel: string;
    add: string;
    save: string;
    adding: string;
    saving: string;
    matched: (plan: string) => string;
    selectDate: string;
    feeError: string;
  };
  table: {
    category: string;
    plan: string;
    fee: string;
    note: string;
    remain: string;
    subscribe: string;
    edit: string;
    nonCycle: string;
    setDate: string;
    expired: string;
    restore: string;
    renewed: string;
    cancel: string;
    delete: string;
    actions: string;
    subscribeTitle: string;
    dueToday: string;
    overdueDays: (n: number) => string;
    daysLeft: (n: number) => string;
    /** 已知分类的展示名；自定义分类原样显示 */
    catOfficial: string;
    catRelay: string;
    catCredit: string;
    unrenewedPrompt: (plan: string) => string;
  };
  stats: {
    byCategory: string;
    category: string;
    active: string;
    monthSpend: string;
    feeRef: string;
    last6Months: string;
  };
  pending: {
    meta: (date: string, left: number, fee: string) => string;
    renewed: string;
    renewedNotice: (plan: string) => string;
    notRenewed: string;
  };
  bills: {
    date: string;
    linkedSub: string;
    amount: string;
    orderId: string;
    note: string;
    deletedSub: string;
    renewalTag: string;
    edit: string;
    editTitle: (plan: string) => string;
    delete: string;
    confirmDelete: string;
    deleted: string;
    empty: string;
    formAddTitle: string;
    formEditTitle: string;
    fieldSub: string;
    fieldAmount: string;
    fieldPaidAt: string;
    fieldOrderId: string;
    fieldNote: string;
    optional: string;
    amountPlaceholder: string;
    cancel: string;
    add: string;
    save: string;
    added: string;
    saved: string;
  };
};

const zh: Dict = {
  brand: "订阅账本",
  nav: { subs: "概览", stats: "统计", expired: "已过期", bills: "账单", pending: "待续费" },
  toolbar: { add: "新增订阅", addBill: "记一笔", catalog: "服务库", theme: "深色", settings: "设置" },
  dashboard: {
    monthSpend: "本月支出",
    budgetLeft: "预算剩余",
    nextRenew: "下一续费",
    totalBudget: (n) => `总预算 ${n}`,
    editBudget: "编辑预算",
    addBudget: "添加预算",
    budgetPrefix: "总预算",
    budgetUnit: "元",
    noRenew: "—",
    overdue: "已过期",
    daysLeft: (n) => `剩余 ${n} 天`,
    due: (d) => d,
    summaryLabel: "本月摘要",
    budgetInputAria: "月预算",
    monitor: "监控",
    monitorErrors: (n) => `${n} 个异常`,
    monitorConnected: (n, errors) =>
      errors > 0 ? `${n} 个服务已连接，${errors} 个异常` : `${n} 个服务已连接`,
    monitorNotChecked: "尚未检查",
  },
  empty: { title: "暂无订阅", desc: "点右上角新增，或从服务库添加", add: "新增订阅", fromCatalog: "从服务库添加" },
  notice: { copied: "已复制", failed: "操作失败", deleted: "已删除", saved: "已保存" },
  settings: {
    title: "设置",
    language: "语言",
    languageDesc: "跟随系统时，按 macOS 偏好设置自动切换。",
    appearance: "外观",
    appearanceDesc: "主题模式与强调色。",
    themeMode: "主题模式",
    themeModeDesc: "跟随系统会按 macOS 外观自动切换浅色或深色。",
    accent: "主题色",
    accentDesc: "用于进度条、焦点与选中态的强调色。",
    themeSystem: "跟随系统",
    themeLight: "浅色",
    themeDark: "深色",
    security: "安全",
    securityNote1: "数据使用 AES-256-GCM 加密后存储在本地。",
    securityNote2: "设备丢失且知密码时，拥有 root 或物理访问者理论上仍可读取。",
  },
  form: {
    addTitle: "新增订阅",
    editTitle: "编辑订阅",
    addSubtitle: "填写套餐与续费信息，或粘贴订单快速填充",
    editSubtitle: "修改套餐、金额与续费日期",
    paste: "粘贴快速填充",
    pastePlaceholder: "粘贴订单文本、邮件或短信内容…",
    parseText: "解析文字",
    parseOcr: "粘贴图片 OCR",
    parsing: "识别中…",
    basic: "基本信息",
    category: "分类",
    plan: "套餐 / 额度",
    planPlaceholder: "例如 ChatGPT Plus",
    fee: "月费",
    feePlaceholder: "例如 $20 或 29.9",
    dates: "日期",
    subDate: "订阅日期",
    dueDate: "续费日期",
    other: "其他",
    note: "备注",
    notePlaceholder: "可选：订单号、账号备注等",
    subscribed: "已订阅",
    subscribedDesc: "计入概览与月费统计",
    expired: "标记为已过期",
    expiredDesc: "不再计入月费",
    delete: "删除",
    cancel: "取消",
    add: "添加",
    save: "保存",
    adding: "添加中…",
    saving: "保存中…",
    matched: (plan) => `已匹配「${plan}」，确认后将为其添加账单`,
    selectDate: "选择日期",
    feeError: "金额格式无效",
  },
  table: {
    category: "分类",
    plan: "套餐",
    fee: "金额",
    note: "备注",
    remain: "剩余",
    subscribe: "订阅",
    edit: "编辑",
    nonCycle: "非周期",
    setDate: "设置日期",
    expired: "已过期",
    restore: "恢复",
    renewed: "已续费",
    cancel: "取消",
    delete: "删除",
    actions: "操作",
    subscribeTitle: "标记为已订阅",
    dueToday: "今天到期",
    overdueDays: (n) => `已过期 ${n} 天`,
    daysLeft: (n) => `剩余 ${n} 天`,
    catOfficial: "官方",
    catRelay: "中转",
    catCredit: "额度",
    unrenewedPrompt: (plan) =>
      `${plan} 未续费：删除条目，还是改为未订阅？\n确定 = 删除，取消 = 改为未订阅`,
  },
  stats: {
    byCategory: "按分类（本月支出）",
    category: "分类",
    active: "有效",
    monthSpend: "本月支出",
    feeRef: "月费参考",
    last6Months: "近 6 个月支出",
  },
  pending: {
    meta: (date, left, fee) => `${date} · 剩余 ${left} 天 · ${fee}`,
    renewed: "已续费",
    renewedNotice: (plan) => `${plan} 已续费`,
    notRenewed: "未续费",
  },
  bills: {
    date: "日期",
    linkedSub: "关联订阅",
    amount: "金额",
    orderId: "订单号",
    note: "备注",
    deletedSub: "（已删除订阅）",
    renewalTag: "续费",
    edit: "改",
    editTitle: (plan) => `编辑「${plan}」这笔账单`,
    delete: "删",
    confirmDelete: "确定删除这笔账单？",
    deleted: "账单已删除",
    empty: "暂无账单",
    formAddTitle: "记一笔账单",
    formEditTitle: "编辑账单",
    fieldSub: "关联订阅",
    fieldAmount: "金额（¥）",
    fieldPaidAt: "付款日期",
    fieldOrderId: "订单号",
    fieldNote: "备注",
    optional: "可选",
    amountPlaceholder: "例如 144",
    cancel: "取消",
    add: "添加",
    save: "保存",
    added: "已添加账单",
    saved: "账单已保存",
  },
};

const en: Dict = {
  brand: "Subscription Ledger",
  nav: { subs: "Overview", stats: "Stats", expired: "Expired", bills: "Bills", pending: "Renewals" },
  toolbar: { add: "Add", addBill: "Add bill", catalog: "Catalog", theme: "Theme", settings: "Settings" },
  dashboard: {
    monthSpend: "This month",
    budgetLeft: "Budget left",
    nextRenew: "Next renewal",
    totalBudget: (n) => `Budget ${n}`,
    editBudget: "Edit budget",
    addBudget: "Add budget",
    budgetPrefix: "Budget",
    budgetUnit: "CNY",
    noRenew: "—",
    overdue: "Overdue",
    daysLeft: (n) => (n === 1 ? "1 day left" : `${n} days left`),
    due: (d) => d,
    summaryLabel: "Monthly summary",
    budgetInputAria: "Monthly budget",
    monitor: "Monitors",
    monitorErrors: (n) => `${n} failing`,
    monitorConnected: (n, errors) =>
      errors > 0 ? `${n} connected, ${errors} failing` : `${n} connected`,
    monitorNotChecked: "Not checked yet",
  },
  empty: { title: "No subscriptions yet", desc: "Add from the toolbar, or pick from the catalog", add: "Add subscription", fromCatalog: "From catalog" },
  notice: { copied: "Copied", failed: "Failed", deleted: "Deleted", saved: "Saved" },
  settings: {
    title: "Settings",
    language: "Language",
    languageDesc: "Follow system matches your macOS locale.",
    appearance: "Appearance",
    appearanceDesc: "Theme mode and accent color.",
    themeMode: "Theme mode",
    themeModeDesc: "System follows your macOS appearance for light or dark.",
    accent: "Accent color",
    accentDesc: "Used for progress bars, focus and selected states.",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    security: "Security",
    securityNote1: "All data is encrypted with AES-256-GCM and stored locally.",
    securityNote2: "If the device is lost and the OS password is known, root or physical access may still expose the data.",
  },
  form: {
    addTitle: "Add subscription",
    editTitle: "Edit subscription",
    addSubtitle: "Enter plan and renewal info, or paste an order to fill in",
    editSubtitle: "Update plan, amount and renewal date",
    paste: "Paste to fill",
    pastePlaceholder: "Paste an order email, message, or receipt…",
    parseText: "Parse text",
    parseOcr: "Paste image (OCR)",
    parsing: "Reading…",
    basic: "Basics",
    category: "Category",
    plan: "Plan / credits",
    planPlaceholder: "e.g. ChatGPT Plus",
    fee: "Monthly fee",
    feePlaceholder: "e.g. $20 or 29.9",
    dates: "Dates",
    subDate: "Subscribed on",
    dueDate: "Next renewal",
    other: "Other",
    note: "Note",
    notePlaceholder: "Optional: order id, account note…",
    subscribed: "Subscribed",
    subscribedDesc: "Count in overview and monthly total",
    expired: "Mark expired",
    expiredDesc: "Excluded from monthly total",
    delete: "Delete",
    cancel: "Cancel",
    add: "Add",
    save: "Save",
    adding: "Adding…",
    saving: "Saving…",
    matched: (plan) => `Matched “${plan}” — submitting will add a bill to it`,
    selectDate: "Pick a date",
    feeError: "Invalid amount",
  },
  table: {
    category: "Category",
    plan: "Plan",
    fee: "Fee",
    note: "Note",
    remain: "Status",
    subscribe: "Subscribe",
    edit: "Edit",
    nonCycle: "One-off",
    setDate: "Set date",
    expired: "Expired",
    restore: "Restore",
    renewed: "Renewed",
    cancel: "Cancel",
    delete: "Delete",
    actions: "Actions",
    subscribeTitle: "Mark as subscribed",
    dueToday: "Due today",
    overdueDays: (n) => (n === 1 ? "1 day overdue" : `${n} days overdue`),
    daysLeft: (n) => (n === 1 ? "1 day left" : `${n} days left`),
    catOfficial: "Official",
    catRelay: "Relay",
    catCredit: "Credits",
    unrenewedPrompt: (plan) =>
      `${plan} was not renewed. Delete the entry, or mark it unsubscribed?\nOK = delete, Cancel = mark unsubscribed`,
  },
  stats: {
    byCategory: "By category (this month)",
    category: "Category",
    active: "Active",
    monthSpend: "This month",
    feeRef: "Monthly fee",
    last6Months: "Last 6 months",
  },
  pending: {
    meta: (date, left, fee) =>
      `${date} · ${left === 1 ? "1 day left" : `${left} days left`} · ${fee}`,
    renewed: "Renewed",
    renewedNotice: (plan) => `${plan} renewed`,
    notRenewed: "Not renewed",
  },
  bills: {
    date: "Date",
    linkedSub: "Subscription",
    amount: "Amount",
    orderId: "Order ID",
    note: "Note",
    deletedSub: "(deleted subscription)",
    renewalTag: "Renewal",
    edit: "Edit",
    editTitle: (plan) => `Edit the ${plan} bill`,
    delete: "Delete",
    confirmDelete: "Delete this bill?",
    deleted: "Bill deleted",
    empty: "No bills yet",
    formAddTitle: "Add a bill",
    formEditTitle: "Edit bill",
    fieldSub: "Subscription",
    fieldAmount: "Amount (CNY)",
    fieldPaidAt: "Paid on",
    fieldOrderId: "Order ID",
    fieldNote: "Note",
    optional: "Optional",
    amountPlaceholder: "e.g. 144",
    cancel: "Cancel",
    add: "Add",
    save: "Save",
    added: "Bill added",
    saved: "Bill saved",
  },
};

export const dicts: Record<Lang, Dict> = { "zh-CN": zh, en };
export const dict: Dict = zh; // legacy export

export function detectSystemLang(): Lang {
  if (typeof navigator === "undefined") return "zh-CN";
  const langs = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || ""];
  for (const l of langs) {
    const code = (l || "").toLowerCase();
    if (code.startsWith("en")) return "en";
    if (code.startsWith("zh")) return "zh-CN";
  }
  return "zh-CN";
}

export function resolveLang(pref: LangPref | undefined): Lang {
  if (pref === "en") return "en";
  if (pref === "zh-CN") return "zh-CN";
  return detectSystemLang();
}

export function tFor(lang: Lang): Dict {
  return dicts[lang] || zh;
}
