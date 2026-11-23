'use client';

import React from 'react';
import {
  clamp,
  autoCorrect,
  presetParams,
  readoutText,
  simulateSpring,
  toKeyframesSnippet,
  toLinearEasing,
  validateParams,
} from '../spring';
import { PRESETS } from '../ui-shared';
import type { SpringAnalysis } from '../spring';
import {
  PARAM_LIMITS,
  PRESET_LIBRARY,
  type ComparisonSlot,
  type PresetName,
  type SpringParams,
  type SpringWarning,
  type ToolState,
} from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

const sliderLabels: {
  key: keyof SpringParams;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  {
    key: 'stiffness',
    label: 'Stiffness',
    min: PARAM_LIMITS.stiffness.min,
    max: PARAM_LIMITS.stiffness.max,
    step: 1,
  },
  {
    key: 'damping',
    label: 'Damping',
    min: PARAM_LIMITS.damping.min,
    max: PARAM_LIMITS.damping.max,
    step: 0.1,
  },
  { key: 'mass', label: 'Mass', min: PARAM_LIMITS.mass.min, max: PARAM_LIMITS.mass.max, step: 0.1 },
  {
    key: 'initialVelocity',
    label: 'Initial velocity',
    min: PARAM_LIMITS.initialVelocity.min,
    max: PARAM_LIMITS.initialVelocity.max,
    step: 0.5,
  },
  {
    key: 'finalVelocity',
    label: 'Final velocity',
    min: PARAM_LIMITS.finalVelocity.min,
    max: PARAM_LIMITS.finalVelocity.max,
    step: 0.5,
  },
  {
    key: 'duration',
    label: 'Duration (s)',
    min: PARAM_LIMITS.duration.min,
    max: PARAM_LIMITS.duration.max,
    step: 0.1,
  },
  {
    key: 'stopCount',
    label: 'linear() stops',
    min: PARAM_LIMITS.stopCount.min,
    max: PARAM_LIMITS.stopCount.max,
    step: 1,
  },
];

const W = 560;
const H = 220;
const PAD = 24;

function pathFor(samples: { value: number }[], maxAbs: number): string {
  const n = samples.length;
  if (n === 0) return '';
  const yOf = (v: number) => H / 2 - (v / maxAbs) * (H / 2 - PAD / 2);
  let d = `M ${PAD} ${yOf(samples[0]!.value).toFixed(2)}`;
  for (let i = 1; i < n; i++) {
    const x = PAD + (i / (n - 1)) * (W - 2 * PAD);
    d += ` L ${x.toFixed(2)} ${yOf(samples[i]!.value).toFixed(2)}`;
  }
  return d;
}

function CurveSvg({
  analysis,
  progress,
  stroke,
}: {
  analysis: SpringAnalysis;
  progress: number;
  stroke: string;
}) {
  const maxAbs = Math.max(
    1.2,
    ...analysis.samples.map((s: { value: number }) => Math.abs(s.value))
  );
  const d = pathFor(analysis.samples, maxAbs);
  const markerIdx = Math.min(
    analysis.samples.length - 1,
    Math.round(progress * (analysis.samples.length - 1))
  );
  const marker = analysis.samples[markerIdx] ?? analysis.samples[0]!;
  const mx = PAD + marker.t * (W - 2 * PAD);
  const my = H / 2 - (marker.value / maxAbs) * (H / 2 - PAD / 2);
  const zeroY = H / 2;
  const oneY = H / 2 - (1 / maxAbs) * (H / 2 - PAD / 2);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-44 w-full"
      role="img"
      aria-label="Spring response curve preview"
      data-testid="spring-curve"
    >
      <line
        x1={PAD}
        x2={W - PAD}
        y1={zeroY}
        y2={zeroY}
        stroke="currentColor"
        strokeDasharray="4 6"
        opacity="0.3"
      />
      <line
        x1={PAD}
        x2={W - PAD}
        y1={oneY}
        y2={oneY}
        stroke="currentColor"
        strokeDasharray="2 6"
        opacity="0.25"
      />
      <text x={PAD} y={oneY - 4} fontSize="9" opacity="0.5">
        target 1.0
      </text>
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <circle cx={mx} cy={my} r="5" fill={stroke} data-testid="curve-marker" />
    </svg>
  );
}

function ParamsSliders({
  params,
  onChangeParams,
  dirty,
}: {
  params: SpringParams;
  onChangeParams: (patch: Partial<SpringParams>) => void;
  dirty: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="param-sliders">
      {sliderLabels.map(({ key, label, min, max, step }) => (
        <label key={key} className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          <span className="mb-1 flex justify-between">
            <span>{label}</span>
            <span className="font-mono" data-testid={`param-value-${key}`}>
              {params[key]}
            </span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={params[key]}
            onChange={(e) => onChangeParams({ [key]: Number(e.target.value) })}
            data-testid={`slider-${key}`}
            className="w-full"
          />
        </label>
      ))}
      {dirty ? (
        <p
          className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400"
          data-testid="custom-hint"
        >
          Edited from preset — output uses custom params.
        </p>
      ) : null}
    </div>
  );
}

