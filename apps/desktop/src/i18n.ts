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
  toolbar: { add: string; catalog: string; search: string; theme: string; settings: string };
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
  };
  empty: { title: string; desc: string; add: string; fromCatalog: string };
  notice: { copied: string; failed: string; deleted: string; saved: string };
  settings: {
    title: string;
    language: string;
    languageDesc: string;
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
  };
};

const zh: Dict = {
  brand: "订阅账本",
  nav: { subs: "概览", stats: "统计", expired: "已过期", bills: "账单", pending: "待续费" },
  toolbar: { add: "新增订阅", catalog: "服务库", search: "搜索", theme: "深色", settings: "设置" },
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
  },
  empty: { title: "暂无订阅", desc: "点右上角新增，或从服务库添加", add: "新增订阅", fromCatalog: "从服务库添加" },
  notice: { copied: "已复制", failed: "操作失败", deleted: "已删除", saved: "已保存" },
  settings: {
    title: "设置",
    language: "语言",
    languageDesc: "跟随系统时，按 macOS 偏好设置自动切换。",
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
  },
};

const en: Dict = {
  brand: "Subscription Ledger",
  nav: { subs: "Overview", stats: "Stats", expired: "Expired", bills: "Bills", pending: "Renewals" },
  toolbar: { add: "Add", catalog: "Catalog", search: "Search", theme: "Theme", settings: "Settings" },
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
    daysLeft: (n) => `${n} days left`,
    due: (d) => d,
  },
  empty: { title: "No subscriptions yet", desc: "Add from the toolbar, or pick from the catalog", add: "Add subscription", fromCatalog: "From catalog" },
  notice: { copied: "Copied", failed: "Failed", deleted: "Deleted", saved: "Saved" },
  settings: {
    title: "Settings",
    language: "Language",
    languageDesc: "Follow system matches your macOS locale.",
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
