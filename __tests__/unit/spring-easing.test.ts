import { describe, it, expect } from 'vitest';
import {
  simulateSpring,
  toLinearEasing,
  toKeyframesSnippet,
  validateParams,
  autoCorrect,
  readoutText,
  clamp,
  presetParams,
  pushUndo,
  undo,
  redo,
  withHistory,
} from '@/tool/spring';
import {
  deserializeState,
  serializeState,
  roundTrips,
  sanitizeParams,
} from '@/tool/tool-definition';
import {
  DEFAULT_STATE,
  DEFAULT_PARAMS,
  MAX_HISTORY,
  PRESET_LIBRARY,
  type ToolState,
} from '@/tool/types';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('spring simulation', () => {
  it('starts near zero and settles near the target', () => {
    const a = simulateSpring(DEFAULT_PARAMS, 100);
    expect(a.samples.length).toBe(101);
    expect(a.samples[0]!.value).toBeCloseTo(0, 2);
    expect(a.finalValue).toBeGreaterThan(0.9);
    expect(a.finalValue).toBeLessThan(1.1);
  });

  it('produces monotonic sample times from 0 to 1', () => {
    const a = simulateSpring(DEFAULT_PARAMS, 50);
    for (let i = 1; i < a.samples.length; i++) {
      expect(a.samples[i]!.t).toBeGreaterThan(a.samples[i - 1]!.t);
    }
    expect(a.samples[a.samples.length - 1]!.t).toBeCloseTo(1);
  });

  it('shows more overshoot with low damping than high damping', () => {
    const bouncy = simulateSpring({ ...DEFAULT_PARAMS, stiffness: 300, damping: 5 }, 200);
    const damped = simulateSpring({ ...DEFAULT_PARAMS, stiffness: 300, damping: 40 }, 200);
    expect(bouncy.overshootPercent).toBeGreaterThan(damped.overshootPercent);
    expect(bouncy.overshootPercent).toBeGreaterThan(5);
  });

  it('critically damped spring has no overshoot', () => {
    // critical damping c = 2*sqrt(k*m) = 20 for k=100, m=1
    const a = simulateSpring({ ...DEFAULT_PARAMS, damping: 20 }, 200);
    expect(a.overshootPercent).toBeLessThan(2);
  });

  it('initial velocity shifts the early curve', () => {
    const push = simulateSpring({ ...DEFAULT_PARAMS, initialVelocity: 20 }, 100);
    const still = simulateSpring({ ...DEFAULT_PARAMS, initialVelocity: 0 }, 100);
    expect(push.samples[2]!.value).toBeGreaterThan(still.samples[2]!.value);
  });

  it('tracks velocity in the readout samples', () => {
    const a = simulateSpring(DEFAULT_PARAMS, 20);
    expect(Number.isFinite(a.samples[0]!.velocity)).toBe(true);
  });

  it('respects stop count in linear() output', () => {
    const a = simulateSpring(DEFAULT_PARAMS, 120);
    const out24 = toLinearEasing(a.samples, 24);
    expect((out24.match(/,/g) ?? []).length).toBe(23);
    expect(out24.startsWith('linear(')).toBe(true);
    expect(out24.endsWith(')')).toBe(true);
  });

  it('emits ascending percentage stops', () => {
    const a = simulateSpring(DEFAULT_PARAMS, 120);
    const out = toLinearEasing(a.samples, 12);
    const percents = [...out.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]));
    expect(percents.length).toBe(12);
    expect(percents[0]).toBe(0);
    expect(percents[percents.length - 1]).toBe(100);
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]).toBeGreaterThan(percents[i - 1]!);
    }
  });

  it('handles minimum stop count of 2', () => {
    const a = simulateSpring(DEFAULT_PARAMS, 120);
    const out = toLinearEasing(a.samples, 2);
    expect(out).toMatch(/^linear\(.*0%, .*100%\)$/);
  });

  it('clamps low damping to the minimum instead of exploding', () => {
    const a = simulateSpring({ ...DEFAULT_PARAMS, damping: 0 }, 60);
    expect(Number.isFinite(a.finalValue)).toBe(true);
  });
});

