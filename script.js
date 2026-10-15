/**
 * ============================================================================
 * Binary Turing Machine Simulator
 * Single-Page Deterministic Turing Machine (DTM) Implementation
 * ============================================================================
 * 
 * Formal Theoretical Definition:
 * The Turing Machine M is a 7-tuple: M = (Q, Σ, Γ, δ, q0, B, F)
 * 
 * Where:
 *   - Q  = {q0, q1, q2, q_halt}   (Finite set of internal states)
 *   - Σ  = {0, 1}                  (Input alphabet)
 *   - Γ  = {0, 1, B}               (Tape alphabet, where B is Blank)
 *   - q0 = 'q0'                    (Start state: seek rightmost bit)
 *   - B  = 'B' (displayed as '␣')  (Blank symbol padding tape infinitely)
 *   - F  = {q_halt}                (Set of accepting / halting states)
 *   - δ  = Q × Γ → Q × Γ × {L, R}  (Deterministic transition function)
 * 
 * Algorithm for Binary Increment ((w + 1)₂):
 *   Phase 1 (q0 - Scan Right):
 *     Traverse rightward across all digits without modifying them until
 *     reaching the blank symbol immediately after the least significant bit (LSB).
 *     Upon reading Blank, move Left by 1 cell to the LSB and switch to state q1.
 * 
 *   Phase 2 (q1 - Increment & Ripple Carry):
 *     Start addition with Carry = 1 moving leftwards:
 *       • If read '1': 1 + 1 = 0 with carry 1. Write '0', move Left, stay in q1.
 *       • If read '0': 0 + 1 = 1 with carry 0. Write '1', move Left, transition to q2.
 *       • If read Blank 'B': Carry overflowed past MSB (e.g., 111 -> 1000).
 *         Write '1', move Left, transition to q2.
 * 
 *   Phase 3 (q2 - Rewind to MSB):
 *     Traverse leftward across the tape until reading the blank before the number.
 *     Upon reading Blank, shift Right by 1 cell to position head on the MSB,
 *     and transition to q_halt.
 * ============================================================================
 */

// Constant definitions for the Turing Machine tape symbols
const BLANK = 'B';              // Internal representation of blank symbol
const DISPLAY_BLANK = '␣';      // Human-readable visual character for UI display

/**
 * Transition Table Rules: δ(CurrentState, ReadSymbol) = (NextState, WriteSymbol, MoveDirection)
 * Each rule contains metadata for live trace explanations and UI highlighting.
 */
const TRANSITION_RULES = [
  {
    id: 'R1',
    state: 'q0',
    read: '0',
    write: '0',
    move: 'R',
    next: 'q0',
    desc: 'Scanning: Read 0, keep 0, move Right toward LSB'
  },
  {
    id: 'R2',
    state: 'q0',
    read: '1',
    write: '1',
    move: 'R',
    next: 'q0',
    desc: 'Scanning: Read 1, keep 1, move Right toward LSB'
  },
  {
    id: 'R3',
    state: 'q0',
    read: 'B',
    write: 'B',
    move: 'L',
    next: 'q1',
    desc: 'End of number reached: move Left to LSB, initialize addition (Carry = 1)'
  },
  {
    id: 'R4',
    state: 'q1',
    read: '1',
    write: '0',
    move: 'L',
    next: 'q1',
    desc: '1 + 1 = 0 (Carry = 1): write 0, move Left, propagate carry'
  },
  {
    id: 'R5',
    state: 'q1',
    read: '0',
    write: '1',
    move: 'L',
    next: 'q2',
    desc: '0 + 1 = 1 (Carry = 0): write 1, carry absorbed, move Left to rewind'
  },
  {
    id: 'R6',
    state: 'q1',
    read: 'B',
    write: '1',
    move: 'L',
    next: 'q2',
    desc: 'Blank + Carry 1 = 1 (Overflow): write 1 into blank cell, move Left to rewind'
  },
  {
    id: 'R7',
    state: 'q2',
    read: '0',
    write: '0',
    move: 'L',
    next: 'q2',
    desc: 'Rewinding: Read 0, keep 0, move Left toward MSB'
  },
  {
    id: 'R8',
    state: 'q2',
    read: '1',
    write: '1',
    move: 'L',
    next: 'q2',
    desc: 'Rewinding: Read 1, keep 1, move Left toward MSB'
  },
  {
    id: 'R9',
    state: 'q2',
    read: 'B',
    write: 'B',
    move: 'R',
    next: 'q_halt',
    desc: 'Found left blank: move Right to MSB and HALT (Increment complete)'
  }
];

