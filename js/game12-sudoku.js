(function (root) {
  'use strict';

  /* ---------- Engine: thuần logic, chạy được cả trong Node để test ---------- */

  function createRng(seed) {
    let value = (Number(seed) >>> 0) || 0x9e3779b9;
    return function next() {
      value = (value + 0x6d2b79f5) >>> 0;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, rng) {
    const list = items.slice();
    for (let index = list.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(rng() * (index + 1));
      [list[index], list[swap]] = [list[swap], list[index]];
    }
    return list;
  }

  function createLayout(size, boxRows, boxCols) {
    if (!Number.isInteger(size) || size < 2 || boxRows * boxCols !== size) {
      throw new Error(`Kích thước Sudoku không hợp lệ: ${size} (${boxRows}×${boxCols})`);
    }
    const peers = [];
    for (let index = 0; index < size * size; index += 1) {
      const row = Math.floor(index / size);
      const col = index % size;
      const boxRow = row - (row % boxRows);
      const boxCol = col - (col % boxCols);
      const set = new Set();
      for (let k = 0; k < size; k += 1) {
        set.add(row * size + k);
        set.add(k * size + col);
      }
      for (let r = boxRow; r < boxRow + boxRows; r += 1) {
        for (let c = boxCol; c < boxCol + boxCols; c += 1) set.add(r * size + c);
      }
      set.delete(index);
      peers.push(Array.from(set));
    }
    return { size, boxRows, boxCols, peers };
  }

  function candidatesFor(grid, index, layout) {
    const used = new Set();
    for (const peer of layout.peers[index]) if (grid[peer]) used.add(grid[peer]);
    const result = [];
    for (let value = 1; value <= layout.size; value += 1) if (!used.has(value)) result.push(value);
    return result;
  }

  function pickEmptyCell(grid, layout) {
    let best = -1;
    let bestCandidates = null;
    for (let index = 0; index < grid.length; index += 1) {
      if (grid[index]) continue;
      const candidates = candidatesFor(grid, index, layout);
      if (!bestCandidates || candidates.length < bestCandidates.length) {
        best = index;
        bestCandidates = candidates;
        if (candidates.length <= 1) break;
      }
    }
    return { index: best, candidates: bestCandidates || [] };
  }

  function countSolutions(grid, layout, limit = 2) {
    const work = grid.slice();
    let count = 0;
    (function solve() {
      if (count >= limit) return;
      const { index, candidates } = pickEmptyCell(work, layout);
      if (index === -1) {
        count += 1;
        return;
      }
      for (const value of candidates) {
        work[index] = value;
        solve();
        if (count >= limit) break;
      }
      work[index] = 0;
    })();
    return count;
  }

  function generateSolution(layout, rng) {
    const grid = new Array(layout.size * layout.size).fill(0);
    (function fill() {
      const { index, candidates } = pickEmptyCell(grid, layout);
      if (index === -1) return true;
      for (const value of shuffle(candidates, rng)) {
        grid[index] = value;
        if (fill()) return true;
      }
      grid[index] = 0;
      return false;
    })();
    return grid;
  }

  function generatePuzzle({ size, boxRows, boxCols, givens }, seed) {
    const layout = createLayout(size, boxRows, boxCols);
    const rng = createRng(seed);
    const solution = generateSolution(layout, rng);
    const puzzle = solution.slice();
    const target = Math.max(0, Math.min(size * size, Number(givens) || 0));
    let filled = puzzle.length;
    for (const index of shuffle(puzzle.map((_, i) => i), rng)) {
      if (filled <= target) break;
      const saved = puzzle[index];
      puzzle[index] = 0;
      if (countSolutions(puzzle, layout, 2) === 1) filled -= 1;
      else puzzle[index] = saved;
    }
    return { puzzle, solution, layout };
  }

  function findConflicts(grid, layout) {
    const conflicts = new Set();
    grid.forEach((value, index) => {
      if (!value) return;
      for (const peer of layout.peers[index]) {
        if (grid[peer] === value) {
          conflicts.add(index);
          break;
        }
      }
    });
    return conflicts;
  }

  function isSolved(grid, layout) {
    return grid.every(Boolean) && findConflicts(grid, layout).size === 0;
  }

  const engine = Object.freeze({
    createRng,
    createLayout,
    countSolutions,
    generateSolution,
    generatePuzzle,
    findConflicts,
    isSolved
  });

  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (!root || !root.document) return;
  root.BongSudokuEngine = engine;

  /* ---------- Giao diện ---------- */

  const document = root.document;
  const CONTENT_URL = './content/games/game12.json';
  const SAVE_KEY = 'bonghome_game12_sudoku';
  const FALLBACK_CONTENT = {
    schemaVersion: 1,
    defaultLevelId: 'mam',
    levels: [
      { id: 'mam', label: '🌱 Mầm', size: 4, boxRows: 2, boxCols: 2, givens: 8, symbols: ['🍎', '🍌', '🍇', '🍓'], symbolNames: ['Táo', 'Chuối', 'Nho', 'Dâu'] },
      { id: 'choi', label: '🌿 Chồi', size: 6, boxRows: 2, boxCols: 3, givens: 18, symbols: ['1', '2', '3', '4', '5', '6'] },
      { id: 'cay', label: '🌳 Cây', size: 9, boxRows: 3, boxCols: 3, givens: 38, notes: true, symbols: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] }
    ]
  };

  const state = {
    levels: [],
    level: null,
    layout: null,
    givens: [],
    solution: [],
    values: [],
    notes: [],
    notesMode: false,
    selected: -1,
    hints: 0,
    solved: false,
    saved: {}
  };
  const els = {};
  let audioContext = null;

  function announce(message) {
    if (els.status) els.status.textContent = message;
  }

  function soundEnabled() {
    try { return root.BongSound?.isEnabled?.() !== false; }
    catch (error) { return true; }
  }

  function playTone(frequencies, duration = 0.12) {
    if (!soundEnabled()) return;
    try {
      const AudioCtor = root.AudioContext || root.webkitAudioContext;
      if (!AudioCtor) return;
      audioContext = audioContext || new AudioCtor();
      if (audioContext.state === 'suspended') audioContext.resume();
      frequencies.forEach((frequency, step) => {
        const start = audioContext.currentTime + step * duration;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain).connect(audioContext.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      });
    } catch (error) { /* Âm thanh chỉ là phụ, bỏ qua khi trình duyệt chặn. */ }
  }

  function symbolOf(value) {
    return value ? state.level.symbols[value - 1] : '';
  }

  function spokenSymbol(value) {
    if (!value) return 'trống';
    return state.level.symbolNames?.[value - 1] || state.level.symbols[value - 1];
  }

  function readSaved() {
    try {
      const parsed = JSON.parse(root.localStorage.getItem(SAVE_KEY) || 'null');
      return parsed && parsed.schemaVersion === 1 && parsed.games && typeof parsed.games === 'object' ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function persist() {
    if (!state.level) return;
    state.saved.schemaVersion = 1;
    state.saved.levelId = state.level.id;
    state.saved.games = state.saved.games || {};
    state.saved.games[state.level.id] = state.solved ? null : {
      givens: state.givens,
      solution: state.solution,
      values: state.values,
      notes: state.notes,
      hints: state.hints
    };
    try { root.localStorage.setItem(SAVE_KEY, JSON.stringify(state.saved)); }
    catch (error) { /* Storage bị chặn: vẫn chơi được trong phiên hiện tại. */ }
  }

  function isValidSave(entry, level) {
    const total = level.size * level.size;
    const okArray = (list) => Array.isArray(list) && list.length === total
      && list.every((value) => Number.isInteger(value) && value >= 0 && value <= level.size);
    if (!entry || !okArray(entry.givens) || !okArray(entry.solution) || !okArray(entry.values)) return false;
    if (!entry.solution.every(Boolean)) return false;
    if (entry.notes !== undefined && !isValidNotes(entry.notes, level)) return false;
    return entry.givens.every((value, index) => !value || (value === entry.solution[index] && entry.values[index] === value));
  }

  function isValidNotes(notes, level) {
    const max = (1 << level.size) - 1;
    return Array.isArray(notes) && notes.length === level.size * level.size
      && notes.every((mask) => Number.isInteger(mask) && mask >= 0 && mask <= max);
  }

  function notesEnabled() {
    return state.level?.notes === true;
  }

  function noteValues(mask) {
    const values = [];
    for (let value = 1; value <= state.level.size; value += 1) if (mask & (1 << (value - 1))) values.push(value);
    return values;
  }

  function clearPeerNotes(index, value) {
    const bit = 1 << (value - 1);
    for (const peer of state.layout.peers[index]) state.notes[peer] &= ~bit;
  }

  function setNotesMode(enabled, { rerender = true } = {}) {
    state.notesMode = Boolean(enabled) && notesEnabled();
    els.notesButton.classList.toggle('active', state.notesMode);
    els.notesButton.setAttribute('aria-pressed', state.notesMode ? 'true' : 'false');
    els.notesButton.setAttribute('aria-label', state.notesMode ? 'Tắt ghi chú bút chì' : 'Bật ghi chú bút chì');
    els.pad.classList.toggle('notes-mode', state.notesMode);
    if (rerender) render();
  }

  function toggleNotesMode() {
    if (!notesEnabled()) return;
    setNotesMode(!state.notesMode);
    announce(state.notesMode
      ? '✏️ Đang ghi chú: chạm số để viết số nhỏ vào ô, chạm lại để xóa.'
      : 'Đã tắt ghi chú, chạm số để điền thật.');
  }

  function normalizeContent(content) {
    const levels = Array.isArray(content?.levels) ? content.levels.filter((level) =>
      typeof level?.id === 'string'
      && Number.isInteger(level.size)
      && level.boxRows * level.boxCols === level.size
      && Array.isArray(level.symbols)
      && level.symbols.length === level.size
    ) : [];
    return levels.length ? { ...content, levels } : FALLBACK_CONTENT;
  }

  function startLevel(levelId, { seed, fresh = false } = {}) {
    const level = state.levels.find((item) => item.id === levelId) || state.levels[0];
    state.level = level;
    state.layout = createLayout(level.size, level.boxRows, level.boxCols);
    const savedEntry = !fresh && state.saved.games?.[level.id];

    if (savedEntry && isValidSave(savedEntry, level)) {
      state.givens = savedEntry.givens.slice();
      state.solution = savedEntry.solution.slice();
      state.values = savedEntry.values.slice();
      state.notes = Array.isArray(savedEntry.notes) ? savedEntry.notes.slice() : new Array(level.size * level.size).fill(0);
      state.hints = Number.isInteger(savedEntry.hints) ? savedEntry.hints : 0;
    } else {
      const puzzleSeed = Number.isFinite(seed) ? seed : (Date.now() ^ Math.floor(Math.random() * 0xffffffff));
      const { puzzle, solution } = generatePuzzle(level, puzzleSeed);
      state.givens = puzzle.slice();
      state.solution = solution;
      state.values = puzzle.slice();
      state.notes = new Array(level.size * level.size).fill(0);
      state.hints = 0;
    }

    state.solved = false;
    state.selected = state.values.findIndex((value) => !value);
    hideWin();
    els.notesButton.hidden = !notesEnabled();
    els.notesTip.hidden = !notesEnabled();
    setNotesMode(false, { rerender: false });
    buildLevels();
    buildBoard();
    buildPad();
    render();
    persist();
    announce(savedEntry && isValidSave(savedEntry, level)
      ? `Tiếp tục bàn ${level.label}. Cố lên nhé!`
      : `Bàn ${level.label} mới đã sẵn sàng!`);
  }

  function buildLevels() {
    els.levels.replaceChildren(...state.levels.map((level) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sudoku-level';
      button.dataset.level = level.id;
      button.textContent = level.label;
      button.title = level.description || '';
      const active = level.id === state.level.id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute('aria-label', `${level.label}: ${level.description || `bàn ${level.size}×${level.size}`}`);
      button.addEventListener('click', () => {
        if (level.id !== state.level.id) startLevel(level.id);
      });
      return button;
    }));
  }

  function buildBoard() {
    const { size, boxRows, boxCols } = state.level;
    els.board.style.setProperty('--sudoku-size', String(size));
    els.board.dataset.size = String(size);
    els.board.dataset.symbols = state.level.symbolNames ? 'emoji' : 'number';
    els.cells = [];
    const rows = [];
    for (let row = 0; row < size; row += 1) {
      const rowEl = document.createElement('div');
      rowEl.className = 'sudoku-row';
      rowEl.setAttribute('role', 'row');
      for (let col = 0; col < size; col += 1) {
        const index = row * size + col;
        const cell = document.createElement('div');
        cell.className = 'sudoku-cell';
        cell.id = `sudokuCell${index}`;
        cell.dataset.index = String(index);
        cell.setAttribute('role', 'gridcell');
        if ((col + 1) % boxCols === 0 && col < size - 1) cell.classList.add('box-right');
        if ((row + 1) % boxRows === 0 && row < size - 1) cell.classList.add('box-bottom');
        if (Math.floor(row / boxRows) % 2 === Math.floor(col / boxCols) % 2) cell.classList.add('box-tint');
        rowEl.appendChild(cell);
        els.cells.push(cell);
      }
      rows.push(rowEl);
    }
    els.board.replaceChildren(...rows);
  }

  function buildPad() {
    els.padButtons = state.level.symbols.map((symbol, position) => {
      const value = position + 1;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sudoku-key';
      button.dataset.value = String(value);
      button.innerHTML = `<span class="sudoku-key-symbol"></span><span class="sudoku-key-count"></span>`;
      button.querySelector('.sudoku-key-symbol').textContent = symbol;
      button.addEventListener('click', () => placeValue(value));
      return button;
    });
    els.pad.dataset.size = String(state.level.size);
    els.pad.replaceChildren(...els.padButtons);
  }

  function render() {
    const { size, boxRows, boxCols } = state.level;
    const conflicts = findConflicts(state.values, state.layout);
    const selected = state.selected;
    const selectedValue = selected >= 0 ? state.values[selected] : 0;
    const selRow = Math.floor(selected / size);
    const selCol = selected % size;

    els.cells.forEach((cell, index) => {
      const value = state.values[index];
      const row = Math.floor(index / size);
      const col = index % size;
      const given = Boolean(state.givens[index]);
      const peer = selected >= 0 && index !== selected && (
        row === selRow || col === selCol
        || (Math.floor(row / boxRows) === Math.floor(selRow / boxRows) && Math.floor(col / boxCols) === Math.floor(selCol / boxCols))
      );
      const notes = !value && notesEnabled() ? noteValues(state.notes[index]) : [];
      if (notes.length) {
        const grid = document.createElement('span');
        grid.className = 'sudoku-notes';
        grid.setAttribute('aria-hidden', 'true');
        for (let note = 1; note <= size; note += 1) {
          const mark = document.createElement('span');
          mark.textContent = notes.includes(note) ? symbolOf(note) : '';
          grid.appendChild(mark);
        }
        cell.replaceChildren(grid);
      } else {
        cell.textContent = symbolOf(value);
      }
      cell.classList.toggle('has-notes', notes.length > 0);
      cell.classList.toggle('given', given);
      cell.classList.toggle('filled', Boolean(value) && !given);
      cell.classList.toggle('selected', index === selected);
      cell.classList.toggle('peer', peer);
      cell.classList.toggle('same', Boolean(selectedValue) && value === selectedValue && index !== selected);
      cell.classList.toggle('conflict', conflicts.has(index));
      cell.setAttribute('aria-selected', index === selected ? 'true' : 'false');
      cell.setAttribute('aria-readonly', given ? 'true' : 'false');
      const notesLabel = notes.length ? `, ghi chú ${notes.map(spokenSymbol).join(', ')}` : '';
      cell.setAttribute('aria-label', `Hàng ${row + 1}, cột ${col + 1}: ${spokenSymbol(value)}${notesLabel}${given ? ', có sẵn' : ''}${conflicts.has(index) ? ', đang bị trùng' : ''}`);
    });

    if (selected >= 0) els.board.setAttribute('aria-activedescendant', `sudokuCell${selected}`);
    else els.board.removeAttribute('aria-activedescendant');

    const counts = new Array(size + 1).fill(0);
    state.values.forEach((value) => { counts[value] += 1; });
    els.padButtons.forEach((button, position) => {
      const value = position + 1;
      const remaining = Math.max(0, size - counts[value]);
      button.classList.toggle('done', remaining === 0);
      button.classList.toggle('current', value === selectedValue);
      button.querySelector('.sudoku-key-count').textContent = remaining ? String(remaining) : '✓';
      button.setAttribute('aria-label', state.notesMode
        ? `Ghi chú ${spokenSymbol(value)}`
        : `Điền ${spokenSymbol(value)}, còn ${remaining} chỗ`);
    });

    els.left.textContent = String(counts[0]);
    els.hints.textContent = String(state.hints);
  }

  function select(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.values.length) return;
    state.selected = index;
    render();
  }

  function ensureSelection() {
    if (state.selected >= 0) return true;
    const empty = state.values.findIndex((value) => !value);
    if (empty === -1) return false;
    state.selected = empty;
    return true;
  }

  function placeValue(value) {
    if (state.solved || !ensureSelection()) return;
    const index = state.selected;
    if (state.givens[index]) {
      announce('Ô này có sẵn rồi, bé chọn ô trống khác nhé.');
      render();
      return;
    }
    if (state.notesMode) {
      toggleNote(index, value);
      return;
    }
    state.values[index] = state.values[index] === value ? 0 : value;
    if (state.values[index]) {
      state.notes[index] = 0;
      clearPeerNotes(index, value);
    }
    const conflicts = findConflicts(state.values, state.layout);
    if (state.values[index] && conflicts.has(index)) {
      announce(`${spokenSymbol(value)} bị trùng trong hàng, cột hoặc ô vuông rồi. Bé thử hình khác nhé!`);
      playTone([330, 262]);
    } else if (state.values[index]) {
      announce('');
      playTone([523]);
    }
    afterChange();
  }

  function toggleNote(index, value) {
    if (state.values[index]) {
      announce('Ô này đã có số rồi. Xóa số trước khi ghi chú nhé.');
      return;
    }
    state.notes[index] ^= 1 << (value - 1);
    render();
    persist();
  }

  function eraseSelected() {
    if (state.solved || state.selected < 0) return;
    if (state.givens[state.selected]) {
      announce('Ô có sẵn thì không xóa được nhé.');
      return;
    }
    if (state.values[state.selected]) state.values[state.selected] = 0;
    else state.notes[state.selected] = 0;
    afterChange();
  }

  function giveHint() {
    if (state.solved) return;
    const needsHelp = (index) => !state.givens[index] && state.values[index] !== state.solution[index];
    let index = state.selected >= 0 && needsHelp(state.selected) ? state.selected : -1;
    if (index === -1) index = state.values.findIndex((_, i) => needsHelp(i));
    if (index === -1) return;
    state.values[index] = state.solution[index];
    state.notes[index] = 0;
    clearPeerNotes(index, state.solution[index]);
    state.selected = index;
    state.hints += 1;
    announce(`Gợi ý: ô này là ${spokenSymbol(state.solution[index])}.`);
    playTone([659, 784]);
    afterChange();
  }

  function checkBoard() {
    if (state.solved) return;
    const wrong = [];
    state.values.forEach((value, index) => {
      if (value && !state.givens[index] && value !== state.solution[index]) wrong.push(index);
    });
    els.cells.forEach((cell, index) => cell.classList.toggle('wrong', wrong.includes(index)));
    root.setTimeout(() => els.cells?.forEach((cell) => cell.classList.remove('wrong')), 1600);
    const empty = state.values.filter((value) => !value).length;
    if (wrong.length) announce(`Có ${wrong.length} ô chưa đúng (tô viền cam). Bé xem lại nhé!`);
    else announce(empty ? `Tất cả các ô đã điền đều đúng! Còn ${empty} ô trống.` : 'Tuyệt vời, mọi ô đều đúng!');
  }

  function restartPuzzle() {
    state.values = state.givens.slice();
    state.notes = new Array(state.values.length).fill(0);
    state.hints = 0;
    state.solved = false;
    state.selected = state.values.findIndex((value) => !value);
    hideWin();
    render();
    persist();
    announce('Đã làm lại đề này từ đầu.');
  }

  function afterChange() {
    render();
    if (isSolved(state.values, state.layout)) {
      state.solved = true;
      persist();
      showWin();
      return;
    }
    persist();
  }

  function starsFor(hints) {
    if (hints === 0) return 3;
    return hints <= 2 ? 2 : 1;
  }

  function showWin() {
    const stars = starsFor(state.hints);
    els.winStars.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    els.winText.textContent = state.hints
      ? `Bé đã giải xong bàn ${state.level.label} với ${state.hints} lần gợi ý.`
      : `Bé tự giải xong bàn ${state.level.label} mà không cần gợi ý!`;
    els.win.hidden = false;
    els.board.classList.add('solved');
    announce('Hoàn thành! Bé giỏi quá!');
    playTone([523, 659, 784, 1047], 0.14);
    root.setTimeout(() => els.winNext.focus(), 30);
  }

  function hideWin() {
    if (els.win) els.win.hidden = true;
    els.board?.classList.remove('solved');
  }

  function moveSelection(dRow, dCol) {
    const size = state.level.size;
    const current = state.selected >= 0 ? state.selected : 0;
    const row = (Math.floor(current / size) + dRow + size) % size;
    const col = (current % size + dCol + size) % size;
    select(row * size + col);
  }

  function onKeyDown(event) {
    if (!state.level || !els.win.hidden) return;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      moveSelection(...arrows[event.key]);
      return;
    }
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= state.level.size) {
      event.preventDefault();
      placeValue(digit);
      return;
    }
    if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      toggleNotesMode();
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      event.preventDefault();
      eraseSelected();
    }
  }

  function onBoardPointer(event) {
    const cell = event.target.closest('.sudoku-cell');
    if (!cell) return;
    select(Number(cell.dataset.index));
    els.board.focus({ preventScroll: true });
  }

  function init(content) {
    const normalized = normalizeContent(content);
    state.levels = normalized.levels;
    state.saved = readSaved() || { schemaVersion: 1, games: {} };
    const initialLevel = state.levels.some((level) => level.id === state.saved.levelId)
      ? state.saved.levelId
      : normalized.defaultLevelId;
    startLevel(initialLevel);

    root.BongGame12 = Object.freeze({
      getState: () => ({
        levelId: state.level.id,
        size: state.level.size,
        givens: state.givens.slice(),
        solution: state.solution.slice(),
        values: state.values.slice(),
        notes: state.notes.slice(),
        notesMode: state.notesMode,
        notesEnabled: notesEnabled(),
        selected: state.selected,
        hints: state.hints,
        solved: state.solved
      }),
      newGame: (levelId, seed) => startLevel(levelId || state.level.id, { seed, fresh: true }),
      select,
      place: placeValue,
      erase: eraseSelected,
      hint: giveHint,
      toggleNotes: toggleNotesMode
    });
  }

  function boot() {
    Object.assign(els, {
      board: document.getElementById('sudokuBoard'),
      pad: document.getElementById('sudokuPad'),
      levels: document.getElementById('sudokuLevels'),
      left: document.getElementById('sudokuLeft'),
      hints: document.getElementById('sudokuHints'),
      status: document.getElementById('sudokuStatus'),
      win: document.getElementById('sudokuWin'),
      winStars: document.getElementById('sudokuWinStars'),
      winText: document.getElementById('sudokuWinText'),
      winNext: document.getElementById('sudokuWinNext'),
      notesButton: document.getElementById('sudokuNotes'),
      notesTip: document.getElementById('sudokuNotesTip')
    });
    if (!els.board) return;

    els.board.addEventListener('click', onBoardPointer);
    els.board.addEventListener('keydown', onKeyDown);
    els.notesButton.addEventListener('click', toggleNotesMode);
    document.getElementById('sudokuErase').addEventListener('click', eraseSelected);
    document.getElementById('sudokuHint').addEventListener('click', giveHint);
    document.getElementById('sudokuCheck').addEventListener('click', checkBoard);
    document.getElementById('sudokuRestart').addEventListener('click', restartPuzzle);
    document.getElementById('sudokuNew').addEventListener('click', () => startLevel(state.level.id, { fresh: true }));
    els.winNext.addEventListener('click', () => {
      startLevel(state.level.id, { fresh: true });
      els.board.focus({ preventScroll: true });
    });
    els.win.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideWin();
        els.board.focus({ preventScroll: true });
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.target === els.board || event.target.closest?.('input, textarea, select, a, [role="dialog"]')) return;
      if (/^[1-9nN]$/.test(event.key) || event.key === 'Backspace' || event.key === 'Delete') onKeyDown(event);
    });

    fetch(CONTENT_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`${CONTENT_URL}: HTTP ${response.status}`);
        return response.json();
      })
      .catch((error) => {
        console.warn('[Bông Home] Dùng nội dung Sudoku dự phòng', error);
        return FALLBACK_CONTENT;
      })
      .then(init);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof window !== 'undefined' ? window : null);
