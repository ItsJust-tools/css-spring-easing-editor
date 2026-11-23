import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  DEFAULT_PARAMS,
  MAX_HISTORY,
  PARAM_LIMITS,
  PRESET_LIBRARY,
  PRESET_NAMES,
  type ComparisonSlot,
  type HistoryEntry,
  type PresetName,
  type SpringParams,
  type ToolState,
} from './types';

function isPresetName(v: unknown): v is PresetName {
  return typeof v === 'string' && (PRESET_NAMES as string[]).includes(v);
}

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Validate one spring params object against known limits. */
export function sanitizeParams(value: unknown): SpringParams {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const d = DEFAULT_PARAMS;
  return {
    stiffness: clampNum(
      v.stiffness,
      PARAM_LIMITS.stiffness.min,
      PARAM_LIMITS.stiffness.max,
      d.stiffness
    ),
    damping: clampNum(v.damping, PARAM_LIMITS.damping.min, PARAM_LIMITS.damping.max, d.damping),
    mass: clampNum(v.mass, PARAM_LIMITS.mass.min, PARAM_LIMITS.mass.max, d.mass),
    initialVelocity: clampNum(
      v.initialVelocity,
      PARAM_LIMITS.initialVelocity.min,
      PARAM_LIMITS.initialVelocity.max,
      d.initialVelocity
    ),
    finalVelocity: clampNum(
      v.finalVelocity,
      PARAM_LIMITS.finalVelocity.min,
      PARAM_LIMITS.finalVelocity.max,
      d.finalVelocity
    ),
    duration: clampNum(
      v.duration,
      PARAM_LIMITS.duration.min,
      PARAM_LIMITS.duration.max,
      d.duration
    ),
    stopCount: Math.round(
      clampNum(v.stopCount, PARAM_LIMITS.stopCount.min, PARAM_LIMITS.stopCount.max, d.stopCount)
    ),
  };
}

function sanitizeSlot(value: unknown, fallback: ComparisonSlot): ComparisonSlot {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const preset =
    isPresetName(v.preset) || v.preset === 'custom'
      ? (v.preset as PresetName | 'custom')
      : fallback.preset;
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : fallback.enabled,
    preset,
    stagger: clampNum(v.stagger, 0, 2, fallback.stagger),
  };
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).text === 'string' &&
        typeof (entry as HistoryEntry).createdAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    v: 1,
    params: state.params,
    activePreset: state.activePreset,
    comparison: state.comparison,
    autoCorrect: state.autoCorrect,
    history: state.history,
  });
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected spring easing state object',
    };
  }
  const v = data as Record<string, unknown>;
  const activePreset: PresetName | 'custom' =
    isPresetName(v.activePreset) || v.activePreset === 'custom'
      ? (v.activePreset as PresetName | 'custom')
      : DEFAULT_STATE.activePreset;
  const comparisonRaw = Array.isArray(v.comparison) ? v.comparison : [];
  const comparison: [ComparisonSlot, ComparisonSlot, ComparisonSlot] = [0, 1, 2].map((i) =>
    sanitizeSlot(comparisonRaw[i], DEFAULT_STATE.comparison[i]!)
  ) as [ComparisonSlot, ComparisonSlot, ComparisonSlot];
  const state: ToolState = {
    params: sanitizeParams(v.params),
    activePreset,
    comparison,
    autoCorrect: typeof v.autoCorrect === 'boolean' ? v.autoCorrect : DEFAULT_STATE.autoCorrect,
    history: validHistory(v.history),
  };
  return { success: true, data: state };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

/** Tool contract used by the framework shell. */
export const springEasingTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export { DEFAULT_STATE, DEFAULT_PARAMS, PRESET_LIBRARY, PARAM_LIMITS };