function SlotControls({
  slots,
  onToggle,
  onPreset,
  onStagger,
}: {
  slots: readonly ComparisonSlot[];
  onToggle: (index: number, enabled: boolean) => void;
  onPreset: (index: number, preset: PresetName | 'custom') => void;
  onStagger: (index: number, stagger: number) => void;
}) {
  const options: (PresetName | 'custom')[] = [
    ...(PRESETS.map((p) => p.value) as PresetName[]),
    'custom',
  ];
  return (
    <div className="space-y-3" data-testid="comparison-slots">
      {slots.map((slot, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={slot.enabled}
              onChange={(e) => onToggle(i, e.target.checked)}
              data-testid={`slot-${i}-enabled`}
            />
            <span>Slot {i + 1}</span>
          </label>
          <select
            value={slot.preset}
            onChange={(e) => onPreset(i, e.target.value as PresetName | 'custom')}
            data-testid={`slot-${i}-preset`}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'custom' ? 'custom (main)' : opt}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <span>stagger</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={slot.stagger}
              onChange={(e) => onStagger(i, Number(e.target.value))}
              data-testid={`slot-${i}-stagger`}
              className="w-28"
            />
            <span className="font-mono">{slot.stagger.toFixed(2)}s</span>
          </label>
        </div>
      ))}
    </div>
  );
}

