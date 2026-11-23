'use client';

import React from 'react';
import { PRESETS } from '../ui-shared';
import type { ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange: _onChange }) => {
  return (
    <div className="space-y-6 overflow-y-auto p-4 text-sm" data-testid="spring-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Presets</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {PRESETS.map((p: { value: string; label: string; hint: string }) => (
            <li key={p.value} className="flex justify-between gap-2">
              <span>{p.label}</span>
              <span className="text-gray-500 dark:text-gray-400">{p.hint}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Saved easings</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} entr{state.history.length === 1 ? 'y' : 'ies'} in history
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Keyboard shortcuts</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <kbd>Space</kbd> — play / pause preview
          </li>
          <li>
            <kbd>Ctrl+Z</kbd> — undo
          </li>
          <li>
            <kbd>Ctrl+Shift+Z</kbd> — redo
          </li>
          <li>
            <kbd>C</kbd> — copy linear() output
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the current spring parameters;
          opening it restores the tuning, presets and comparison slots.
        </p>
      </div>
    </div>
  );
};
