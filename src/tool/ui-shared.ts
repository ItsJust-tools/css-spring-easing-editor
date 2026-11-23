import { PRESET_LIBRARY, PRESET_NAMES, type PresetName, type ToolState } from './types';

export const PRESETS: { value: PresetName; label: string; hint: string }[] = PRESET_NAMES.map(
  (name) => ({
    value: name,
    label: PRESET_LIBRARY[name].label,
    hint: `stiffness ${PRESET_LIBRARY[name].params.stiffness}, damping ${PRESET_LIBRARY[name].params.damping}, mass ${PRESET_LIBRARY[name].params.mass}`,
  })
);

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return typeof v.params === 'object' && v.params !== null && Array.isArray(v.comparison);
}