describe('keyframes output', () => {
  it('wraps duration and easing in an animation rule', () => {
    const a = simulateSpring(DEFAULT_PARAMS, 120);
    const snippet = toKeyframesSnippet(
      a.samples,
      DEFAULT_PARAMS.duration,
      DEFAULT_PARAMS.stopCount
    );
    expect(snippet).toContain('@keyframes spring-move');
    expect(snippet).toContain('animation: spring-move 1.2s linear(');
    expect(snippet).toContain('transform: translateX(0)');
    expect(snippet).toContain('transform: translateX(100%)');
  });
});

describe('validation and auto-correction', () => {
  it('flags negative damping', () => {
    const w = validateParams({ ...DEFAULT_PARAMS, damping: -5 });
    expect(w.some((x) => x.kind === 'negative-damping')).toBe(true);
  });

  it('flags negative stiffness and non-positive mass', () => {
    const w = validateParams({ ...DEFAULT_PARAMS, stiffness: -10, mass: 0 });
    const kinds = w.map((x) => x.kind);
    expect(kinds).toContain('negative-stiffness');
    expect(kinds).toContain('nonpositive-mass');
  });

  it('flags unstable (near-undamped) springs', () => {
    const w = validateParams({ ...DEFAULT_PARAMS, stiffness: 400, damping: 0.1, mass: 4 });
    expect(w.some((x) => x.kind === 'unstable')).toBe(true);
  });

  it('returns no warnings for a healthy spring', () => {
    expect(validateParams(DEFAULT_PARAMS)).toEqual([]);
  });

  it('flags non-finite values', () => {
    const w = validateParams({ ...DEFAULT_PARAMS, stiffness: Number.NaN });
    expect(w.some((x) => x.kind === 'nonfinite')).toBe(true);
  });

  it('auto-correct flips negative damping to positive', () => {
    const params = autoCorrect(
      { ...DEFAULT_PARAMS, damping: -5 },
      validateParams({ ...DEFAULT_PARAMS, damping: -5 })
    );
    expect(params.damping).toBeGreaterThan(0);
  });

  it('auto-correct fixes mass and stiffness together', () => {
    const p = { ...DEFAULT_PARAMS, stiffness: -10, mass: 0 };
    const fixed = autoCorrect(p, validateParams(p));
    expect(fixed.stiffness).toBeGreaterThan(0);
    expect(fixed.mass).toBeGreaterThan(0);
  });
});

describe('undo / redo stack', () => {
  const s0 = state();
  const s1 = state({ autoCorrect: false });
  const s2 = state({ history: [{ text: 'x', createdAt: 'now' }] });

  it('pushes states and clears the future', () => {
    const stack = pushUndo({ past: [], present: s0, future: [s2] }, s1);
    expect(stack.present).toBe(s1);
    expect(stack.past).toEqual([s0]);
    expect(stack.future).toEqual([]);
  });

  it('undo moves back and redo restores', () => {
    let stack = pushUndo({ past: [], present: s0, future: [] }, s1);
    stack = pushUndo(stack, s2);
    stack = undo(stack);
    expect(stack.present).toEqual(s1);
    stack = undo(stack);
    expect(stack.present).toEqual(s0);
    expect(stack.future.length).toBe(2);
    stack = redo(stack);
    expect(stack.present).toEqual(s1);
    stack = redo(stack);
    expect(stack.present).toEqual(s2);
    expect(stack.future.length).toBe(0);
  });

  it('undo/redo are no-ops at the edges', () => {
    const base = { past: [], present: s0, future: [] };
    expect(undo(base)).toBe(base);
    expect(redo(base)).toBe(base);
  });

  it('push respects the history limit', () => {
    let stack = { past: [] as ToolState[], present: s0, future: [] as ToolState[] };
    for (let i = 0; i < 60; i++) {
      stack = pushUndo(stack, state({ autoCorrect: i % 2 === 0 }), 50);
    }
    expect(stack.past.length).toBeLessThanOrEqual(50);
  });
});

