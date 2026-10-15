# Binary Turing Machine Simulator

An interactive, animated single-page simulator for a deterministic Binary Increment Turing Machine $((w + 1)_2)$ built with pure HTML5, CSS3, and Vanilla JavaScript.

## Features
- **Deterministic 1-Tape Turing Machine ($M = (Q, \Sigma, \Gamma, \delta, q_0, B, F)$)**
- **Interactive Infinite Tape:** Real-time animated read/write head with state indicators ($q_0, q_1, q_2, q_{\text{halt}}$) and auto-centering.
- **Dry Run Trace Table:** Step-by-step audit showing state, head index, scanned symbol, write/move operations, carry propagation, and tape snapshots.
- **Transition Table ($\delta$):** Displays all formal transition rules with dynamic active rule highlighting during execution.
- **Controls & Presets:** Run, Pause, Step, and Reset with a speed slider (50ms - 1000ms) and 1-click sample presets (`1011 → 1100`, `111 → 1000`, `10010 → 10011`).
- **Zero Dependencies:** Pure vanilla client-side implementation. Runs locally in any browser by opening `index.html`.

## Live Demo (GitHub Pages)
You can enable GitHub Pages in your repository settings:
1. Go to **Settings** &rarr; **Pages**.
2. Under **Build and deployment** &rarr; **Branch**, select `main` and root (`/`).
3. Click **Save**. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

## Files
- `index.html` - Semantic layout and interface
- `style.css` - Modern dark UI, glassmorphism, responsive grid
- `script.js` - Deterministic Turing Machine engine, trace precomputation, and DOM updates
