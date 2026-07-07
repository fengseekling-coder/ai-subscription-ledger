import type { AppState } from "@ai-sub/core";
import { loadFromJson } from "@ai-sub/core";
import { invoke } from "@tauri-apps/api/core";

type Dto = { budget: number; rows: unknown[]; bills: unknown[] };

function toDto(state: AppState): Dto {
  return {
    budget: state.budget,
    rows: state.rows,
    bills: state.bills,
  };
}

function fromDto(dto: Dto): AppState {
  return loadFromJson({ budget: dto.budget, rows: dto.rows, bills: dto.bills });
}

export async function loadAppState(): Promise<AppState> {
  const dto = await invoke<Dto>("get_app_state");
  return fromDto(dto);
}

export async function persistAppState(state: AppState): Promise<void> {
  await invoke("set_app_state", { state: toDto(state) });
}