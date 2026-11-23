export interface SpringParams {
  /** Spring stiffness (N/m equivalent). Larger = faster response. */
  stiffness: number;
  /** Damping coefficient. Lower = more oscillation. */
  damping: number;
  /** Mass attached to the spring. */
  mass: number;
  /** Initial velocity at animation start (position units per second). */
  initialVelocity: number;
  /** Final velocity at animation end. */
  finalVelocity: number;
  /** Preview duration in seconds. */
  duration: number;
  /** Number of emitted linear() stop points. */
  stopCount: number;
}

export type PresetName = 'bounce' | 'elastic' | 'snappy' | 'gentle' | 'stiff';

export interface SpringPreset {
  name: PresetName;
  label: string;
  params: SpringParams;
}

/** State of one comparison slot: which preset (or 'custom') it shows. */
export interface ComparisonSlot {
  enabled: boolean;
  preset: PresetName | 'custom';
  /** Stagger offset in seconds for this slot. */
  stagger: number;
}

export interface ToolState {
  /** Active spring parameters for the main editor. */
  params: SpringParams;
  /** Name of the preset currently loaded, or 'custom' when edited. */
  activePreset: PresetName | 'custom';
  /** Comparison slots (up to 3). */
  comparison: [ComparisonSlot, ComparisonSlot, ComparisonSlot];
  /** Whether validation warnings are auto-corrected when detected. */
  autoCorrect: boolean;
  /** Saved calculation history, newest first. */
  history: HistoryEntry[];
}

export interface HistoryEntry {
  text: string;
  createdAt: string;
}

/** Physical warning produced by validating spring parameters. */
export interface SpringWarning {
  kind: 'negative-damping' | 'negative-stiffness' | 'nonpositive-mass' | 'unstable' | 'nonfinite';
  message: string;
  fix: Partial<SpringParams>;
}

export const PARAM_LIMITS = {
  stiffness: { min: 1, max: 500 },
  damping: { min: 0.1, max: 100 },
  mass: { min: 0.1, max: 20 },
  initialVelocity: { min: -50, max: 50 },
  finalVelocity: { min: -50, max: 50 },
  duration: { min: 0.2, max: 10 },
  stopCount: { min: 4, max: 100 },
} as const;

export const DEFAULT_PARAMS: SpringParams = {
  stiffness: 100,
  damping: 10,
  mass: 1,
  initialVelocity: 0,
  finalVelocity: 0,
  duration: 1.2,
  stopCount: 24,
};

export const DEFAULT_STATE: ToolState = {
  params: { ...DEFAULT_PARAMS },
  activePreset: 'bounce',
  comparison: [
    { enabled: true, preset: 'bounce', stagger: 0 },
    { enabled: false, preset: 'snappy', stagger: 0.15 },
    { enabled: false, preset: 'gentle', stagger: 0.3 },
  ],
  autoCorrect: true,
  history: [],
};

export const PRESET_LIBRARY: Record<PresetName, SpringPreset> = {
  bounce: {
    name: 'bounce',
    label: 'Bounce',
    params: {
      stiffness: 300,
      damping: 8,
      mass: 1,
      initialVelocity: 0,
      finalVelocity: 0,
      duration: 1.6,
      stopCount: 40,
    },
  },
  elastic: {
    name: 'elastic',
    label: 'Elastic',
    params: {
      stiffness: 220,
      damping: 6,
      mass: 1.2,
      initialVelocity: 0,
      finalVelocity: 0,
      duration: 2,
      stopCount: 48,
    },
  },
  snappy: {
    name: 'snappy',
    label: 'Snappy',
    params: {
      stiffness: 420,
      damping: 26,
      mass: 1,
      initialVelocity: 0,
      finalVelocity: 0,
      duration: 0.7,
      stopCount: 20,
    },
  },
  gentle: {
    name: 'gentle',
    label: 'Gentle',
    params: {
      stiffness: 120,
      damping: 28,
      mass: 1,
      initialVelocity: 0,
      finalVelocity: 0,
      duration: 1.1,
      stopCount: 20,
    },
  },
  stiff: {
    name: 'stiff',
    label: 'Stiff',
    params: {
      stiffness: 500,
      damping: 50,
      mass: 1,
      initialVelocity: 0,
      finalVelocity: 0,
      duration: 0.5,
      stopCount: 16,
    },
  },
};

export const PRESET_NAMES: PresetName[] = ['bounce', 'elastic', 'snappy', 'gentle', 'stiff'];

export const MAX_HISTORY = 20;
