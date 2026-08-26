import type { SubscriptionCategory } from "@ai-sub/core";
import type { Dict } from "./i18n";

/**
 * 用途分类的本地化展示名。
 *
 * `category` 是写进账本的数据值，只在展示时翻译。已知的八类用途
 * 复用表单选项文案；旧数据或自定义分类原样显示。
 */
export function categoryLabel(
  category: string,
  labels: Dict["form"]["categoryOptions"]
): string {
  if (!Object.prototype.hasOwnProperty.call(labels, category)) return category;
  return labels[category as SubscriptionCategory];
}
