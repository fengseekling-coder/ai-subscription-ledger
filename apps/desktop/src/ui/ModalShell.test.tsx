import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModalShell, FormFooter } from "./ModalShell";

describe("ModalShell", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it("renders title when provided", () => {
    render(
      <ModalShell title="Test Title" onClose={mockOnClose}>
        <div>Content</div>
      </ModalShell>
    );
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("hides header when no title provided", () => {
    const { container } = render(
      <ModalShell onClose={mockOnClose}>
        <div>Content</div>
      </ModalShell>
    );
    expect(container.querySelector(".modal__head")).not.toBeInTheDocument();
  });

  it("closes on ESC key press", () => {
    render(
      <ModalShell title="Test" onClose={mockOnClose}>
        <div>Content</div>
      </ModalShell>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", () => {
    render(
      <ModalShell title="Test" onClose={mockOnClose}>
        <div>Content</div>
      </ModalShell>
    );

    const backdrop = document.querySelector(".modal__backdrop");
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("renders children content", () => {
    render(
      <ModalShell title="Test" onClose={mockOnClose}>
        <div data-testid="custom-content">Custom Content</div>
      </ModalShell>
    );
    expect(screen.getByTestId("custom-content")).toBeInTheDocument();
  });

  it("sets correct ARIA attributes", () => {
    render(
      <ModalShell title="Test" onClose={mockOnClose}>
        <div>Content</div>
      </ModalShell>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});

describe("FormFooter", () => {
  const mockOnCancel = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnCancel.mockClear();
  });

  it("renders cancel button with default label", () => {
    render(<FormFooter onCancel={mockOnCancel} submitLabel="Save" />);
    expect(screen.getByRole("button", { name: /取消/i })).toBeInTheDocument();
  });

  it("renders submit button with custom label", () => {
    render(<FormFooter onCancel={mockOnCancel} submitLabel="Custom Save" />);
    expect(screen.getByRole("button", { name: "Custom Save" })).toBeInTheDocument();
  });

  it("calls onCancel when cancel button clicked", () => {
    render(<FormFooter onCancel={mockOnCancel} submitLabel="Save" />);
    const cancelButton = screen.getByRole("button", { name: /取消/i });
    fireEvent.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("has primary class on submit button", () => {
    render(<FormFooter onCancel={mockOnCancel} submitLabel="Save" />);
    const submitButton = screen.getByRole("button", { name: "Save" });
    expect(submitButton).toHaveClass("primary");
  });
});
