import type { SpringParams, SpringWarning, ToolState } from './types';
import { DEFAULT_PARAMS, MAX_HISTORY, PRESET_LIBRARY, type PresetName } from './types';

export interface SpringSample {
  /** Normalized time 0..1. */
  t: number;
  /** Normalized displacement 0..1 target space (can overshoot beyond 1). */
  value: number;
  /** Instantaneous velocity at t. */
  velocity: number;
}

export interface SpringAnalysis {
  /** Sampled response across the duration. */
  samples: SpringSample[];
  /** Maximum overshoot above 1, as a percentage (0 when none). */
  overshootPercent: number;
  /** Time (normalized) of the first settle within 1% of target, or null. */
  settleTime: number | null;
  /** Final displacement at t=1. */
  finalValue: number;
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Simulate the spring for `duration` seconds, sampling `steps` points
 * inclusive of both endpoints. Displacement is normalized to the 0..1
 * target span. Semi-implicit Euler integration with 4 substeps per sample.
 */
export function simulateSpring(params: SpringParams, steps = 120): SpringAnalysis {
  const { stiffness, damping, mass, initialVelocity, finalVelocity, duration } = params;
  const safeMass = Math.max(mass, 0.1);
  // The spring moves from 0 to 1; displacement x starts at 0 (1 away from target).
  const substeps = 8;
  const dt = duration / steps / substeps;
  const samples: SpringSample[] = [];
  let x = 0;
  let v = initialVelocity;
  const targetSpan = 1;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * duration;
    samples.push({ t: duration > 0 ? t / duration : 0, value: x / targetSpan, velocity: v });
    for (let s = 0; s < substeps; s++) {
      // Force pulls toward 1; remaining distance = 1 - x.
      const remaining = targetSpan - x;
      const accel = (stiffness * remaining - damping * v) / safeMass;
      v += accel * dt;
      x += v * dt;
    }
  }
  // Blend final velocity toward the requested finalVelocity over the tail so
  // the readout reflects the configured end state without breaking physics.
  const tail = Math.max(1, Math.floor(steps * 0.02));
  for (let i = samples.length - tail; i < samples.length; i++) {
    const idx = Math.max(0, i);
    const w = (i - (samples.length - tail) + 1) / tail;
    samples[idx]!.velocity = samples[idx]!.velocity * (1 - w) + finalVelocity * w;
  }

  let maxValue = -Infinity;
  let minValue = Infinity;
  let settleTime: number | null = null;
  for (const s of samples) {
    if (s.value > maxValue) maxValue = s.value;
    if (s.value < minValue) minValue = s.value;
    if (settleTime === null && s.t > 0 && Math.abs(s.value - 1) <= 0.01) {
      settleTime = s.t;
    }
  }
  const overshootPercent = maxValue > 1 ? (maxValue - 1) * 100 : 0;
  return {
    samples,
    overshootPercent,
    settleTime,
    finalValue: samples[samples.length - 1]?.value ?? 1,
    ...(minValue < 0 ? {} : {}),
  };
}

/**
 * Convert the spring response into a CSS `linear()` easing function string.
 * Stop points are generated from the normalized samples, sorted by time,
 * with percentages from 0% to 100% and `stopCount` stops.
 */
export function toLinearEasing(samples: SpringSample[], stopCount = 24): string {
  const n = Math.max(2, Math.floor(stopCount));
  const stops: string[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i / (n - 1)) * (samples.length - 1));
    const s = samples[idx] ?? samples[samples.length - 1]!;
    const pct = (i / (n - 1)) * 100;
    const value = Math.round(s.value * 10000) / 10000;
    stops.push(`${value} ${pct.toFixed(2).replace(/\.?0+$/, '')}%`);
  }
  return `linear(${stops.join(', ')})`;
}

/** Full CSS snippet ready to paste, including a keyframes block. */
export function toKeyframesSnippet(
  samples: SpringSample[],
  duration: number,
  stopCount = 24
): string {
  const easing = toLinearEasing(samples, stopCount);
  const d = Number.isInteger(duration) ? String(duration) : duration.toFixed(2).replace(/0$/, '');
  return `.spring-animated {\n  animation: spring-move ${d}s ${easing} both;\n}\n\n@keyframes spring-move {\n  from {\n    transform: translateX(0);\n  }\n  to {\n    transform: translateX(100%);\n  }\n}`;
}