const SLOT_COLORS = ['#0ea5e9', '#f59e0b', '#10b981'];

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onSaveHistory }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });

  const warnings: SpringWarning[] = React.useMemo(
    () => validateParams(state.params),
    [state.params]
  );
  const analysis = React.useMemo(() => simulateSpring(state.params, 120), [state.params]);
  const linear = React.useMemo(
    () => toLinearEasing(analysis.samples, state.params.stopCount),
    [analysis, state.params.stopCount]
  );
  const keyframes = React.useMemo(
    () => toKeyframesSnippet(analysis.samples, state.params.duration, state.params.stopCount),
    [analysis, state.params]
  );

  const effectiveParams = React.useMemo(() => {
    if (state.autoCorrect && warnings.length > 0) {
      return autoCorrect(state.params, warnings);
    }
    return state.params;
  }, [state.autoCorrect, state.params, warnings]);

  const effectiveAnalysis = React.useMemo(
    () => (warnings.length > 0 ? simulateSpring(effectiveParams, 120) : analysis),
    [analysis, effectiveParams, warnings.length]
  );

  const [playing, setPlaying] = React.useState(true);
  const [progress, setProgress] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);
  const startRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!playing) return;
    const durationMs = Math.max(200, effectiveParams.duration * 1000);
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = ((ts - startRef.current) % (durationMs + 400)) / durationMs;
      setProgress(Math.min(1, Math.max(0, t)));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startRef.current = null;
    };
  }, [playing, effectiveParams.duration]);

  const changeParams = (patch: Partial<SpringParams>) => {
    const next: SpringParams = { ...state.params, ...patch };
    const clamped: SpringParams = {
      ...next,
      stiffness: clamp(next.stiffness, PARAM_LIMITS.stiffness.min, PARAM_LIMITS.stiffness.max),
      damping: clamp(next.damping, PARAM_LIMITS.damping.min, PARAM_LIMITS.damping.max),
      mass: clamp(next.mass, PARAM_LIMITS.mass.min, PARAM_LIMITS.mass.max),
      duration: clamp(next.duration, PARAM_LIMITS.duration.min, PARAM_LIMITS.duration.max),
      stopCount: Math.round(
        clamp(next.stopCount, PARAM_LIMITS.stopCount.min, PARAM_LIMITS.stopCount.max)
      ),
    };
    update({ params: clamped, activePreset: 'custom' });
  };

  const slotParamsFor = (slot: ComparisonSlot, index: number): SpringParams => {
    if (slot.preset === 'custom' || index === 0) {
      return effectiveParams;
    }
    return presetParams(slot.preset);
  };

  const activePresetName = state.activePreset;
  const dirty = activePresetName === 'custom';

  const copyText = async (value: string, testid?: string) => {
    try {
      await navigator.clipboard.writeText(value);
      if (testid) {
        const el = document.querySelector(`[data-copy-feedback="${testid}"]`);
        if (el) {
          el.textContent = 'Copied!';
          window.setTimeout(() => {
            el.textContent = 'Copy';
          }, 1500);
        }
      }
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="space-y-6 overflow-y-auto p-4" data-testid="spring-canvas">
      <div className="flex flex-wrap items-center gap-2" data-testid="preset-tabs">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            title={p.hint}
            data-testid={`preset-${p.value}`}
            onClick={() =>
              update({ params: { ...PRESET_LIBRARY[p.value].params }, activePreset: p.value })
            }
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              activePresetName === p.value
                ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Response curve
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              data-testid="btn-play-pause"
              className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700"
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <span className="font-mono text-xs" data-testid="progress-readout">
              {(progress * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="text-sky-600 dark:text-sky-400">
          <CurveSvg analysis={effectiveAnalysis} progress={progress} stroke="currentColor" />
        </div>

        {state.comparison.some((s) => s.enabled && s.preset !== 'custom') ? (
          <div className="mt-3 space-y-1">
            {state.comparison.map((slot, i) =>
              slot.enabled && slot.preset !== 'custom' ? (
                <div key={i} className="text-xs" data-testid={`comparison-curve-${i}`}>
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: SLOT_COLORS[i] }}
                  />
                  <span className="ml-1">{slot.preset}</span>
                  <span className="ml-2 font-mono text-gray-500">
                    {toLinearEasing(
                      simulateSpring(presetParams(slot.preset), 60).samples,
                      12
                    ).slice(0, 60)}
                    …
                  </span>
                </div>
              ) : null
            )}
          </div>
        ) : null}

        <div
          className="mt-3 rounded-md bg-gray-50 p-3 font-mono text-xs dark:bg-gray-800/60"
          data-testid="value-readout"
        >
          {readoutText(effectiveAnalysis, state.params.duration)}
          <span className="mx-2">|</span>
          displacement {effectiveAnalysis.finalValue.toFixed(3)}
          <span className="mx-2">|</span>
          overshoot {effectiveAnalysis.overshootPercent.toFixed(1)}%
        </div>
      </div>

      <ParamsSliders params={state.params} onChangeParams={changeParams} dirty={dirty} />

      {warnings.length > 0 ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200"
          data-testid="warnings"
        >
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} data-testid={`warning-${w.kind}`}>
                ⚠️ {w.message}
              </li>
            ))}
          </ul>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.autoCorrect}
              onChange={(e) => update({ autoCorrect: e.target.checked })}
              data-testid="auto-correct-toggle"
            />
            <span>Auto-correct invalid spring settings</span>
          </label>
          {state.autoCorrect ? (
            <p className="mt-1 text-amber-700 dark:text-amber-300" data-testid="auto-correct-note">
              Values are corrected for preview:{' '}
              {JSON.stringify(autoCorrect(state.params, warnings))}.
            </p>
          ) : (
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              Preview may be inaccurate with these values — suggested fixes are listed above.
            </p>
          )}
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Compare presets
        </h3>
        <SlotControls
          slots={state.comparison}
          onToggle={(i, enabled) => {
            const next = state.comparison.map((s, idx) => (idx === i ? { ...s, enabled } : s));
            update({ comparison: next as ToolState['comparison'] });
          }}
          onPreset={(i, preset) => {
            const next = state.comparison.map((s, idx) => (idx === i ? { ...s, preset } : s));
            update({ comparison: next as ToolState['comparison'] });
          }}
          onStagger={(i, stagger) => {
            const next = state.comparison.map((s, idx) => (idx === i ? { ...s, stagger } : s));
            update({ comparison: next as ToolState['comparison'] });
          }}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Output
        </h3>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-medium">linear() timing function</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyText(linear, 'copy-linear')}
                  data-testid="copy-linear"
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700"
                >
                  <span data-copy-feedback="copy-linear">Copy</span>
                </button>
                {onSaveHistory ? (
                  <button
                    type="button"
                    onClick={() => onSaveHistory(linear)}
                    data-testid="btn-save-history"
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700"
                  >
                    Save
                  </button>
                ) : null}
              </div>
            </div>
            <pre
              className="max-h-24 overflow-auto rounded-md bg-gray-50 p-2 font-mono text-[11px] dark:bg-gray-800/60"
              data-testid="linear-output"
            >
              {linear}
            </pre>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium">CSS keyframes snippet</span>
              <button
                type="button"
                onClick={() => void copyText(keyframes, 'copy-keyframes')}
                data-testid="copy-keyframes"
                className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700"
              >
                <span data-copy-feedback="copy-keyframes">Copy</span>
              </button>
            </div>
            <pre
              className="max-h-48 overflow-auto rounded-md bg-gray-50 p-2 font-mono text-[11px] dark:bg-gray-800/60"
              data-testid="keyframes-output"
            >
              {keyframes}
            </pre>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          History
        </h3>
        {state.history.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="history-empty">
            No saved easings yet.
          </p>
        ) : (
          <ul className="space-y-1" data-testid="history-list">
            {state.history.map((entry, i) => (
              <li
                key={`${entry.createdAt}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800"
              >
                <span className="truncate font-mono text-gray-700 dark:text-gray-300">
                  {entry.text}
                </span>
                <button
                  type="button"
                  onClick={() => void copyText(entry.text)}
                  className="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700"
                >
                  Copy
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        Spring simulation runs locally in your browser; nothing is uploaded.
      </p>
    </div>
  );
};
