import type { ExportFormat } from '@itsjust/core';

const toolConfig = {
  id: 'css-spring-easing-editor',
  name: 'CSS Spring Easing Editor',
  category: 'Design',
  description:
    'Design and tune spring-physics CSS easings with an interactive curve preview, live bounce visualization, and copy-ready linear() timing function output.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf', 'json'] satisfies ExportFormat[],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#0ea5e9',
    accentHover: '#0284c7',
    accentSubtle: 'rgba(14, 165, 233, 0.15)',
    brand: 'CSS Spring Easing Editor',
    icon: '🌀',
  },
  shortcuts: [
    {
      title: 'Spring Editor',
      shortcuts: [
        { keys: 'Space', label: 'Play / pause', description: 'play or pause the curve preview' },
        { keys: 'Mod+Z', label: 'Undo', description: 'undo the last parameter change' },
        { keys: 'Mod+Shift+Z', label: 'Redo', description: 'redo a previously undone change' },
        {
          keys: 'C',
          label: 'Copy linear()',
          description: 'copy the linear() easing to the clipboard',
        },
      ],
    },
  ],
};

export default toolConfig;
