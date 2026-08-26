import { describe, expect, it } from "vitest";
import { categoryLabel } from "./categoryLabel";
import { tFor } from "./i18n";

const en = tFor("en").form.categoryOptions;
const zhCategories = tFor("zh-CN").form.categoryOptions;

describe("categoryLabel", () => {
  it("把八个用途分类映射成本地化文案", () => {
    expect(categoryLabel("AI 服务", zhCategories)).toBe("AI 服务");
    expect(categoryLabel("开发工具", zhCategories)).toBe("开发工具");
    expect(categoryLabel("云服务 / VPS", zhCategories)).toBe("云服务 / VPS");
    expect(categoryLabel("域名 / 网络", zhCategories)).toBe("域名 / 网络");
    expect(categoryLabel("设计创作", zhCategories)).toBe("设计创作");
    expect(categoryLabel("办公协作", zhCategories)).toBe("办公协作");
    expect(categoryLabel("影音娱乐", zhCategories)).toBe("影音娱乐");
    expect(categoryLabel("其他", zhCategories)).toBe("其他");

    expect(categoryLabel("AI 服务", en)).toBe("AI services");
    expect(categoryLabel("开发工具", en)).toBe("Developer tools");
    expect(categoryLabel("云服务 / VPS", en)).toBe("Cloud / VPS");
    expect(categoryLabel("域名 / 网络", en)).toBe("Domains / network");
    expect(categoryLabel("设计创作", en)).toBe("Design & creation");
    expect(categoryLabel("办公协作", en)).toBe("Productivity");
    expect(categoryLabel("影音娱乐", en)).toBe("Media");
    expect(categoryLabel("其他", en)).toBe("Other");
  });

  it("英文下「其他」也翻译，不再各处不一致", () => {
    expect(categoryLabel("其他", en)).toBe("Other");
    expect(categoryLabel("其他", en)).not.toBe("其他");
  });

  it("自定义分类原样返回，两种语言都不改写", () => {
    for (const t of [zhCategories, en]) {
      expect(categoryLabel("我自己的分类", t)).toBe("我自己的分类");
      expect(categoryLabel("Self Hosted", t)).toBe("Self Hosted");
      expect(categoryLabel("", t)).toBe("");
    }
  });
});