/**
 * State color map matching CSS variables for visual consistency
 */
const STATE_COLORS = {
  'q0': 'var(--color-q0)',      // Cyan / Sky: Scan Right
  'q1': 'var(--color-q1)',      // Amber / Gold: Add & Carry
  'q2': 'var(--color-q2)',      // Violet / Purple: Rewind Left
  'q_halt': 'var(--color-halt)' // Emerald: Accept & Halt
};

/**
 * Optional Web Audio synthesizer for presentation sound effects
 * Synthesizes sound directly in browser without any external audio files.
 */
class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  // Lazy-initialize AudioContext on first user interaction
  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Soft mechanical click when head moves
  playTick() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {
      // Audio playback restrictions handled gracefully
    }
  }

  // Triumphant chime when reaching q_halt
  playVictory() {
    try {
      this.init();
      if (!this.ctx) return;
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C chord
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, this.ctx.currentTime + i * 0.05);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.05 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.05);
        osc.stop(this.ctx.currentTime + i * 0.05 + 0.38);
      });
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }
}

/**
 * Main Controller: SinglePageTMSimulator
 * Manages simulation state, tape memory, execution trace, and DOM rendering.
 */
class SinglePageTMSimulator {
  constructor() {
    // Current input string on the tape
    this.initialInput = '1011';

    // Full precomputed execution trace array
    this.trace = [];

    // Current step pointer in the trace (0 .. trace.length - 1)
    this.currentStep = 0;

    // Simulation playback status
    this.isRunning = false;
    this.timer = null;
    this.speed = 450; // Milliseconds per transition

    // Audio synthesizer
    this.audio = new SoundEffects();

    // Cache essential DOM elements for high-performance updates
    this.el = {
      // Input bar
      binaryInput: document.getElementById('binaryInput'),
      clearInputBtn: document.getElementById('clearInputBtn'),
      loadBtn: document.getElementById('loadBtn'),
      presetBtns: document.querySelectorAll('.preset-btn'),

      // Playback buttons
      runBtn: document.getElementById('runBtn'),
      pauseBtn: document.getElementById('pauseBtn'),
      stepBtn: document.getElementById('stepBtn'),
      resetBtn: document.getElementById('resetBtn'),

      // Speed & Counter displays
      speedSlider: document.getElementById('speedSlider'),
      speedLabel: document.getElementById('speedLabel'),
      currentStepDisplay: document.getElementById('currentStepDisplay'),
      totalStepDisplay: document.getElementById('totalStepDisplay'),

      // Tape Visualizer elements
      tapeViewport: document.getElementById('tapeViewport'),
      tapeHead: document.getElementById('tapeHead'),
      headStateBadge: document.getElementById('headStateBadge'),
      tapeTrack: document.getElementById('tapeTrack'),
      centerHeadBtn: document.getElementById('centerHeadBtn'),

      // Machine Status HUD
      statState: document.getElementById('statState'),
      statHeadPos: document.getElementById('statHeadPos'),
      statReadSymbol: document.getElementById('statReadSymbol'),
      statCarry: document.getElementById('statCarry'),
      statAction: document.getElementById('statAction'),
      statResult: document.getElementById('statResult'),

      // Data Tables
      dryRunTableBody: document.getElementById('dryRunTableBody'),
      transitionTableBody: document.getElementById('transitionTableBody'),

      // Notification toast container
      toastContainer: document.getElementById('toastContainer')
    };

    // Initialize application
    this.init();
  }

  /**
   * Initializes the application: renders static transition rules,
   * attaches event listeners, and loads default input.
   */
  init() {
    this.renderTransitionTable();
    this.bindEvents();
    this.loadInput(this.initialInput);
  }