describe('preset helpers', () => {
  it('returns library params by name and defaults for custom', () => {
    expect(presetParams('stiff')).toEqual(PRESET_LIBRARY.stiff.params);
    expect(presetParams('custom')).toEqual(DEFAULT_PARAMS);
  });
});

describe('clamp and readout', () => {
  it('clamps values within bounds', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-2, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('formats the readout with overshoot and settle info', () => {
    const a = simulateSpring(DEFAULT_PARAMS, 100);
    const text = readoutText(a, 1.2);
    expect(text).toContain('overshoot');
    expect(text).toContain('final velocity');
  });
});

describe('serialize / deserialize round-trip', () => {
  it('round-trips a full state unchanged', () => {
    const st = state({ history: [{ text: 'linear(...)', createdAt: '2026-11-23T00:00:00.000Z' }] });
    expect(roundTrips(st)).toBe(true);
  });

  it('round-trips edited custom params', () => {
    const st = state({
      params: { ...DEFAULT_PARAMS, stiffness: 321, damping: 15.5 },
      activePreset: 'custom',
    });
    const restored = deserializeState(JSON.parse(serializeState(st)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.params.stiffness).toBe(321);
      expect(restored.data.params.damping).toBe(15.5);
      expect(restored.data.activePreset).toBe('custom');
    }
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState('nope').success).toBe(false);
    expect(deserializeState([]).success).toBe(false);
    expect(deserializeState(42).success).toBe(false);
  });

  it('falls back to defaults for invalid params', () => {
    const r = deserializeState({ params: { stiffness: 'huge', damping: -99 }, comparison: 'oops' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.params.stiffness).toBe(DEFAULT_PARAMS.stiffness);
      expect(r.data.params.damping).toBeGreaterThanOrEqual(0.1);
      expect(r.data.comparison.length).toBe(3);
    }
  });

  it('drops malformed history entries and caps length', () => {
    const history = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      text: `e${i}`,
      createdAt: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
    }));
    const r = deserializeState({ history: [...history, { text: 42 }, null] });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.history.length).toBe(MAX_HISTORY);
      expect(r.data.history[0]!.text).toBe('e0');
    }
  });

  it('restores comparison slots including enabled/stagger', () => {
    const st = state({
      comparison: [
        { enabled: false, preset: 'custom', stagger: 0.25 },
        { enabled: true, preset: 'stiff', stagger: 0.5 },
        { enabled: true, preset: 'gentle', stagger: 1 },
      ],
    });
    const restored = deserializeState(JSON.parse(serializeState(st)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.comparison[1]).toEqual({ enabled: true, preset: 'stiff', stagger: 0.5 });
    }
  });

  it('restores autoCorrect boolean', () => {
    const r = deserializeState({ autoCorrect: false });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.autoCorrect).toBe(false);
    const r2 = deserializeState({});
    if (r2.success) expect(r2.data.autoCorrect).toBe(true);
  });

  it('sanitizeParams clamps into documented limits', () => {
    const p = sanitizeParams({
      stiffness: 99999,
      damping: -50,
      mass: 0,
      initialVelocity: 1000,
      finalVelocity: -1000,
      duration: 999,
      stopCount: 0.5,
    });
    expect(p.stiffness).toBeLessThanOrEqual(500);
    expect(p.damping).toBeGreaterThanOrEqual(0.1);
    expect(p.mass).toBeGreaterThanOrEqual(0.1);
    expect(p.initialVelocity).toBeLessThanOrEqual(50);
    expect(p.finalVelocity).toBeGreaterThanOrEqual(-50);
    expect(p.duration).toBeLessThanOrEqual(10);
    expect(p.stopCount).toBeGreaterThanOrEqual(4);
    expect(Number.isInteger(p.stopCount)).toBe(true);
  });

  it('withHistory caps at MAX_HISTORY and keeps newest first', () => {
    let st = state();
    for (let i = 0; i < MAX_HISTORY + 3; i++) {
      st = withHistory(
        st,
        `entry-${i}`,
        new Date(`2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`)
      );
    }
    expect(st.history.length).toBe(MAX_HISTORY);
    expect(st.history[0]!.text).toBe(`entry-${MAX_HISTORY + 2}`);
  });
});
