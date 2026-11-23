# CSS Spring Easing Editor

Design and tune spring-physics CSS easings with an interactive curve preview, live bounce visualization, and copy-ready `linear()` timing function output.

**Live:** [css-spring-easing-editor.itsjust.tools](https://css-spring-easing-editor.itsjust.tools)

## Features

- Interactive spring model — stiffness, damping, mass, initial/final velocity, duration, and stop-count sliders
- Live SVG response curve with an animating position marker (play/pause with `Space`)
- Side-by-side comparison of up to 3 spring presets with adjustable stagger timing
- Real-time readout of displacement, velocity, settle time, and overshoot %
- Preset library (bounce, elastic, snappy, gentle, stiff) plus custom tuning
- Validation warnings for negative damping, negative stiffness, non-positive mass, and unstable springs, with an auto-correct toggle
- Undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`) of parameter changes
- Copyable output: `linear()` function, keyframes snippet, shareable URL state, and image/PDF export
- 100% client-side — no data ever leaves your browser

## Keyboard shortcuts

| Key            | Action                   |
| -------------- | ------------------------ |
| `Space`        | Play / pause the preview |
| `Ctrl+Z`       | Undo parameter change    |
| `Ctrl+Shift+Z` | Redo                     |
| `C`            | Copy `linear()` output   |

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t itsjust-css-spring-easing-editor .
docker run -p 3000:3000 itsjust-css-spring-easing-editor
```

## License

MIT
