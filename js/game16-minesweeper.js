(function (root) {
  'use strict';

  /* ---------- Engine: thuần logic, chạy được cả trong Node để test ---------- */
  /*
   * Minesweeper cho bé: dưới các ô cỏ có tổ ong. Số trên ô đã mở = số tổ ong ở 8 ô xung quanh.
   * - Lần mở đầu luôn an toàn và mở ra cả một vùng (không có tổ ong trong 3×3 quanh ô đầu tiên).
   * - Ô số 0 tự mở lan sang các ô bên cạnh.
   * - Mở một ô số mà xung quanh đã cắm đủ cờ thì mở luôn các ô chưa cắm cờ còn lại (chording).
   * - Cấp Dễ có lượt "Gấu Bông cứu": lỡ mở trúng tổ ong thì ô đó tự cắm cờ và ván chơi tiếp.
   * Trạng thái là đối tượng thuần (mảng số), tuần tự hoá được để lưu ván dở.
   */

  const HIDDEN = 0;
  const OPEN = 1;
  const FLAG = 2;

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

  /** Cấp độ hợp lệ: bàn 5–16 ô mỗi chiều, số tổ ong để còn ít nhất 9 ô an toàn cho lần mở đầu. */
  function normalizeLevel(level) {
    const rows = Number.isInteger(level?.rows) && level.rows >= 5 && level.rows <= 16 ? level.rows : 8;
    const cols = Number.isInteger(level?.cols) && level.cols >= 5 && level.cols <= 16 ? level.cols : rows;
    const maxMines = rows * cols - 9;
    // Quá nhiều tổ ong thì giảm xuống mức tối đa (vẫn chơi được); thiếu/sai thì dùng mật độ mặc định ~13%.
    const mines = Number.isInteger(level?.mines) && level.mines >= 1 ? Math.min(level.mines, maxMines) : Math.min(maxMines, Math.round(rows * cols * 0.13));
    const rescues = Number.isInteger(level?.rescues) && level.rescues >= 0 && level.rescues <= 3 ? level.rescues : 0;
    const hints = Number.isInteger(level?.hints) && level.hints >= 0 && level.hints <= 5 ? level.hints : 0;
    return Object.freeze({ id: String(level?.id || 'de'), rows, cols, mines, rescues, hints });
  }

  function neighbors(index, rows, cols) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const list = [];
    for (let dRow = -1; dRow <= 1; dRow += 1) {
      for (let dCol = -1; dCol <= 1; dCol += 1) {
        if (!dRow && !dCol) continue;
        const r = row + dRow;
        const c = col + dCol;
        if (r >= 0 && c >= 0 && r < rows && c < cols) list.push(r * cols + c);
      }
    }
    return list;
  }

  /** Ván mới chưa đặt tổ ong: tổ ong chỉ được rải khi bé mở ô đầu tiên (để ô đó luôn an toàn). */
  function createGame(level, seed = Date.now()) {
    const normalized = normalizeLevel(level);
    const size = normalized.rows * normalized.cols;
    return {
      level: normalized,
      seed: Number(seed) >>> 0,
      mines: [],
      cells: new Array(size).fill(HIDDEN),
      counts: new Array(size).fill(0),
      status: 'ready',
      opened: 0,
      rescuesLeft: normalized.rescues,
      rescuesUsed: 0,
      hintsLeft: normalized.hints,
      hintsUsed: 0,
      exploded: -1,
      moves: 0
    };
  }

  function placeMines(game, safeIndex) {
    const { rows, cols, mines } = game.level;
    const size = rows * cols;
    const forbidden = new Set([safeIndex, ...neighbors(safeIndex, rows, cols)]);
    const candidates = [];
    for (let index = 0; index < size; index += 1) if (!forbidden.has(index)) candidates.push(index);
    const rng = createRng(game.seed);
    // Fisher–Yates một phần: lấy `mines` ô đầu của dãy đã xáo.
    for (let i = 0; i < mines; i += 1) {
      const j = i + Math.floor(rng() * (candidates.length - i));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    game.mines = candidates.slice(0, mines).sort((a, b) => a - b);
    const mineSet = new Set(game.mines);
    game.counts = Array.from({ length: size }, (_, index) => (mineSet.has(index)
      ? -1
      : neighbors(index, rows, cols).filter((other) => mineSet.has(other)).length));
    game.status = 'playing';
  }

  function isMine(game, index) {
    return game.counts[index] === -1;
  }

  /** Mở lan từ một ô (ô 0 mở tiếp các ô quanh nó). Trả về danh sách ô vừa mở. */
  function flood(game, start) {
    const { rows, cols } = game.level;
    const opened = [];
    const stack = [start];
    while (stack.length) {
      const index = stack.pop();
      if (game.cells[index] !== HIDDEN || isMine(game, index)) continue;
      game.cells[index] = OPEN;
      game.opened += 1;
      opened.push(index);
      if (game.counts[index] === 0) {
        for (const other of neighbors(index, rows, cols)) if (game.cells[other] === HIDDEN) stack.push(other);
      }
    }
    return opened;
  }

  function checkWin(game) {
    const { rows, cols, mines } = game.level;
    if (game.status === 'playing' && game.opened === rows * cols - mines) {
      game.status = 'won';
      // Thắng thì cắm cờ hết các tổ ong còn lại cho bé thấy.
      for (const mine of game.mines) game.cells[mine] = FLAG;
      return true;
    }
    return false;
  }

  /** Bé mở trúng tổ ong: dùng lượt cứu nếu còn, không thì thua. */
  function hitMine(game, index) {
    if (game.rescuesLeft > 0) {
      game.rescuesLeft -= 1;
      game.rescuesUsed += 1;
      game.cells[index] = FLAG;
      return { event: 'rescued', index };
    }
    game.status = 'lost';
    game.exploded = index;
    return { event: 'lost', index };
  }

  /**
   * Mở ô `index`. Kết quả: { event, opened } với event là
   *  'ignored' | 'opened' | 'rescued' | 'lost' | 'won'.
   * Mở ô số đã mở mà xung quanh đủ cờ thì mở các ô còn lại quanh nó (chording).
   */
  function reveal(game, index) {
    const size = game.cells.length;
    if (!Number.isInteger(index) || index < 0 || index >= size) return { event: 'ignored', opened: [] };
    if (game.status === 'won' || game.status === 'lost') return { event: 'ignored', opened: [] };
    if (game.status === 'ready') placeMines(game, index);

    const state = game.cells[index];
    if (state === FLAG) return { event: 'ignored', opened: [] };
    if (state === OPEN) return chord(game, index);

    game.moves += 1;
    if (isMine(game, index)) {
      const hit = hitMine(game, index);
      return { ...hit, opened: [] };
    }
    const opened = flood(game, index);
    if (checkWin(game)) return { event: 'won', opened };
    return { event: 'opened', opened };
  }

  function chord(game, index) {
    const { rows, cols } = game.level;
    const count = game.counts[index];
    if (count <= 0) return { event: 'ignored', opened: [] };
    const around = neighbors(index, rows, cols);
    const flags = around.filter((other) => game.cells[other] === FLAG).length;
    const hidden = around.filter((other) => game.cells[other] === HIDDEN);
    if (flags !== count || !hidden.length) return { event: 'ignored', opened: [] };
    game.moves += 1;
    const opened = [];
    let result = null;
    for (const other of hidden) {
      if (game.cells[other] !== HIDDEN) continue;
      if (isMine(game, other)) {
        // Bé cắm cờ nhầm chỗ: ô có tổ ong vẫn bị mở.
        result = hitMine(game, other);
        if (result.event === 'lost') return { ...result, opened };
        continue;
      }
      opened.push(...flood(game, other));
    }
    if (checkWin(game)) return { event: 'won', opened };
    return { event: result ? result.event : 'opened', opened, index: result?.index };
  }

  /** Cắm/gỡ cờ ở ô chưa mở. */
  function toggleFlag(game, index) {
    if (game.status === 'won' || game.status === 'lost') return false;
    if (game.cells[index] === OPEN || game.cells[index] === undefined) return false;
    game.cells[index] = game.cells[index] === FLAG ? HIDDEN : FLAG;
    return true;
  }

  function flagsPlaced(game) {
    return game.cells.filter((value) => value === FLAG).length;
  }

  /**
   * Gợi ý một ô chắc chắn an toàn để mở: ưu tiên ô sát vùng đã mở (bé hiểu được vì sao), chưa có thì ô bất kỳ.
   * Ván chưa bắt đầu thì gợi ý ô giữa bàn. Trả về -1 khi không còn gì để gợi ý.
   */
  function safeHint(game) {
    const { rows, cols } = game.level;
    if (game.status === 'ready') return Math.floor(rows / 2) * cols + Math.floor(cols / 2);
    if (game.status !== 'playing') return -1;
    const safe = (index) => game.cells[index] === HIDDEN && !isMine(game, index);
    let fallback = -1;
    for (let index = 0; index < game.cells.length; index += 1) {
      if (!safe(index)) continue;
      if (neighbors(index, rows, cols).some((other) => game.cells[other] === OPEN)) return index;
      if (fallback < 0) fallback = index;
    }
    return fallback;
  }

  function useHint(game) {
    if (game.hintsLeft <= 0) return -1;
    const index = safeHint(game);
    if (index < 0) return -1;
    game.hintsLeft -= 1;
    game.hintsUsed += 1;
    return index;
  }

  /** Sao khi thắng: 3 sao nếu không cần trợ giúp; dùng lượt cứu hoặc gợi ý thì 2 sao. */
  function starsFor(game) {
    if (game.status !== 'won') return 0;
    return game.rescuesUsed || game.hintsUsed ? 2 : 3;
  }

  function serialize(game) {
    return JSON.parse(JSON.stringify(game));
  }

  /** Khôi phục ván đã lưu; dữ liệu hỏng hoặc không khớp cấp độ thì trả null. */
  function restore(saved, level) {
    const normalized = normalizeLevel(level);
    const size = normalized.rows * normalized.cols;
    if (!saved || typeof saved !== 'object') return null;
    if (saved.level?.id !== normalized.id || saved.level?.rows !== normalized.rows || saved.level?.cols !== normalized.cols
      || saved.level?.mines !== normalized.mines) return null;
    if (!['ready', 'playing'].includes(saved.status)) return null;
    if (!Array.isArray(saved.cells) || saved.cells.length !== size || !saved.cells.every((value) => [HIDDEN, OPEN, FLAG].includes(value))) return null;
    if (!Array.isArray(saved.counts) || saved.counts.length !== size || !saved.counts.every((value) => Number.isInteger(value) && value >= -1 && value <= 8)) return null;
    const game = createGame(normalized, saved.seed);
    if (saved.status === 'playing') {
      if (!Array.isArray(saved.mines) || saved.mines.length !== normalized.mines) return null;
      // Đặt lại tổ ong từ danh sách đã lưu và tính lại số để không tin dữ liệu số đã lưu.
      const mineSet = new Set(saved.mines);
      if (mineSet.size !== normalized.mines || saved.mines.some((index) => !Number.isInteger(index) || index < 0 || index >= size)) return null;
      game.mines = [...mineSet].sort((a, b) => a - b);
      game.counts = Array.from({ length: size }, (_, index) => (mineSet.has(index)
        ? -1
        : neighbors(index, normalized.rows, normalized.cols).filter((other) => mineSet.has(other)).length));
      game.status = 'playing';
      game.cells = saved.cells.slice();
      if (game.cells.some((value, index) => value === OPEN && mineSet.has(index))) return null;
      game.opened = game.cells.filter((value) => value === OPEN).length;
    }
    const clampInt = (value, max) => (Number.isInteger(value) && value >= 0 && value <= max ? value : 0);
    game.rescuesLeft = clampInt(saved.rescuesLeft, normalized.rescues);
    game.rescuesUsed = clampInt(saved.rescuesUsed, normalized.rescues);
    game.hintsLeft = clampInt(saved.hintsLeft, normalized.hints);
    game.hintsUsed = clampInt(saved.hintsUsed, normalized.hints);
    game.moves = Number.isInteger(saved.moves) && saved.moves >= 0 ? saved.moves : 0;
    return game;
  }

  const engine = Object.freeze({
    HIDDEN,
    OPEN,
    FLAG,
    createRng,
    normalizeLevel,
    neighbors,
    createGame,
    reveal,
    toggleFlag,
    flagsPlaced,
    safeHint,
    useHint,
    starsFor,
    serialize,
    restore
  });

  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (!root || !root.document) return;
  root.BongMinesweeperEngine = engine;

  /* ---------- Giao diện ---------- */

  const document = root.document;
  const CONTENT_URL = './content/games/game16.json';
  const SAVE_KEY = 'bonghome_game16_minesweeper';
  const LONG_PRESS_MS = 420;
  const FALLBACK_CONTENT = {
    schemaVersion: 1,
    defaultLevelId: 'de',
    levels: [
      { id: 'de', label: '🌱 Dễ', description: 'Bàn 8×8, 8 tổ ong, Gấu Bông cứu 1 lần', rows: 8, cols: 8, mines: 8, rescues: 1, hints: 3 },
      { id: 'vua', label: '🌿 Vừa', description: 'Bàn 10×10, 15 tổ ong', rows: 10, cols: 10, mines: 15, rescues: 0, hints: 2 },
      { id: 'kho', label: '🌳 Khó', description: 'Bàn 12×12, 26 tổ ong', rows: 12, cols: 12, mines: 26, rescues: 0, hints: 1 }
    ]
  };
  const NUMBER_COLORS = ['', '#2f6fb3', '#2e7d4f', '#c23a5c', '#6a3fa0', '#9a5a12', '#127a7a', '#3d3d3d', '#7a7a7a'];

  const state = {
    levels: [],
    level: null,
    game: null,
    flagMode: false,
    focus: 0,
    startedAt: 0,
    elapsed: 0,
    timer: 0,
    tracked: false,
    best: {},
    hint: -1
  };
  const els = {};
  let audioContext = null;
  let pressTimer = 0;
  let longPressed = false;

  function announce(message) {
    if (els.status) els.status.textContent = message;
  }

  function soundEnabled() {
    try { return root.BongSound?.isEnabled?.() !== false; }
    catch (error) { return true; }
  }

  function playTone(frequencies, duration = 0.1) {
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
        gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain).connect(audioContext.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      });
    } catch (error) { /* Âm thanh chỉ là phụ. */ }
  }

  function withRewards(action) {
    const ready = root.BongGame16RewardsReady;
    if (!ready || typeof ready.then !== 'function') return Promise.resolve(null);
    return ready
      .then((api) => (api ? action(api) : null))
      .catch((error) => {
        console.warn('[Bông Home] Không ghi được tiến độ/phần thưởng Game 16', error);
        return null;
      });
  }

  function readSaved() {
    try {
      const parsed = JSON.parse(root.localStorage.getItem(SAVE_KEY) || 'null');
      return parsed && typeof parsed === 'object' && parsed.schemaVersion === 1 ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function persist() {
    const game = state.game;
    const active = game && (game.status === 'playing' || game.status === 'ready');
    const saved = {
      schemaVersion: 1,
      levelId: state.level.id,
      best: state.best,
      run: active && game.status === 'playing' ? {
        game: serialize(game),
        elapsed: currentElapsed(),
        tracked: state.tracked
      } : null
    };
    try { root.localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); }
    catch (error) { /* Storage bị chặn: vẫn chơi được trong phiên. */ }
  }

  function validBest(best) {
    const result = {};
    if (!best || typeof best !== 'object') return result;
    for (const level of state.levels) {
      const value = best[level.id];
      if (Number.isInteger(value) && value > 0 && value < 360000) result[level.id] = value;
    }
    return result;
  }

  /* --- Đồng hồ (chỉ để bé xem, không đếm ngược) --- */

  function currentElapsed() {
    return state.elapsed + (state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0);
  }

  function formatTime(seconds) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function startClock() {
    if (state.startedAt) return;
    state.startedAt = Date.now();
    state.timer = root.setInterval(() => { els.time.textContent = formatTime(currentElapsed()); }, 1000);
  }

  function stopClock() {
    state.elapsed = currentElapsed();
    state.startedAt = 0;
    if (state.timer) root.clearInterval(state.timer);
    state.timer = 0;
  }

  /* --- Ván chơi --- */

  function newGame({ levelId, seed, saved = null } = {}) {
    stopClock();
    hideWin();
    const previous = state.level;
    const level = state.levels.find((item) => item.id === levelId) || state.level || state.levels[0];
    if (state.tracked && state.game?.status === 'playing') withRewards((api) => api.abandon());
    state.level = level;
    const restored = saved ? restore(saved.game, level) : null;
    state.game = restored || createGame(level, seed ?? (Date.now() ^ Math.floor(Math.random() * 1e9)));
    state.elapsed = restored && Number.isInteger(saved.elapsed) && saved.elapsed >= 0 ? saved.elapsed : 0;
    state.tracked = Boolean(restored && saved.tracked);
    state.hint = -1;
    state.flagMode = false;
    state.focus = Math.floor(level.rows / 2) * level.cols + Math.floor(level.cols / 2);
    if (!previous || previous.id !== level.id || !els.cells || els.cells.length !== level.rows * level.cols) buildBoard();
    buildLevels();
    render();
    persist();
    if (restored) {
      startClock();
      announce(`Tiếp tục ván đang chơi ở cấp ${level.label}.`);
    } else {
      announce(`Cấp ${level.label}: có ${level.mines} tổ ong trốn dưới cỏ. Chạm một ô bất kỳ để bắt đầu — ô đầu tiên luôn an toàn!`);
    }
  }

  function buildLevels() {
    els.levels.replaceChildren(...state.levels.map((level) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mine-level';
      button.dataset.level = level.id;
      const best = state.best[level.id];
      button.textContent = level.label;
      button.title = level.description || '';
      const active = level.id === state.level.id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute('aria-label', `${level.label}: ${level.description || ''}${best ? `. Kỷ lục ${formatTime(best)}` : ''}`);
      button.addEventListener('click', () => {
        if (level.id !== state.level.id) newGame({ levelId: level.id });
      });
      return button;
    }));
  }

  function buildBoard() {
    const { rows, cols, mines } = state.level;
    els.board.style.setProperty('--mine-cols', String(cols));
    els.board.style.setProperty('--mine-rows', String(rows));
    els.board.setAttribute('aria-label', `Vườn ${rows}×${cols} có ${mines} tổ ong. Phím mũi tên để chọn ô, Enter để mở, phím F để cắm cờ.`);
    els.cells = Array.from({ length: rows * cols }, (_, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'mine-cell';
      cell.id = `mineCell${index}`;
      cell.dataset.index = String(index);
      cell.addEventListener('click', (event) => onCellClick(event, index));
      cell.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        flag(index);
      });
      cell.addEventListener('pointerdown', (event) => startLongPress(event, index));
      cell.addEventListener('pointerup', cancelLongPress);
      cell.addEventListener('pointerleave', cancelLongPress);
      cell.addEventListener('pointercancel', cancelLongPress);
      cell.addEventListener('focus', () => { state.focus = index; syncTabStops(); });
      return cell;
    });
    els.board.replaceChildren(...els.cells);
  }

  function syncTabStops() {
    els.cells.forEach((cell, index) => { cell.tabIndex = index === state.focus ? 0 : -1; });
  }

  function cellLabel(index) {
    const { cols } = state.level;
    const game = state.game;
    const where = `Hàng ${Math.floor(index / cols) + 1}, cột ${(index % cols) + 1}`;
    const value = game.cells[index];
    if (value === FLAG) return `${where}: đã cắm cờ`;
    if (value === OPEN) {
      const count = game.counts[index];
      return `${where}: ${count ? `${count} tổ ong xung quanh` : 'trống'}`;
    }
    if (game.status === 'lost' && game.counts[index] === -1) return `${where}: tổ ong`;
    return `${where}: chưa mở`;
  }

  function render() {
    const game = state.game;
    const finished = game.status === 'won' || game.status === 'lost';
    els.board.classList.toggle('finished', finished);
    els.board.classList.toggle('flag-mode', state.flagMode);
    els.cells.forEach((cell, index) => {
      const value = game.cells[index];
      const count = game.counts[index];
      const mine = count === -1;
      let text = '';
      if (value === FLAG) text = '🚩';
      else if (value === OPEN && count > 0) text = String(count);
      else if (value === HIDDEN && game.status === 'lost' && mine) text = '🐝';
      cell.textContent = text;
      cell.classList.toggle('open', value === OPEN);
      cell.classList.toggle('flagged', value === FLAG);
      cell.classList.toggle('bee', value === HIDDEN && game.status === 'lost' && mine);
      cell.classList.toggle('exploded', index === game.exploded);
      cell.classList.toggle('wrong-flag', game.status === 'lost' && value === FLAG && !mine);
      cell.classList.toggle('hint', index === state.hint && value === HIDDEN);
      cell.style.color = value === OPEN && count > 0 ? NUMBER_COLORS[count] : '';
      cell.setAttribute('aria-disabled', finished || value === OPEN && !(count > 0) ? 'true' : 'false');
      cell.setAttribute('aria-label', cellLabel(index));
    });
    syncTabStops();
    els.left.textContent = String(state.level.mines - flagsPlaced(game));
    els.time.textContent = formatTime(currentElapsed());
    els.best.textContent = state.best[state.level.id] ? formatTime(state.best[state.level.id]) : '--';
    els.rescue.hidden = state.level.rescues === 0;
    els.rescueCount.textContent = String(game.rescuesLeft);
    els.hint.disabled = finished || game.hintsLeft <= 0;
    els.hint.textContent = `💡 Gợi ý (${game.hintsLeft})`;
    els.mode.setAttribute('aria-pressed', state.flagMode ? 'true' : 'false');
    els.mode.textContent = state.flagMode ? '🚩 Đang cắm cờ' : '⛏️ Đang mở ô';
    // Tên nút bắt đầu bằng đúng chữ hiển thị (trình đọc màn hình và điều khiển bằng giọng nói nhận ra được).
    els.mode.setAttribute('aria-label', state.flagMode
      ? 'Đang cắm cờ: chạm ô để cắm hoặc gỡ cờ, bấm nút này để quay về mở ô'
      : 'Đang mở ô: bấm nút này để chuyển sang cắm cờ');
  }

  function onCellClick(event, index) {
    if (longPressed) {
      // Nhấn giữ đã cắm cờ rồi: bỏ qua cú chạm đi kèm.
      longPressed = false;
      return;
    }
    if (state.flagMode) flag(index);
    else open(index);
  }

  function startLongPress(event, index) {
    if (event.pointerType === 'mouse') return;
    cancelLongPress();
    longPressed = false;
    pressTimer = root.setTimeout(() => {
      pressTimer = 0;
      longPressed = true;
      flag(index);
      root.navigator?.vibrate?.(25);
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (pressTimer) root.clearTimeout(pressTimer);
    pressTimer = 0;
  }

  function trackStart() {
    if (state.tracked) return;
    state.tracked = true;
    withRewards((api) => api.trackProgress({ levelId: state.level.id }));
  }

  function open(index) {
    const game = state.game;
    if (game.status === 'won' || game.status === 'lost') return null;
    const result = reveal(game, index);
    if (result.event === 'ignored') {
      if (game.cells[index] === FLAG) announce('Ô này đang cắm cờ. Gỡ cờ trước rồi mới mở được nhé.');
      return result;
    }
    state.hint = -1;
    startClock();
    trackStart();
    if (result.event === 'rescued') {
      playTone([523, 392, 523], 0.12);
      announce(`Ối, có tổ ong! Gấu Bông đã cứu bé và cắm cờ vào ô đó. Còn ${game.rescuesLeft} lần cứu.`);
    } else if (result.event === 'lost') {
      playTone([392, 330, 262], 0.14);
    } else if (result.event === 'won') {
      playTone([523, 659, 784, 1047], 0.13);
    } else {
      playTone(result.opened.length > 1 ? [660, 880] : [660], 0.07);
      if (result.opened.length > 1) announce(`Mở ra ${result.opened.length} ô.`);
    }
    render();
    if (result.event === 'won' || result.event === 'lost') finish(result.event);
    else persist();
    return result;
  }

  function flag(index) {
    const game = state.game;
    if (game.status === 'ready') {
      announce('Bé mở một ô trước đã, rồi mới cắm cờ nhé.');
      return false;
    }
    if (!toggleFlag(game, index)) return false;
    playTone([game.cells[index] === FLAG ? 740 : 520], 0.06);
    render();
    persist();
    announce(cellLabel(index));
    return true;
  }

  function showHint() {
    const index = useHint(state.game);
    if (index < 0) return -1;
    state.hint = index;
    render();
    persist();
    focusCell(index);
    const { cols } = state.level;
    announce(`Gợi ý: ô hàng ${Math.floor(index / cols) + 1}, cột ${(index % cols) + 1} chắc chắn không có tổ ong.`);
    return index;
  }

  function finish(outcome) {
    stopClock();
    const game = state.game;
    const seconds = state.elapsed;
    els.time.textContent = formatTime(seconds);
    if (outcome === 'won') {
      const stars = starsFor(game);
      const best = state.best[state.level.id];
      const record = !best || seconds < best;
      if (record) state.best[state.level.id] = seconds;
      persist();
      buildLevels();
      render();
      els.winStars.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
      els.winTitle.textContent = 'Bé tìm ra hết tổ ong rồi!';
      els.winText.textContent = `Cấp ${state.level.label}: mở hết vườn trong ${formatTime(seconds)}${record ? ' — kỷ lục mới!' : '.'}${game.rescuesUsed ? ' Gấu Bông đã giúp một chút.' : ''}`;
      els.win.hidden = false;
      announce(`${els.winTitle.textContent} ${els.winText.textContent}`);
      root.setTimeout(() => els.winNext.focus(), 30);
      awardCompletion(stars, seconds);
    } else {
      persist();
      els.winStars.textContent = '🐝';
      els.winTitle.textContent = 'Ối, bé mở trúng tổ ong!';
      els.winText.textContent = 'Không sao đâu! Nhìn kỹ các con số: số 1 nghĩa là quanh ô đó có đúng một tổ ong. Mình chơi lại nhé.';
      if (els.winRewards) {
        els.winRewards.replaceChildren();
        els.winRewards.hidden = true;
      }
      els.win.hidden = false;
      announce(`${els.winTitle.textContent} ${els.winText.textContent}`);
      root.setTimeout(() => els.winNext.focus(), 30);
      if (state.tracked) withRewards((api) => api.abandon());
      state.tracked = false;
    }
  }

  function awardCompletion(stars, seconds) {
    if (els.winRewards) {
      els.winRewards.replaceChildren();
      els.winRewards.hidden = true;
    }
    const game = state.game;
    const runId = `${game.seed.toString(36)}-${state.level.id}`;
    const levelId = state.level.id;
    state.tracked = false;
    return withRewards((api) => {
      const detail = api.complete({ levelId, runId, stars, durationSeconds: seconds, moves: game.moves });
      if (!detail || detail.duplicate || state.game !== game) return detail;
      els.winRewards.replaceChildren(...api.rewardLines(detail).map((text, index) => {
        const line = document.createElement('p');
        line.className = index === 0 ? 'mine-reward-stars' : 'mine-reward-unlock';
        line.textContent = text;
        return line;
      }));
      els.winRewards.hidden = false;
      return detail;
    });
  }

  function hideWin() {
    if (els.win) els.win.hidden = true;
  }

  function focusCell(index) {
    state.focus = index;
    syncTabStops();
    els.cells[index].focus({ preventScroll: false });
  }

  function onBoardKeyDown(event) {
    if (!els.win.hidden) return;
    const { rows, cols } = state.level;
    const row = Math.floor(state.focus / cols);
    const col = state.focus % cols;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      const [dRow, dCol] = arrows[event.key];
      focusCell(((row + dRow + rows) % rows) * cols + ((col + dCol + cols) % cols));
      return;
    }
    if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      flag(state.focus);
    }
  }

  function normalizeContent(content) {
    const levels = Array.isArray(content?.levels) ? content.levels
      .filter((level) => typeof level?.id === 'string' && typeof level.label === 'string')
      .map((level) => Object.freeze({ ...normalizeLevel(level), label: level.label, description: level.description || '' })) : [];
    return levels.length ? { ...content, levels } : normalizeContent(FALLBACK_CONTENT);
  }

  function init(content) {
    const normalized = normalizeContent(content);
    state.levels = normalized.levels;
    const saved = readSaved();
    state.best = validBest(saved?.best);
    const levelId = state.levels.some((level) => level.id === saved?.levelId) ? saved.levelId : normalized.defaultLevelId;
    state.level = null;
    newGame({ levelId, saved: saved?.run && saved.run.game?.level?.id === levelId ? saved.run : null });

    root.BongGame16 = Object.freeze({
      getState: () => ({
        levelId: state.level.id,
        status: state.game.status,
        rows: state.level.rows,
        cols: state.level.cols,
        mines: state.game.mines.slice(),
        cells: state.game.cells.slice(),
        counts: state.game.counts.slice(),
        flagMode: state.flagMode,
        rescuesLeft: state.game.rescuesLeft,
        hintsLeft: state.game.hintsLeft,
        hint: state.hint,
        best: { ...state.best }
      }),
      newGame: (options = {}) => newGame(options),
      open,
      flag,
      hint: showHint
    });
  }

  function boot() {
    Object.assign(els, {
      board: document.getElementById('mineBoard'),
      levels: document.getElementById('mineLevels'),
      left: document.getElementById('mineLeft'),
      time: document.getElementById('mineTime'),
      best: document.getElementById('mineBest'),
      rescue: document.getElementById('mineRescue'),
      rescueCount: document.getElementById('mineRescueCount'),
      mode: document.getElementById('mineMode'),
      hint: document.getElementById('mineHint'),
      status: document.getElementById('mineStatus'),
      win: document.getElementById('mineWin'),
      winStars: document.getElementById('mineWinStars'),
      winTitle: document.getElementById('mineWinTitle'),
      winText: document.getElementById('mineWinText'),
      winRewards: document.getElementById('mineWinRewards'),
      winNext: document.getElementById('mineWinNext')
    });
    if (!els.board) return;

    els.board.addEventListener('keydown', onBoardKeyDown);
    els.mode.addEventListener('click', () => {
      state.flagMode = !state.flagMode;
      render();
      announce(state.flagMode ? 'Chế độ cắm cờ: chạm ô nghi có tổ ong để cắm cờ.' : 'Chế độ mở ô.');
    });
    els.hint.addEventListener('click', showHint);
    document.getElementById('mineNew').addEventListener('click', () => newGame({}));
    els.winNext.addEventListener('click', () => {
      newGame({});
      focusCell(state.focus);
    });
    els.win.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideWin();
    });
    document.addEventListener('visibilitychange', () => {
      if (!state.game || state.game.status !== 'playing') return;
      if (document.hidden) {
        stopClock();
        persist();
      } else {
        startClock();
      }
    });
    root.addEventListener('pagehide', () => {
      if (state.game?.status === 'playing') {
        stopClock();
        persist();
      }
    });

    fetch(CONTENT_URL, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .catch((error) => {
        console.warn('[Bông Home] Dùng nội dung dự phòng cho Game 16', error);
        return FALLBACK_CONTENT;
      })
      .then(init);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof window !== 'undefined' ? window : null);