  /**
   * Precomputes the complete deterministic execution trace.
   * Because the binary increment machine is deterministic and guaranteed
   * to halt in O(n) steps, precomputing allows instant time-travel,
   * clicking any step in the table to jump to it, and smooth playback.
   * 
   * @param {string} inputStr - The binary string to increment
   * @returns {Array<Object>} List of step snapshots
   */
  computeTrace(inputStr) {
    const history = [];
    
    // Tape is modeled as a hash map where keys are integer indices (..., -2, -1, 0, 1, 2, ...)
    // This allows infinite expansion in both negative and positive directions seamlessly.
    const tape = {};
    for (let i = 0; i < inputStr.length; i++) {
      tape[i] = inputStr[i];
    }

    let head = 0;           // Head begins on leftmost input bit (index 0)
    let state = 'q0';       // Start state
    let stepCount = 0;
    const maxSteps = 1000;  // Safety boundary against infinite loops

    while (state !== 'q_halt' && stepCount < maxSteps) {
      // Read current symbol from tape, default to Blank 'B' if uninitialized
      const readSym = tape[head] !== undefined ? tape[head] : BLANK;

      // Find transition rule δ(state, readSym)
      const rule = TRANSITION_RULES.find(r => r.state === state && r.read === readSym);
      if (!rule) {
        console.warn(`Undefined transition for δ(${state}, ${readSym})`);
        break;
      }

      // Compute carry flag for educational inspection
      // Carry is 1 when in q1 with bit 1, or when entering q1 from right blank
      const carryVal = (state === 'q1' && readSym === '1') || (state === 'q0' && readSym === 'B') ? 1 : 0;
      const currentBin = this.getTapeString(tape);

      // Record snapshot before applying transition
      history.push({
        step: stepCount,
        state: state,
        head: head,
        read: readSym,
        write: rule.write,
        move: rule.move,
        nextState: rule.next,
        carry: carryVal,
        tapeSnapshot: { ...tape }, // Shallow copy of tape map
        tapeString: currentBin,
        ruleId: rule.id,
        explanation: rule.desc
      });

      // Write symbol to tape cell
      tape[head] = rule.write;

      // Shift head direction
      if (rule.move === 'R') {
        head++;
      } else if (rule.move === 'L') {
        head--;
      }

      // Transition to next state
      state = rule.next;
      stepCount++;
    }

    // Append final halted state snapshot
    history.push({
      step: stepCount,
      state: 'q_halt',
      head: head,
      read: tape[head] !== undefined ? tape[head] : BLANK,
      write: tape[head] !== undefined ? tape[head] : BLANK,
      move: 'HALT',
      nextState: 'q_halt',
      carry: 0,
      tapeSnapshot: { ...tape },
      tapeString: this.getTapeString(tape),
      ruleId: null,
      explanation: 'Increment complete. Machine halted cleanly.',
      isHalted: true
    });

    return history;
  }

  /**
   * Extracts clean, contiguous binary digits from the tape dictionary.
   * 
   * @param {Object} tape - Map of index to symbol
   * @returns {string} Truncated binary string
   */
  getTapeString(tape) {
    const keys = Object.keys(tape)
      .map(Number)
      .filter(k => tape[k] === '0' || tape[k] === '1')
      .sort((a, b) => a - b);

    if (!keys.length) return '0';
    return keys.map(k => tape[k]).join('');
  }

  /**
   * Loads a binary string onto the tape, sanitizes it,
   * recomputes the execution trace, and resets viewport.
   * 
   * @param {string} raw - Input string
   */
  loadInput(raw) {
    this.pause();

    // Sanitize: filter out any character that is not '0' or '1'
    let sanitized = String(raw).replace(/[^01]/g, '');
    if (!sanitized) {
      sanitized = '0';
      this.showToast('Input defaulted to "0" (empty/invalid input)');
    }

    this.initialInput = sanitized;
    this.el.binaryInput.value = sanitized;

    // Precompute full run
    this.trace = this.computeTrace(sanitized);
    this.currentStep = 0;
    this.el.totalStepDisplay.textContent = this.trace.length - 1;

    // Refresh UI components
    this.renderDryRunTable();
    this.renderCurrentStep();
    this.centerHead();
  }

