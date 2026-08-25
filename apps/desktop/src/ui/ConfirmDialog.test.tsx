import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

function setup() {
  const onConfirm = vi.fn();
  const onSecondary = vi.fn();
  const onDismiss = vi.fn();
  render(
    <ConfirmDialog
      title="删除订阅"
      message="删除后无法恢复"
      confirmLabel="删除"
      secondaryLabel="改为未订阅"
      dismissLabel="关闭"
      destructive
      onConfirm={onConfirm}
      onSecondary={onSecondary}
      onDismiss={onDismiss}
    />
  );
  return { onConfirm, onSecondary, onDismiss };
}

describe("ConfirmDialog", () => {
  it("确认后执行确认操作并关闭", async () => {
    const { onConfirm, onDismiss } = setup();

    await userEvent.click(screen.getByRole("button", { name: "删除" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("次要操作后执行次要操作并关闭", async () => {
    const { onSecondary, onDismiss } = setup();

    await userEvent.click(screen.getByRole("button", { name: "改为未订阅" }));

    expect(onSecondary).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it.each([
    ["关闭按钮", () => userEvent.click(screen.getByRole("button", { name: "关闭" }))],
    ["背景", () => fireEvent.click(document.querySelector(".modal__backdrop")!)],
    ["Escape", () => userEvent.keyboard("{Escape}")],
  ])("%s 仅关闭，不执行变更", async (_name, dismiss) => {
    const { onConfirm, onSecondary, onDismiss } = setup();

    await dismiss();

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onSecondary).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
