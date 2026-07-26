import { describe, expect, it } from "vitest";
import { categoryLabel } from "./categoryLabel";
import { tFor } from "./i18n";

const zh = tFor("zh-CN").table;
const en = tFor("en").table;

describe("categoryLabel", () => {
  it("把四个已知分类映射成本地化文案", () => {
    expect(categoryLabel("官方", zh)).toBe("官方");
    expect(categoryLabel("中转", zh)).toBe("中转");
    expect(categoryLabel("中转额度包", zh)).toBe("额度");
    expect(categoryLabel("其他", zh)).toBe("其他");

    expect(categoryLabel("官方", en)).toBe("Official");
    expect(categoryLabel("中转", en)).toBe("Relay");
    expect(categoryLabel("中转额度包", en)).toBe("Credits");
    expect(categoryLabel("其他", en)).toBe("Other");
  });

  /** 「其他」曾经在表单里显示成 Other、在订阅表里仍是「其他」——统一到本函数后不会再漂移。 */
  it("英文下「其他」也翻译，不再各处不一致", () => {
    expect(categoryLabel("其他", en)).toBe("Other");
    expect(categoryLabel("其他", en)).not.toBe("其他");
  });

  it("自定义分类原样返回，两种语言都不改写", () => {
    for (const t of [zh, en]) {
      expect(categoryLabel("我自己的分类", t)).toBe("我自己的分类");
      expect(categoryLabel("Self Hosted", t)).toBe("Self Hosted");
      expect(categoryLabel("", t)).toBe("");
    }
  });
});