  /**
   * Renders the current state of the machine onto the UI:
   * updates status cards, tape cells, head pointer, and highlights active rows.
   */
  renderCurrentStep() {
    const item = this.trace[this.currentStep];
    if (!item) return;

    // 1. Step Progress Counter
    this.el.currentStepDisplay.textContent = item.step;

    // 2. State & Colors
    this.el.statState.textContent = item.state;
    this.el.statState.style.color = STATE_COLORS[item.state] || 'var(--color-q0)';
    this.el.headStateBadge.textContent = item.state;
    this.el.headStateBadge.style.background = STATE_COLORS[item.state] || 'var(--color-q0)';
    this.el.headStateBadge.style.color = '#ffffff';

    const pointer = this.el.tapeHead.querySelector('.head-pointer');
    if (pointer) {
      pointer.style.color = STATE_COLORS[item.state] || 'var(--color-q0)';
    }

    // 3. Head Position & Scanned Symbol
    this.el.statHeadPos.textContent = item.head;
    const readDisp = item.read === BLANK ? DISPLAY_BLANK : item.read;
    this.el.statReadSymbol.textContent = readDisp;

    // 4. Carry Flag
    this.el.statCarry.textContent = item.carry;

    // 5. Action (Write, Direction)
    if (item.isHalted) {
      this.el.statAction.textContent = 'HALTED';
      this.el.statAction.style.color = 'var(--color-halt)';
    } else {
      const writeDisp = item.write === BLANK ? DISPLAY_BLANK : item.write;
      this.el.statAction.textContent = `Write ${writeDisp}, ${item.move}`;
      this.el.statAction.style.color = 'var(--text-main)';
    }

    // 6. Live Result on Tape
    this.el.statResult.textContent = item.tapeString;

    // 7. Render dynamic tape cells
    this.renderTape(item);

    // 8. Synchronize table highlights
    this.updateActiveDryRunRow();
    this.updateActiveTransitionRule(item.ruleId);

    // 9. Audio & Completion handling
    if (item.isHalted && this.isRunning) {
      this.pause();
      this.audio.playVictory();
      this.showToast('Turing Machine Halted: Increment Complete! 🎉');
    }
  }

  /**
   * Renders the tape cells inside the viewport around the active head.
   * 
   * @param {Object} item - Step snapshot data
   */
  renderTape(item) {
    const tape = item.tapeSnapshot;
    const head = item.head;

    // Determine viewport window: pad cells around non-blank range & head
    const indices = Object.keys(tape).map(Number);
    let min = Math.min(-2, head - 4);
    let max = Math.max(this.initialInput.length + 1, head + 4);
    if (indices.length) {
      min = Math.min(min, ...indices) - 2;
      max = Math.max(max, ...indices) + 2;
    }

    this.el.tapeTrack.innerHTML = '';
    for (let i = min; i <= max; i++) {
      const cell = document.createElement('div');
      cell.className = `tape-cell ${i === head ? 'active-head' : ''}`;
      
      const sym = tape[i] !== undefined ? tape[i] : BLANK;
      const isBlank = sym === BLANK;

      cell.innerHTML = `
        <span class="cell-symbol ${isBlank ? 'blank' : ''}">${isBlank ? DISPLAY_BLANK : sym}</span>
        <span class="cell-index">${i}</span>
      `;
      this.el.tapeTrack.appendChild(cell);
    }

    // Keep head positioned in view
    this.centerHead();
  }

  /**
   * Smoothly scrolls the tape viewport to center on the active cell.
   */
  centerHead() {
    const activeCell = this.el.tapeTrack.querySelector('.tape-cell.active-head');
    if (!activeCell) return;
    const viewport = this.el.tapeViewport;
    const cellRect = activeCell.getBoundingClientRect();
    const vpRect = viewport.getBoundingClientRect();
    const offset = (cellRect.left - vpRect.left) - (vpRect.width / 2) + (cellRect.width / 2);
    viewport.scrollBy({ left: offset, behavior: 'smooth' });
  }