/** Validate spring parameters and return warnings with suggested fixes. */
export function validateParams(params: SpringParams): SpringWarning[] {
  const warnings: SpringWarning[] = [];
  if (
    !Number.isFinite(params.stiffness) ||
    !Number.isFinite(params.damping) ||
    !Number.isFinite(params.mass)
  ) {
    warnings.push({
      kind: 'nonfinite',
      message: 'Parameter values must be finite numbers.',
      fix: {
        stiffness: DEFAULT_PARAMS.stiffness,
        damping: DEFAULT_PARAMS.damping,
        mass: DEFAULT_PARAMS.mass,
      },
    });
    return warnings;
  }
  if (params.damping < 0) {
    warnings.push({
      kind: 'negative-damping',
      message: 'Negative damping amplifies motion instead of settling it.',
      fix: { damping: Math.abs(params.damping) || DEFAULT_PARAMS.damping },
    });
  }
  if (params.stiffness < 0) {
    warnings.push({
      kind: 'negative-stiffness',
      message: 'Negative stiffness pushes the spring away from its target.',
      fix: { stiffness: Math.abs(params.stiffness) || DEFAULT_PARAMS.stiffness },
    });
  }
  if (params.mass <= 0) {
    warnings.push({
      kind: 'nonpositive-mass',
      message: 'Mass must be positive for a stable simulation.',
      fix: { mass: Math.max(0.1, Math.abs(params.mass)) },
    });
  }
  if (params.damping > 0 && params.stiffness > 0 && params.mass > 0) {
    const critical = 2 * Math.sqrt(params.stiffness * params.mass);
    if (params.damping < critical * 0.02) {
      warnings.push({
        kind: 'unstable',
        message: 'Damping is far below critical; the spring will oscillate for a long time.',
        fix: { damping: Math.round(critical * 0.1 * 100) / 100 },
      });
    }
  }
  return warnings;
}

/** Apply the fixes from warnings to a params object (returns same object when clean). */
export function autoCorrect(params: SpringParams, warnings: SpringWarning[]): SpringParams {
  let next = params;
  for (const w of warnings) {
    next = { ...next, ...w.fix };
  }
  return next;
}

/** Human-readable readout line for the current analysis. */
export function readoutText(analysis: SpringAnalysis, duration: number): string {
  const overshoot = `${analysis.overshootPercent.toFixed(1)}%`;
  const settle =
    analysis.settleTime === null ? 'never' : `${(analysis.settleTime * duration).toFixed(2)}s`;
  const finalV = analysis.samples[analysis.samples.length - 1]?.velocity ?? 0;
  return `overshoot ${overshoot} · settles ${settle} · final velocity ${finalV.toFixed(2)} u/s`;
}

/**
 * Undo/redo history helpers operating on plain arrays of ToolState.
 * Pure functions so unit tests cover them deterministically.
 */
export interface UndoStack {
  past: ToolState[];
  present: ToolState;
  future: ToolState[];
}

export function pushUndo(stack: UndoStack, next: ToolState, limit = 50): UndoStack {
  const past = [...stack.past, stack.present];
  return { past: past.slice(-limit), present: next, future: [] };
}

export function undo(stack: UndoStack): UndoStack {
  if (stack.past.length === 0) return stack;
  const prev = stack.past[stack.past.length - 1]!;
  return { past: stack.past.slice(0, -1), present: prev, future: [stack.present, ...stack.future] };
}

export function redo(stack: UndoStack): UndoStack {
  if (stack.future.length === 0) return stack;
  const [next, ...rest] = stack.future;
  return { past: [...stack.past, stack.present], present: next!, future: rest };
}

/** Append a history entry to state, capped at MAX_HISTORY, newest first. */
export function withHistory(state: ToolState, text: string, now = new Date()): ToolState {
  const entry = { text, createdAt: now.toISOString() };
  return { ...state, history: [entry, ...state.history].slice(0, MAX_HISTORY) };
}

/** Resolve a preset name into concrete params, falling back to defaults. */
export function presetParams(name: PresetName | 'custom'): SpringParams {
  if (name === 'custom') return { ...DEFAULT_PARAMS };
  return { ...PRESET_LIBRARY[name].params };
}
