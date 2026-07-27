export type Lang = "zh-CN" | "en";
export type LangPref = "auto" | Lang;

export const LANGS: { value: LangPref; label: Record<Lang, string> }[] = [
  { value: "auto", label: { "zh-CN": "跟随系统", en: "Follow system" } },
  { value: "zh-CN", label: { "zh-CN": "简体中文", en: "简体中文" } },
  { value: "en", label: { "zh-CN": "English", en: "English" } },
];

export type Dict = {
  brand: string;
  common: { close: string };
  nav: { subs: string; stats: string; expired: string; bills: string; pending: string };
  toolbar: { add: string; addBill: string; theme: string; settings: string };
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
  empty: { title: string; desc: string; add: string };
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
    monitorTitle: string;
    monitorDesc: string;
    monitorConfigured: (n: number) => string;
    monitorManage: string;
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
    preset: string;
    presetPlaceholder: string;
    presetHint: string;
    presetGroups: Record<"对话与助手" | "AI 编程" | "创作与媒体" | "模型 API", string>;
    category: string;
    categoryOptions: Record<
      | "AI 服务"
      | "开发工具"
      | "云服务 / VPS"
      | "域名 / 网络"
      | "设计创作"
      | "办公协作"
      | "影音娱乐"
      | "其他",
      string
    >;
    purchaseChannel: string;
    purchaseChannelOptions: Record<"官方" | "中转", string>;
    billingModel: string;
    billingModelOptions: Record<"月付" | "年付" | "按量计费" | "额度包", string>;
    plan: string;
    planPlaceholder: string;
    fee: string;
    feePlaceholder: string;
    dates: string;
    subDate: string;
    dueDate: string;
    noRenewalDate: string;
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
    feeError: string;
    categoryRequired: string;
    planRequired: string;
    subDateInvalid: string;
    dueDateInvalid: string;
    clipboardNoImage: string;
    ocrNoText: string;
    ocrFailed: (msg: string) => string;
    noMatchedSub: string;
    filled: (n: number) => string;
    noFillable: string;
    restoreFailed: string;
    billAdded: (plan: string, amount: string) => string;
    confirmDelete: (plan: string) => string;
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
    unrenewedPrompt: (plan: string) => string;
    confirmDeleteRow: string;
    renewedNotice: (plan: string, due: string) => string;
    deletedNotice: (plan: string) => string;
    unsubscribedNotice: (plan: string) => string;
  };
  monitor: {
    title: string;
    service: string;
    statusActive: string;
    statusExpired: string;
    statusError: string;
    statusUnknown: string;
    statusOther: string;
    lastChecked: (when: string) => string;
    notChecked: string;
    checking: string;
    refresh: string;
    remove: string;
    verifyFailed: (msg: string) => string;
    verifyOk: (detail: string) => string;
    cancel: string;
    testing: string;
    testConnection: string;
    add: string;
    desc: string;
    planLabel: (plan: string) => string;
    dueLabel: (date: string) => string;
    refreshAll: string;
    keyValid: string;
    addMonitor: string;
  };
  app: {
    trayNext: (plan: string, date: string) => string;
    trayNextNone: string;
    loadFailed: string;
    loadFailedHint: string;
    retry: string;
    loading: string;
    remindersOnTitle: string;
    remindersOffTitle: string;
    remindersTurnOff: string;
    remindersTurnOn: string;
    pagesNav: string;
    fallbackPlan: string;
    langSwitched: string;
  };
  duePicker: {
    title: string;
    label: string;
    cancel: string;
    confirm: string;
  };
  calendar: {
    placeholder: string;
    prevMonth: string;
    nextMonth: string;
  };
  stats: {
    byCategory: string;
    category: string;
    active: string;
    monthSpend: string;
    feeRef: string;
    last6Months: string;
    noData: string;
    billCount: (n: number) => string;
  };
  reminders: {
    noneWithin3Days: string;
    item: (plan: string, due: string, left: number) => string;
    prefix: string;
    notificationTitle: string;
    permissionDenied: string;
    turnedOn: string;
    turnedOff: string;
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
  common: { close: "关闭" },
  nav: { subs: "概览", stats: "统计", expired: "已过期", bills: "账单", pending: "待续费" },
  toolbar: { add: "新增订阅", addBill: "记一笔", theme: "深色", settings: "设置" },
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
  empty: { title: "暂无订阅", desc: "新增一条订阅，套餐预设可在表单内选择", add: "新增订阅" },
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
    monitorTitle: "自动监控",
    monitorDesc: "通过 API Key 自动查询订阅状态。",
    monitorConfigured: (n) => `已配置 ${n} 个监控`,
    monitorManage: "管理",
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
    preset: "AI 套餐预设",
    presetPlaceholder: "选择套餐快速填充（可选）",
    presetHint: "参考价会随地区、税费与官方调整变化，填写前请核对账单。",
    presetGroups: {
      "对话与助手": "对话与助手",
      "AI 编程": "AI 编程",
      "创作与媒体": "创作与媒体",
      "模型 API": "模型 API",
    },
    category: "用途分类",
    categoryOptions: {
      "AI 服务": "AI 服务",
      "开发工具": "开发工具",
      "云服务 / VPS": "云服务 / VPS",
      "域名 / 网络": "域名 / 网络",
      "设计创作": "设计创作",
      "办公协作": "办公协作",
      "影音娱乐": "影音娱乐",
      "其他": "其他",
    },
    purchaseChannel: "购买渠道",
    purchaseChannelOptions: {
      官方: "官方",
      中转: "中转",
    },
    billingModel: "计费方式",
    billingModelOptions: {
      月付: "月付",
      年付: "年付",
      按量计费: "按量计费",
      额度包: "额度包",
    },
    plan: "套餐 / 额度",
    planPlaceholder: "例如 ChatGPT Plus",
    fee: "金额",
    feePlaceholder: "例如 $20 或 29.9",
    dates: "日期",
    subDate: "订阅日期",
    dueDate: "续费日期",
    noRenewalDate: "此计费方式无需续费日期",
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
    feeError: "金额格式无效",
    categoryRequired: "请选择分类",
    planRequired: "请填写套餐名称",
    subDateInvalid: "订阅日期格式无效",
    dueDateInvalid: "续费日期格式无效",
    clipboardNoImage: "剪贴板无图片",
    ocrNoText: "未识别到文字",
    ocrFailed: (msg) => `图片识别失败：${msg}`,
    noMatchedSub: "未匹配到已有订阅，请手动选择或新建",
    filled: (n) => `已填充 ${n} 个字段`,
    noFillable: "未识别到可填充的字段",
    restoreFailed: "恢复订阅失败",
    billAdded: (plan, amount) => `已为「${plan}」添加账单 ${amount} 元`,
    confirmDelete: (plan) => `确定删除「${plan}」？`,
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
    unrenewedPrompt: (plan) =>
      `${plan} 未续费：删除条目，还是改为未订阅？\n确定 = 删除，取消 = 改为未订阅`,
    confirmDeleteRow: "确定删除这一行？",
    renewedNotice: (plan, due) => `${plan} 已续费，续费日 → ${due}`,
    deletedNotice: (plan) => `${plan} 已删除。`,
    unsubscribedNotice: (plan) => `${plan} 已改为未订阅。`,
  },
  monitor: {
    title: "自动监控",
    service: "服务",
    statusActive: "正常",
    statusExpired: "已过期",
    statusError: "错误",
    statusUnknown: "待检查",
    statusOther: "未知",
    lastChecked: (when) => `上次检查: ${when}`,
    notChecked: "尚未检查",
    checking: "检查中…",
    refresh: "刷新",
    remove: "删除",
    verifyFailed: (msg) => `验证失败: ${msg}`,
    verifyOk: (detail) => `验证通过 — ${detail}`,
    cancel: "取消",
    testing: "验证中…",
    testConnection: "测试连接",
    add: "添加",
    desc: "填入 API Key，自动查询订阅状态。Key 随数据加密存储在本地。",
    planLabel: (plan) => `套餐: ${plan}`,
    dueLabel: (date) => `续费日: ${date}`,
    refreshAll: "全部刷新",
    keyValid: "API Key 有效",
    addMonitor: "添加监控",
  },
  app: {
    trayNext: (plan, date) => `下一续费：${plan} · ${date}`,
    trayNextNone: "下一续费：—",
    loadFailed: "加载数据失败",
    loadFailedHint: "数据加载失败，请重启应用或检查数据文件。",
    retry: "重试",
    loading: "加载中…",
    remindersOnTitle: "续费提醒已开",
    remindersOffTitle: "续费提醒已关",
    remindersTurnOff: "关闭续费提醒",
    remindersTurnOn: "开启续费提醒",
    pagesNav: "页面",
    fallbackPlan: "订阅",
    langSwitched: "语言：简体中文",
  },
  duePicker: {
    title: "设置续费日",
    label: "续费日",
    cancel: "取消",
    confirm: "确定",
  },
  calendar: {
    placeholder: "选择日期",
    prevMonth: "上个月",
    nextMonth: "下个月",
  },
  stats: {
    byCategory: "按分类（本月支出）",
    category: "分类",
    active: "有效",
    monthSpend: "本月支出",
    feeRef: "月费参考",
    last6Months: "近 6 个月支出",
    noData: "暂无数据",
    billCount: (n) => `${n} 笔`,
  },
  reminders: {
    noneWithin3Days: "当前没有 3 天内需要续费的已订阅套餐。",
    item: (plan, due, left) => `${plan}（${due}，剩 ${left} 天）`,
    prefix: "续费提醒：",
    notificationTitle: "订阅续费提醒",
    permissionDenied: "未授权通知，仍可在应用内看到提醒。",
    turnedOn: "已开启续费提醒。打开应用时会检查 3 天内续费。",
    turnedOff: "已关闭续费提醒。",
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
  common: { close: "Close" },
  nav: { subs: "Overview", stats: "Stats", expired: "Expired", bills: "Bills", pending: "Renewals" },
  toolbar: { add: "Add", addBill: "Add bill", theme: "Theme", settings: "Settings" },
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
  empty: { title: "No subscriptions yet", desc: "Add a subscription and optionally choose a plan preset in the form", add: "Add subscription" },
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
    monitorTitle: "Automatic monitoring",
    monitorDesc: "Query subscription status automatically via API key.",
    monitorConfigured: (n) => (n === 1 ? "1 monitor configured" : `${n} monitors configured`),
    monitorManage: "Manage",
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
    preset: "AI plan preset",
    presetPlaceholder: "Choose a plan to fill fields (optional)",
    presetHint: "Reference prices vary by region, tax and provider updates. Check your bill before saving.",
    presetGroups: {
      "对话与助手": "Chat & assistants",
      "AI 编程": "AI coding",
      "创作与媒体": "Creative & media",
      "模型 API": "Model APIs",
    },
    category: "Purpose",
    categoryOptions: {
      "AI 服务": "AI services",
      "开发工具": "Developer tools",
      "云服务 / VPS": "Cloud / VPS",
      "域名 / 网络": "Domains / network",
      "设计创作": "Design & creation",
      "办公协作": "Productivity",
      "影音娱乐": "Media",
      "其他": "Other",
    },
    purchaseChannel: "Purchase channel",
    purchaseChannelOptions: {
      官方: "Official",
      中转: "Relay",
    },
    billingModel: "Billing model",
    billingModelOptions: {
      月付: "Monthly",
      年付: "Annual",
      按量计费: "Usage-based",
      额度包: "Credit pack",
    },
    plan: "Plan / credits",
    planPlaceholder: "e.g. ChatGPT Plus",
    fee: "Amount",
    feePlaceholder: "e.g. $20 or 29.9",
    dates: "Dates",
    subDate: "Subscribed on",
    dueDate: "Next renewal",
    noRenewalDate: "No renewal date for this billing model",
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
    feeError: "Invalid amount",
    categoryRequired: "Pick a category",
    planRequired: "Enter a plan name",
    subDateInvalid: "Invalid subscription date",
    dueDateInvalid: "Invalid renewal date",
    clipboardNoImage: "No image in the clipboard",
    ocrNoText: "No text recognized",
    ocrFailed: (msg) => `Image recognition failed: ${msg}`,
    noMatchedSub: "No matching subscription — pick one or create a new entry",
    filled: (n) => (n === 1 ? "Filled 1 field" : `Filled ${n} fields`),
    noFillable: "Nothing recognized to fill in",
    restoreFailed: "Could not restore the subscription",
    billAdded: (plan, amount) => `Added a ¥${amount} bill for ${plan}`,
    confirmDelete: (plan) => `Delete ${plan}?`,
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
    unrenewedPrompt: (plan) =>
      `${plan} was not renewed. Delete the entry, or mark it unsubscribed?\nOK = delete, Cancel = mark unsubscribed`,
    confirmDeleteRow: "Delete this row?",
    renewedNotice: (plan, due) => `${plan} renewed — next due ${due}`,
    deletedNotice: (plan) => `${plan} deleted.`,
    unsubscribedNotice: (plan) => `${plan} marked unsubscribed.`,
  },
  monitor: {
    title: "Automatic monitoring",
    service: "Service",
    statusActive: "Active",
    statusExpired: "Expired",
    statusError: "Error",
    statusUnknown: "Not checked",
    statusOther: "Unknown",
    lastChecked: (when) => `Last checked: ${when}`,
    notChecked: "Not checked yet",
    checking: "Checking…",
    refresh: "Refresh",
    remove: "Remove",
    verifyFailed: (msg) => `Verification failed: ${msg}`,
    verifyOk: (detail) => `Verified — ${detail}`,
    cancel: "Cancel",
    testing: "Verifying…",
    testConnection: "Test connection",
    add: "Add",
    desc: "Enter an API key to query subscription status automatically. The key is encrypted along with your data and stays on this device.",
    planLabel: (plan) => `Plan: ${plan}`,
    dueLabel: (date) => `Renews: ${date}`,
    refreshAll: "Refresh all",
    keyValid: "API key is valid",
    addMonitor: "Add a monitor",
  },
  app: {
    trayNext: (plan, date) => `Next renewal: ${plan} · ${date}`,
    trayNextNone: "Next renewal: —",
    loadFailed: "Could not load your data",
    loadFailedHint: "Loading failed. Restart the app or check the data file.",
    retry: "Retry",
    loading: "Loading…",
    remindersOnTitle: "Renewal reminders are on",
    remindersOffTitle: "Renewal reminders are off",
    remindersTurnOff: "Turn off renewal reminders",
    remindersTurnOn: "Turn on renewal reminders",
    pagesNav: "Pages",
    fallbackPlan: "subscription",
    langSwitched: "Language: English",
  },
  duePicker: {
    title: "Set renewal date",
    label: "Renewal date",
    cancel: "Cancel",
    confirm: "Confirm",
  },
  calendar: {
    placeholder: "Pick a date",
    prevMonth: "Previous month",
    nextMonth: "Next month",
  },
  stats: {
    byCategory: "By category (this month)",
    category: "Category",
    active: "Active",
    monthSpend: "This month",
    feeRef: "Monthly fee",
    last6Months: "Last 6 months",
    noData: "No data yet",
    billCount: (n) => (n === 1 ? "1 bill" : `${n} bills`),
  },
  reminders: {
    noneWithin3Days: "Nothing due for renewal within 3 days.",
    item: (plan, due, left) => `${plan} (${due}, ${left === 1 ? "1 day" : `${left} days`} left)`,
    prefix: "Renewal reminder: ",
    notificationTitle: "Subscription renewal reminder",
    permissionDenied: "Notifications are not allowed; in-app reminders still work.",
    turnedOn: "Renewal reminders on. The app checks for renewals due within 3 days on launch.",
    turnedOff: "Renewal reminders off.",
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