  /**
   * Generates the Dry Run Trace Table with all step rows.
   * Clicking any step row jumps the simulator to that step.
   */
  renderDryRunTable() {
    this.el.dryRunTableBody.innerHTML = '';

    this.trace.forEach((row, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.step = idx;
      if (idx === this.currentStep) tr.classList.add('active-trace-row');

      const readDisp = row.read === BLANK ? DISPLAY_BLANK : row.read;
      const writeDisp = row.write === BLANK ? DISPLAY_BLANK : row.write;
      const actionText = row.isHalted ? 'HALT' : `${writeDisp}, ${row.move}`;

      // Highlight head bit inside mini tape string
      const tapeDisp = this.formatMiniTape(row.tapeSnapshot, row.head);

      tr.innerHTML = `
        <td><strong>#${row.step}</strong></td>
        <td style="color:${STATE_COLORS[row.state] || 'var(--text-main)'}; font-weight: 600;">${row.state}</td>
        <td>${row.head}</td>
        <td><code>${readDisp}</code></td>
        <td>${actionText}</td>
        <td style="color:${STATE_COLORS[row.nextState] || 'var(--text-main)'}; font-weight: 600;">${row.nextState}</td>
        <td>${row.carry}</td>
        <td>${tapeDisp}</td>
        <td style="font-size: 0.78rem; color: var(--text-sub);">${row.explanation}</td>
      `;

      // Interactive jump-to-step on row click
      tr.addEventListener('click', () => {
        this.pause();
        this.currentStep = idx;
        this.audio.playTick();
        this.renderCurrentStep();
      });

      this.el.dryRunTableBody.appendChild(tr);
    });
  }

  /**
   * Formats tape string snapshot for table cell with head highlight badge.
   * 
   * @param {Object} tape - Tape map
   * @param {number} head - Active head index
   * @returns {string} HTML snippet
   */
  formatMiniTape(tape, head) {
    const keys = Object.keys(tape).map(Number).sort((a, b) => a - b);
    let min = keys.length ? Math.min(...keys, head) : head;
    let max = keys.length ? Math.max(...keys, head) : head;

    let html = '<span class="tape-mini-str">';
    for (let i = min; i <= max; i++) {
      const char = tape[i] !== undefined ? tape[i] : DISPLAY_BLANK;
      const d = char === BLANK ? DISPLAY_BLANK : char;
      if (i === head) {
        html += `<span class="head-bit">${d}</span>`;
      } else {
        html += d;
      }
    }
    html += '</span>';
    return html;
  }

