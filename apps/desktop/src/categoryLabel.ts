import type { Dict } from "./i18n";

/**
 * 分类的本地化展示名。
 *
 * `category` 是写进账本的**数据值**（中文），绝不能翻译后再存回去 ——
 * core 的 isCreditLike / categoryClass / categoryRank 全靠中文子串判断。
 * 这里只把已知的四个值映射成展示文案，用户自定义的分类原样返回。
 *
 * 订阅表、订阅表单、服务库三处都用这一个函数，避免各写一份后互相漂移
 * （曾经出现过表单把「其他」显示成 Other、而订阅表仍显示「其他」的情况）。
 */
export function categoryLabel(category: string, t: Dict["table"]): string {
  switch (category) {
    case "官方":
      return t.catOfficial;
    case "中转":
      return t.catRelay;
    case "中转额度包":
      return t.catCredit;
    case "其他":
      return t.catOther;
    default:
      return category;
  }
}
