// 外观主题：强调色（主题色）预设 + 应用逻辑。
// accent 只驱动单一强调色（进度条、焦点环、链接、选中态），
// 主按钮保持近黑/反白，确保整体干净。

export type ThemeMode = "system" | "light" | "dark";
export type AccentKey = "green" | "blue" | "indigo" | "teal" | "violet" | "slate";

export interface Appearance {
  mode?: ThemeMode;
  /** 强调色键名；非法值由 applyAppearance 回退到 green */
  accent?: string;
}

interface AccentVars {
  accent: string;
  hover: string;
  on: string;
  soft: string;
  muted: string;
  ink: string;
}

interface AccentPreset {
  light: AccentVars;
  dark: AccentVars;
}

export const ACCENT_ORDER: AccentKey[] = [
  "green",
  "blue",
  "indigo",
  "teal",
  "violet",
  "slate",
];

export const ACCENTS: Record<AccentKey, AccentPreset> = {
  green: {
    light: { accent: "#00b14f", hover: "#00c95d", on: "#ffffff", soft: "rgba(0,177,79,0.10)", muted: "#dcf8e8", ink: "#00803a" },
    dark: { accent: "#3df08c", hover: "#5ff5a3", on: "#032712", soft: "rgba(61,240,140,0.15)", muted: "#12331f", ink: "#8af7b8" },
  },
  blue: {
    light: { accent: "#0a84ff", hover: "#3399ff", on: "#ffffff", soft: "rgba(10,132,255,0.10)", muted: "#e0f0ff", ink: "#0060cc" },
    dark: { accent: "#4dabff", hover: "#70bdff", on: "#062040", soft: "rgba(77,171,255,0.16)", muted: "#122540", ink: "#99ccff" },
  },
  indigo: {
    light: { accent: "#5558ff", hover: "#7275ff", on: "#ffffff", soft: "rgba(85,88,255,0.10)", muted: "#e7e7ff", ink: "#3b3ee0" },
    dark: { accent: "#8b8eff", hover: "#a5a7ff", on: "#101040", soft: "rgba(139,142,255,0.16)", muted: "#1a1a40", ink: "#b9bbff" },
  },
  teal: {
    light: { accent: "#00b8b8", hover: "#00d1d1", on: "#ffffff", soft: "rgba(0,184,184,0.10)", muted: "#dcf7f7", ink: "#008585" },
    dark: { accent: "#2ce8e0", hover: "#52efe8", on: "#042624", soft: "rgba(44,232,224,0.15)", muted: "#0e2c2a", ink: "#86f2ec" },
  },
  violet: {
    light: { accent: "#a033ff", hover: "#b255ff", on: "#ffffff", soft: "rgba(160,51,255,0.10)", muted: "#f2e6ff", ink: "#7c1ae0" },
    dark: { accent: "#c07aff", hover: "#d09aff", on: "#200a40", soft: "rgba(192,122,255,0.16)", muted: "#271240", ink: "#d9adff" },
  },
  slate: {
    light: { accent: "#5e6270", hover: "#71758a", on: "#ffffff", soft: "rgba(94,98,112,0.10)", muted: "#e9eaee", ink: "#4a4e5c" },
    dark: { accent: "#aeb4c4", hover: "#c2c7d6", on: "#181a20", soft: "rgba(174,180,196,0.14)", muted: "#26282e", ink: "#d4d8e2" },
  },
};

/** 设置页色板预览用的实心色（始终用浅色变体，保证在白底上清晰） */
export function swatchColor(key: AccentKey): string {
  return ACCENTS[key].light.accent;
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveMode(mode: ThemeMode = "system"): "light" | "dark" {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

/**
 * 应用外观：写 data-theme（强制浅/深）并把强调色变量内联到 :root。
 * 内联变量优先级高于 CSS 媒体查询，因此手动选择的强调色在两种模式下都生效。
 */
export function applyAppearance(appearance?: Appearance | null): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const mode: ThemeMode = appearance?.mode ?? "system";
  const accent: AccentKey =
    appearance?.accent && appearance.accent in ACCENTS
      ? (appearance.accent as AccentKey)
      : "green";

  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);

  const vars = ACCENTS[accent][resolveMode(mode)];
  root.style.setProperty("--accent", vars.accent);
  root.style.setProperty("--accent-hover", vars.hover);
  root.style.setProperty("--accent-on", vars.on);
  root.style.setProperty("--accent-soft", vars.soft);
  root.style.setProperty("--accent-muted", vars.muted);
  root.style.setProperty("--accent-ink", vars.ink);
}