  /**
   * Highlights the active step row in the Dry Run table and keeps it visible.
   */
  updateActiveDryRunRow() {
    const rows = this.el.dryRunTableBody.querySelectorAll('tr');
    rows.forEach(r => r.classList.remove('active-trace-row'));

    const target = this.el.dryRunTableBody.querySelector(`tr[data-step="${this.currentStep}"]`);
    if (target) {
      target.classList.add('active-trace-row');
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Populates the formal Transition Function Table δ(q, σ).
   */
  renderTransitionTable() {
    this.el.transitionTableBody.innerHTML = '';

    TRANSITION_RULES.forEach(r => {
      const tr = document.createElement('tr');
      tr.dataset.ruleId = r.id;

      const readDisp = r.read === BLANK ? `${DISPLAY_BLANK} (Blank)` : r.read;
      const writeDisp = r.write === BLANK ? `${DISPLAY_BLANK} (Blank)` : r.write;

      tr.innerHTML = `
        <td><strong style="color:var(--color-q0);">${r.id}</strong></td>
        <td style="color:${STATE_COLORS[r.state]}; font-weight: 600;">${r.state}</td>
        <td><code>${readDisp}</code></td>
        <td><code>${writeDisp}</code></td>
        <td><strong>${r.move}</strong></td>
        <td style="color:${STATE_COLORS[r.next]}; font-weight: 600;">${r.next}</td>
        <td style="font-size: 0.78rem; color: var(--text-sub);">${r.desc}</td>
      `;
      this.el.transitionTableBody.appendChild(tr);
    });
  }

  /**
   * Highlights the transition rule row currently firing in the simulation.
   * 
   * @param {string|null} ruleId - Rule ID (e.g. 'R1') or null if halted
   */
  updateActiveTransitionRule(ruleId) {
    const rows = this.el.transitionTableBody.querySelectorAll('tr');
    rows.forEach(r => r.classList.remove('active-rule-row'));

    if (ruleId) {
      const target = this.el.transitionTableBody.querySelector(`tr[data-rule-id="${ruleId}"]`);
      if (target) target.classList.add('active-rule-row');
    }
  }

  // ==========================================
  // PLAYBACK CONTROLS
  // ==========================================

  /**
   * Starts automatic step-by-step playback.
   */
  run() {
    if (this.isRunning) return;

    // If at the end of the simulation, restart from step 0
    if (this.currentStep >= this.trace.length - 1) {
      this.currentStep = 0;
    }

    this.isRunning = true;
    this.el.runBtn.style.opacity = '0.6';
    this.el.pauseBtn.style.opacity = '1';

    this.timer = setInterval(() => {
      this.step();
    }, this.speed);
  }

  /**
   * Pauses automatic playback.
   */
  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.timer);
    this.timer = null;
    this.el.runBtn.style.opacity = '1';
  }

  /**
   * Executes a single transition step forward.
   */
  step() {
    if (this.currentStep < this.trace.length - 1) {
      this.currentStep++;
      this.audio.playTick();
      this.renderCurrentStep();
    } else {
      this.pause();
    }
  }

  /**
   * Resets simulation to initial state (step 0).
   */
  reset() {
    this.pause();
    this.currentStep = 0;
    this.renderCurrentStep();
    this.centerHead();
    this.showToast('Reset tape to initial state');
  }

  /**
   * Binds UI event listeners and keyboard shortcuts.
   */
  bindEvents() {
    // Playback buttons
    this.el.runBtn.addEventListener('click', () => this.run());
    this.el.pauseBtn.addEventListener('click', () => this.pause());
    this.el.stepBtn.addEventListener('click', () => {
      this.pause();
      this.step();
    });
    this.el.resetBtn.addEventListener('click', () => this.reset());

    // Speed slider adjustment
    this.el.speedSlider.addEventListener('input', (e) => {
      this.speed = parseInt(e.target.value, 10);
      this.el.speedLabel.textContent = `${this.speed}ms`;
      if (this.isRunning) {
        clearInterval(this.timer);
        this.timer = setInterval(() => this.step(), this.speed);
      }
    });

    // Input submission
    this.el.loadBtn.addEventListener('click', () => {
      this.loadInput(this.el.binaryInput.value);
    });

    this.el.binaryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.loadInput(this.el.binaryInput.value);
      }
    });

    // Clear input button
    this.el.clearInputBtn.addEventListener('click', () => {
      this.el.binaryInput.value = '';
      this.el.binaryInput.focus();
    });

    // Preset sample buttons
    this.el.presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.input;
        this.loadInput(val);
        this.showToast(`Loaded sample input: ${val}`);
      });
    });

    // Re-center tape button
    this.el.centerHeadBtn.addEventListener('click', () => this.centerHead());

    // Keyboard Shortcuts: Space (Run/Pause), ArrowRight (Step), 'R' (Reset)
    window.addEventListener('keydown', (e) => {
      // Ignore shortcuts if the user is typing in the binary input field
      if (document.activeElement === this.el.binaryInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.isRunning ? this.pause() : this.run();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        this.pause();
        this.step();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        this.reset();
      }
    });
  }

  /**
   * Displays a temporary notification toast message.
   * 
   * @param {string} msg - Message to display
   */
  showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.el.toastContainer.appendChild(t);

    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 250);
    }, 2500);
  }
}

// Bootstrap application on DOM readiness
document.addEventListener('DOMContentLoaded', () => {
  window.sim = new SinglePageTMSimulator();
});
