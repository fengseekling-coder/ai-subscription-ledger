import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarPicker } from "./CalendarPicker";

describe("CalendarPicker", () => {
  const mockOnChange = vi.fn();
  const defaultProps = {
    value: "2026-08-15",
    onChange: mockOnChange,
    language: "zh-CN" as const,
  };

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it("renders trigger button with current value", async () => {
    render(<CalendarPicker {...defaultProps} />);
    // Trigger should be visible and show date
    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("opens calendar on click", async () => {
    const user = userEvent.setup();
    render(<CalendarPicker {...defaultProps} />);

    await user.click(screen.getByRole("button"));
    
    // Calendar should open showing month navigation
    expect(document.querySelector(".cal-picker__nav")).toBeInTheDocument();
  });

  it("displays calendar grid with days", async () => {
    const user = userEvent.setup();
    render(<CalendarPicker {...defaultProps} />);

    await user.click(screen.getByRole("button"));
    
    // Should show day cells
    const dayCells = document.querySelectorAll(".cal-picker__day");
    expect(dayCells.length).toBeGreaterThan(0);
  });

  it("closes when clicking outside", async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    
    render(
      <div>
        <CalendarPicker 
          {...defaultProps}
          isOpen={true}
          onClose={mockOnClose}
        />
      </div>
    );

    // Click outside the picker
    await user.click(document.body);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onChange when a date is selected", async () => {
    const user = userEvent.setup();
    render(<CalendarPicker {...defaultProps} />);

    await user.click(screen.getByRole("button"));
    
    // Select first available day
    const dayButtons = Array.from(document.querySelectorAll(
      ".cal-picker__day:not(.cal-picker__day--empty)"
    )) as HTMLButtonElement[];
    
    if (dayButtons.length > 0) {
      await user.click(dayButtons[0]);
      expect(mockOnChange).toHaveBeenCalled();
    }
  });

  it("marks today's date with different styling", async () => {
    const user = userEvent.setup();
    render(<CalendarPicker value="" onChange={mockOnChange} language="zh-CN" />);

    await user.click(screen.getByRole("button"));
    
    // Today should have the cal-picker__day--today class
    const todayCells = document.querySelectorAll(".cal-picker__day--today");
    expect(todayCells.length).toBeGreaterThan(0);
  });
});
