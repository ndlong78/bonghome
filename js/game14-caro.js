(function (root) {
  'use strict';

  /* ---------- Engine: thuần logic, chạy được cả trong Node để test ---------- */

  const EMPTY = 0;
  const PLAYER = 1;
  const BOT = 2;
  const DIRECTIONS = Object.freeze([[0, 1], [1, 0], [1, 1], [1, -1]].map((dir) => Object.freeze(dir)));
  const MIN_SIZE = 5;
  const MAX_SIZE = 15;
  const WIN_SCORE = 1e7;

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

  function other(mark) {
    return mark === PLAYER ? BOT : PLAYER;
  }

  /** Luật bàn cờ: `size`×`size`, xếp đủ `winLength` hình liên tiếp là thắng. */
  function normalizeRules(rules) {
    const size = Number.isInteger(rules?.size) && rules.size >= MIN_SIZE && rules.size <= MAX_SIZE ? rules.size : 10;
    const winLength = Number.isInteger(rules?.winLength) && rules.winLength >= 3 && rules.winLength <= size
      ? rules.winLength
      : Math.min(5, size);
    return Object.freeze({ size, winLength });
  }

  function createBoard(rules) {
    const { size } = normalizeRules(rules);
    return new Array(size * size).fill(EMPTY);
  }

  function isValidBoard(board, rules) {
    const { size } = normalizeRules(rules);
    return Array.isArray(board) && board.length === size * size
      && board.every((value) => value === EMPTY || value === PLAYER || value === BOT);
  }

  function inside(row, col, size) {
    return row >= 0 && col >= 0 && row < size && col < size;
  }

  /** Các ô liên tiếp cùng hình đi qua `index` theo một hướng (cả hai phía), theo thứ tự trên bàn. */
  function runThrough(board, size, index, [dRow, dCol]) {
    const mark = board[index];
    const row = Math.floor(index / size);
    const col = index % size;
    const cells = [index];
    for (const sign of [-1, 1]) {
      let r = row + dRow * sign;
      let c = col + dCol * sign;
      while (inside(r, c, size) && board[r * size + c] === mark) {
        if (sign < 0) cells.unshift(r * size + c);
        else cells.push(r * size + c);
        r += dRow * sign;
        c += dCol * sign;
      }
    }
    return cells;
  }

  /** Đường thắng đi qua ô `index` (đủ `winLength` hình trở lên), hoặc null. */
  function lineThrough(board, rules, index) {
    const { size, winLength } = normalizeRules(rules);
    if (!board[index]) return null;
    for (const dir of DIRECTIONS) {
      const cells = runThrough(board, size, index, dir);
      if (cells.length >= winLength) return cells;
    }
    return null;
  }

  /** null khi ván còn tiếp; { winner: 0 } khi hòa (kín bàn); { winner, line } khi có người thắng. */
  function getResult(board, rules) {
    const normalized = normalizeRules(rules);
    for (let index = 0; index < board.length; index += 1) {
      if (!board[index]) continue;
      const line = lineThrough(board, normalized, index);
      if (line) return { winner: board[index], line };
    }
    return board.every(Boolean) ? { winner: EMPTY, line: [] } : null;
  }

  function availableMoves(board) {
    const moves = [];
    board.forEach((value, index) => { if (value === EMPTY) moves.push(index); });
    return moves;
  }

  /**
   * Ô trống nằm gần quân đã đặt (trong bán kính `radius`). Bàn trống thì chỉ có ô giữa,
   * nhờ vậy máy không đi lạc ra mép bàn và số ô cần chấm điểm luôn nhỏ.
   */
  function candidateMoves(board, rules, radius = 2) {
    const { size } = normalizeRules(rules);
    const near = new Set();
    let stones = 0;
    board.forEach((value, index) => {
      if (!value) return;
      stones += 1;
      const row = Math.floor(index / size);
      const col = index % size;
      for (let dRow = -radius; dRow <= radius; dRow += 1) {
        for (let dCol = -radius; dCol <= radius; dCol += 1) {
          const r = row + dRow;
          const c = col + dCol;
          if (inside(r, c, size) && board[r * size + c] === EMPTY) near.add(r * size + c);
        }
      }
    });
    if (!stones) {
      const center = Math.floor(size / 2) * size + Math.floor((size - 1) / 2);
      return board[center] === EMPTY ? [center] : availableMoves(board);
    }
    return [...near].sort((a, b) => a - b);
  }

  /** Điểm cho một "cửa sổ" dài `winLength` chỉ chứa hình của một bên, theo số hình sau khi đặt. */
  function windowValue(count, winLength) {
    if (count >= winLength) return WIN_SCORE;
    if (count === winLength - 1) return 5000;
    if (count === winLength - 2) return 200;
    if (count === winLength - 3) return 15;
    return 1;
  }

  /**
   * Giá trị của việc `mark` đặt vào ô `index` (ô phải trống): cộng điểm mọi cửa sổ dài `winLength`
   * đi qua ô mà đối thủ chưa chặn. Hàng mở hai đầu nằm trong nhiều cửa sổ hơn nên tự được điểm cao hơn.
   */
  function linePotential(board, rules, index, mark) {
    const { size, winLength } = normalizeRules(rules);
    const row = Math.floor(index / size);
    const col = index % size;
    const enemy = other(mark);
    let score = 0;
    for (const [dRow, dCol] of DIRECTIONS) {
      for (let offset = -(winLength - 1); offset <= 0; offset += 1) {
        const startRow = row + dRow * offset;
        const startCol = col + dCol * offset;
        const endRow = startRow + dRow * (winLength - 1);
        const endCol = startCol + dCol * (winLength - 1);
        if (!inside(startRow, startCol, size) || !inside(endRow, endCol, size)) continue;
        let own = 1;
        let blocked = false;
        for (let step = 0; step < winLength; step += 1) {
          const cell = (startRow + dRow * step) * size + startCol + dCol * step;
          if (cell === index) continue;
          if (board[cell] === enemy) { blocked = true; break; }
          if (board[cell] === mark) own += 1;
        }
        if (!blocked) score += windowValue(own, winLength);
      }
    }
    return score;
  }

  /** Ô giúp `mark` thắng ngay ở nước kế tiếp. */
  function winningMoves(board, rules, mark) {
    const normalized = normalizeRules(rules);
    return candidateMoves(board, normalized, 1).filter((move) => {
      board[move] = mark;
      const win = Boolean(lineThrough(board, normalized, move));
      board[move] = EMPTY;
      return win;
    });
  }

  /** Chấm điểm mọi ô ứng viên: tấn công (của mình) + phòng thủ (chặn đối thủ) × `defense`. */
  function scoreMoves(board, rules, mark, { defense = 0.9 } = {}) {
    const normalized = normalizeRules(rules);
    const enemy = other(mark);
    const center = (normalized.size - 1) / 2;
    return candidateMoves(board, normalized).map((index) => {
      const row = Math.floor(index / normalized.size);
      const col = index % normalized.size;
      // Gần giữa bàn hơn thì nhỉnh hơn một chút để máy không chọn ô lệch khi hai ô bằng điểm.
      const centrality = (normalized.size - Math.abs(row - center) - Math.abs(col - center)) * 0.01;
      const score = linePotential(board, normalized, index, mark)
        + defense * linePotential(board, normalized, index, enemy)
        + centrality;
      return { index, score };
    });
  }

  /** Mọi nước điểm cao nhất cho `mark` (bằng điểm thì trả hết để chọn ngẫu nhiên). */
  function bestMoves(board, rules, mark, options = {}) {
    const normalized = normalizeRules(rules);
    if (!isValidBoard(board, normalized) || getResult(board, normalized)) return [];
    const work = board.slice();
    const wins = winningMoves(work, normalized, mark);
    if (wins.length) return wins;
    const threats = winningMoves(work, normalized, other(mark));
    if (threats.length) return threats;
    const scored = scoreMoves(work, normalized, mark, options);
    const top = Math.max(...scored.map((item) => item.score));
    return scored.filter((item) => item.score >= top - 1e-9).map((item) => item.index);
  }

  function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
  }

  /**
   * Chọn nước cho máy theo cấu hình cấp độ:
   *  - `blocks`: luôn chặn khi đối thủ sắp xếp đủ hàng (thắng được thì luôn ăn ngay ở mọi cấp);
   *  - `mistakeRate`: xác suất đi một ô ngẫu nhiên sát quân đã có thay vì nước tốt nhất;
   *  - `defense`: trọng số phòng thủ khi chấm điểm (thấp = ham tấn công, hay bỏ sót đường của bé).
   */
  function chooseMove(board, rules, mark, { mistakeRate = 0, blocks = false, defense = 0.9 } = {}, rng = Math.random) {
    const normalized = normalizeRules(rules);
    if (!isValidBoard(board, normalized) || getResult(board, normalized)) return -1;
    const moves = availableMoves(board);
    if (!moves.length) return -1;
    const work = board.slice();
    const wins = winningMoves(work, normalized, mark);
    if (wins.length) return pick(wins, rng);
    if (blocks) {
      const threats = winningMoves(work, normalized, other(mark));
      if (threats.length) return pick(threats, rng);
    }
    if (rng() < mistakeRate) {
      const near = candidateMoves(work, normalized, 1);
      return pick(near.length ? near : moves, rng);
    }
    const scored = scoreMoves(work, normalized, mark, { defense });
    const top = Math.max(...scored.map((item) => item.score));
    return pick(scored.filter((item) => item.score >= top - 1e-9).map((item) => item.index), rng);
  }

  const engine = Object.freeze({
    EMPTY,
    PLAYER,
    BOT,
    DIRECTIONS,
    createRng,
    other,
    normalizeRules,
    createBoard,
    isValidBoard,
    lineThrough,
    getResult,
    availableMoves,
    candidateMoves,
    linePotential,
    winningMoves,
    scoreMoves,
    bestMoves,
    chooseMove
  });

  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (!root || !root.document) return;
  root.BongCaroEngine = engine;

  /* ---------- Giao diện ---------- */

  const document = root.document;
  const CONTENT_URL = './content/games/game14.json';
  const SAVE_KEY = 'bonghome_game14_caro';
  const BOT_DELAY_MS = 450;
  const MODES = Object.freeze(['bot', 'friend']);
  const FALLBACK_CONTENT = {
    schemaVersion: 1,
    defaultLevelId: 'de',
    defaultMode: 'bot',
    board: { size: 10, winLength: 5 },
    marks: {
      player: { symbol: '❌', name: 'Dấu X của bé' },
      bot: { symbol: '⭕', name: 'Gấu Bông' }
    },
    levels: [
      { id: 'de', label: '🌱 Dễ', description: 'Gấu Bông còn hay quên chặn', mistakeRate: 0.5, blocks: false, defense: 0.3, drawStars: 2 },
      { id: 'vua', label: '🌿 Vừa', description: 'Gấu Bông biết chặn khi bé sắp thắng', mistakeRate: 0.12, blocks: true, defense: 0.75, drawStars: 2 },
      { id: 'kho', label: '🌳 Khó', description: 'Gấu Bông vừa tấn công vừa phòng thủ', mistakeRate: 0, blocks: true, defense: 0.95, drawStars: 3 }
    ]
  };

  const state = {
    levels: [],
    marks: FALLBACK_CONTENT.marks,
    rules: normalizeRules(FALLBACK_CONTENT.board),
    level: null,
    mode: 'bot',
    board: [],
    turn: PLAYER,
    starter: PLAYER,
    nextStarter: PLAYER,
    matchId: '',
    moves: 0,
    lastMove: -1,
    hint: -1,
    startedAt: 0,
    result: null,
    score: { player: 0, draw: 0, bot: 0 },
    focus: 0,
    rng: createRng(Date.now()),
    botTimer: 0
  };
  const els = {};
  let audioContext = null;

  function centerIndex() {
    const { size } = state.rules;
    return Math.floor(size / 2) * size + Math.floor((size - 1) / 2);
  }

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

  function vsBot() {
    return state.mode === 'bot';
  }

  function markOf(value) {
    if (value === PLAYER) return state.marks.player;
    if (value === BOT) return state.marks.bot;
    return null;
  }

  /** Tên người đi theo chế độ: chơi với máy là "Bé"/"Gấu Bông", chơi 2 người là "Bạn ❌"/"Bạn ⭕". */
  function sideName(value) {
    if (vsBot()) return value === PLAYER ? 'Bé' : state.marks.bot.name;
    return `Bạn ${markOf(value).symbol}`;
  }

  function newMatchId() {
    return `${Date.now().toString(36)}-${Math.floor(state.rng() * 1e9).toString(36)}`;
  }

  function readSaved() {
    try {
      const parsed = JSON.parse(root.localStorage.getItem(SAVE_KEY) || 'null');
      return parsed && typeof parsed === 'object' && parsed.schemaVersion === 1 ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function isValidMatch(match) {
    if (!match || !isValidBoard(match.board, state.rules) || getResult(match.board, state.rules)) return false;
    if (![PLAYER, BOT].includes(match.turn) || ![PLAYER, BOT].includes(match.starter)) return false;
    if (typeof match.matchId !== 'string' || !match.matchId) return false;
    const first = match.board.filter((value) => value === match.starter).length;
    const second = match.board.filter((value) => value === other(match.starter)).length;
    // Người đi trước luôn có số quân bằng hoặc hơn đúng 1, và lượt phải khớp với số quân.
    if (first - second !== 0 && first - second !== 1) return false;
    return match.turn === (first === second ? match.starter : other(match.starter));
  }

  function validScore(score) {
    const ok = (value) => Number.isInteger(value) && value >= 0;
    return score && ok(score.player) && ok(score.draw) && ok(score.bot)
      ? { player: score.player, draw: score.draw, bot: score.bot }
      : { player: 0, draw: 0, bot: 0 };
  }

  function persist() {
    const saved = {
      schemaVersion: 1,
      levelId: state.level.id,
      mode: state.mode,
      nextStarter: state.nextStarter,
      score: state.score,
      match: state.result ? null : {
        board: state.board,
        turn: state.turn,
        starter: state.starter,
        matchId: state.matchId,
        moves: state.moves,
        lastMove: state.lastMove,
        startedAt: state.startedAt
      }
    };
    try { root.localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); }
    catch (error) { /* Storage bị chặn: vẫn chơi được trong phiên hiện tại. */ }
  }

  function withRewards(action) {
    const ready = root.BongGame14RewardsReady;
    if (!ready || typeof ready.then !== 'function') return Promise.resolve(null);
    return ready
      .then((api) => (api ? action(api) : null))
      .catch((error) => {
        console.warn('[Bông Home] Không ghi được tiến độ/phần thưởng Game 14', error);
        return null;
      });
  }

  function normalizeContent(content) {
    const levels = Array.isArray(content?.levels) ? content.levels.filter((level) =>
      typeof level?.id === 'string'
      && typeof level.label === 'string'
      && Number.isFinite(level.mistakeRate)
      && level.mistakeRate >= 0
      && level.mistakeRate <= 1
    ) : [];
    const marks = content?.marks?.player?.symbol && content?.marks?.bot?.symbol ? content.marks : FALLBACK_CONTENT.marks;
    const board = normalizeRules(content?.board || FALLBACK_CONTENT.board);
    return levels.length ? { ...content, marks, board, levels } : { ...FALLBACK_CONTENT, board: normalizeRules(FALLBACK_CONTENT.board) };
  }

  function clearBotTimer() {
    if (state.botTimer) root.clearTimeout(state.botTimer);
    state.botTimer = 0;
  }

  function startMatch({ levelId, mode, starter, seed, fresh = false, saved = null } = {}) {
    clearBotTimer();
    hideWin();
    const nextLevel = state.levels.find((item) => item.id === levelId) || state.level || state.levels[0];
    const nextMode = MODES.includes(mode) ? mode : state.mode;
    const changed = Boolean(state.level) && (nextLevel.id !== state.level.id || nextMode !== state.mode);
    if (changed || fresh) abandonTracking();
    // Đổi cấp độ/chế độ thì tính tỉ số lại từ đầu.
    if (changed) state.score = { player: 0, draw: 0, bot: 0 };
    state.level = nextLevel;
    state.mode = nextMode;
    if (seed !== undefined) state.rng = createRng(seed);

    const restore = !fresh && saved && isValidMatch(saved.match) ? saved.match : null;
    if (restore) {
      state.board = restore.board.slice();
      state.turn = restore.turn;
      state.starter = restore.starter;
      state.matchId = restore.matchId;
      state.moves = Number.isInteger(restore.moves) ? restore.moves : state.board.filter(Boolean).length;
      state.lastMove = Number.isInteger(restore.lastMove) && state.board[restore.lastMove] ? restore.lastMove : -1;
      state.startedAt = Number.isFinite(restore.startedAt) ? restore.startedAt : Date.now();
    } else {
      state.board = createBoard(state.rules);
      state.starter = [PLAYER, BOT].includes(starter) ? starter : state.nextStarter;
      state.nextStarter = other(state.starter);
      state.turn = state.starter;
      state.matchId = newMatchId();
      state.moves = 0;
      state.lastMove = -1;
      state.startedAt = Date.now();
    }
    state.result = null;
    state.hint = -1;
    state.focus = state.lastMove >= 0 ? state.lastMove : centerIndex();

    buildModes();
    buildLevels();
    render();
    persist();
    announceTurn(restore ? 'Tiếp tục ván đang chơi. ' : '');
    scheduleBot();
  }

  function announceTurn(prefix = '') {
    if (state.result) return;
    const mark = markOf(state.turn).symbol;
    if (vsBot()) {
      announce(state.turn === PLAYER
        ? `${prefix}Đến lượt bé ${mark}: chạm vào một ô trống nhé!`
        : `${prefix}${state.marks.bot.name} ${mark} đang nghĩ…`);
    } else {
      announce(`${prefix}Đến lượt ${sideName(state.turn)}.`);
    }
  }

  function buildModes() {
    const options = [
      { id: 'bot', label: `🐻 Chơi với ${state.marks.bot.name}` },
      { id: 'friend', label: '👫 Chơi với bạn' }
    ];
    els.modes.replaceChildren(...options.map((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'caro-mode';
      button.dataset.mode = option.id;
      button.textContent = option.label;
      const active = option.id === state.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.addEventListener('click', () => {
        if (option.id !== state.mode) startMatch({ mode: option.id, fresh: true });
      });
      return button;
    }));
  }

  function buildLevels() {
    els.levels.hidden = !vsBot();
    els.levels.replaceChildren(...state.levels.map((level) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'caro-level';
      button.dataset.level = level.id;
      button.textContent = level.label;
      button.title = level.description || '';
      const active = level.id === state.level.id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute('aria-label', `${level.label}: ${level.description || ''}`);
      button.addEventListener('click', () => {
        if (level.id !== state.level.id) startMatch({ levelId: level.id, fresh: true });
      });
      return button;
    }));
  }

  function buildBoard() {
    const { size, winLength } = state.rules;
    els.board.style.setProperty('--caro-size', String(size));
    els.board.setAttribute('aria-label', `Bàn cờ ${size}×${size}, xếp ${winLength} hình thẳng hàng để thắng. Dùng phím mũi tên để chọn ô, Enter để đặt hình.`);
    els.cells = Array.from({ length: size * size }, (_, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'caro-cell';
      cell.id = `caroCell${index}`;
      cell.dataset.index = String(index);
      cell.addEventListener('click', () => play(index));
      cell.addEventListener('focus', () => { state.focus = index; syncTabStops(); });
      return cell;
    });
    els.board.replaceChildren(...els.cells);
    els.goal.textContent = String(winLength);
  }

  function syncTabStops() {
    els.cells.forEach((cell, index) => { cell.tabIndex = index === state.focus ? 0 : -1; });
  }

  function humanTurn() {
    return !state.result && (!vsBot() || state.turn === PLAYER);
  }

  function render() {
    const { size } = state.rules;
    const winLine = state.result?.line || [];
    const canPlay = humanTurn();
    els.board.classList.toggle('waiting', !canPlay && !state.result);
    els.board.classList.toggle('finished', Boolean(state.result));
    els.board.setAttribute('aria-busy', !canPlay && !state.result ? 'true' : 'false');

    els.cells.forEach((cell, index) => {
      const value = state.board[index];
      const mark = markOf(value);
      const row = Math.floor(index / size) + 1;
      const col = (index % size) + 1;
      cell.textContent = mark ? mark.symbol : '';
      cell.classList.toggle('filled', Boolean(value));
      cell.classList.toggle('mark-player', value === PLAYER);
      cell.classList.toggle('mark-bot', value === BOT);
      cell.classList.toggle('last', index === state.lastMove && !state.result);
      cell.classList.toggle('hint', index === state.hint && !value);
      cell.classList.toggle('win', winLine.includes(index));
      cell.setAttribute('aria-disabled', value || !canPlay ? 'true' : 'false');
      const extra = index === state.lastMove && value ? ' (nước vừa đi)' : '';
      cell.setAttribute('aria-label', `Hàng ${row}, cột ${col}: ${mark ? `${mark.symbol} ${sideName(value)}${extra}` : 'trống'}`);
    });
    syncTabStops();

    const turnMark = markOf(state.turn);
    els.turn.textContent = state.result ? 'Hết ván' : `${turnMark.symbol} ${sideName(state.turn)}`;
    els.scorePlayerLabel.textContent = vsBot() ? `${state.marks.player.symbol} Bé` : `${state.marks.player.symbol} Bạn 1`;
    els.scoreBotLabel.textContent = vsBot() ? `${state.marks.bot.symbol} Gấu` : `${state.marks.bot.symbol} Bạn 2`;
    els.scorePlayer.textContent = String(state.score.player);
    els.scoreDraw.textContent = String(state.score.draw);
    els.scoreBot.textContent = String(state.score.bot);
    els.hintButton.disabled = !canPlay;
  }

  function play(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.board.length) return false;
    if (state.result || state.board[index] !== EMPTY) {
      if (!state.result) playTone([220], 0.08);
      return false;
    }
    if (vsBot() && state.turn !== PLAYER) return false;
    place(index);
    return true;
  }

  function place(index) {
    const mark = state.turn;
    state.board[index] = mark;
    state.moves += 1;
    state.lastMove = index;
    state.hint = -1;
    playTone(mark === PLAYER ? [660] : [440], 0.09);

    const line = lineThrough(state.board, state.rules, index);
    const result = line
      ? { winner: mark, line }
      : (state.board.every(Boolean) ? { winner: EMPTY, line: [] } : null);
    if (result) {
      finish(result);
      return;
    }
    state.turn = other(mark);
    render();
    persist();
    if (vsBot() && mark === PLAYER && state.moves <= 2) {
      withRewards((api) => api.trackProgress({ levelId: state.level.id, moves: state.moves }));
    }
    announceTurn();
    scheduleBot();
  }

  function scheduleBot() {
    clearBotTimer();
    if (!vsBot() || state.result || state.turn !== BOT) return;
    state.botTimer = root.setTimeout(botMove, BOT_DELAY_MS);
  }

  function botMove() {
    state.botTimer = 0;
    if (!vsBot() || state.result || state.turn !== BOT) return;
    const move = chooseMove(state.board, state.rules, BOT, state.level, state.rng);
    if (move >= 0) {
      place(move);
      if (!state.result) state.focus = move;
      syncTabStops();
    }
  }

  /** Gợi ý một ô tốt cho người đang đi; không ảnh hưởng tới sao. */
  function showHint() {
    if (!humanTurn()) return -1;
    const options = bestMoves(state.board, state.rules, state.turn, { defense: 0.95 });
    if (!options.length) return -1;
    state.hint = pick(options, state.rng);
    render();
    focusCell(state.hint);
    const { size } = state.rules;
    announce(`Gợi ý: thử ô hàng ${Math.floor(state.hint / size) + 1}, cột ${(state.hint % size) + 1} xem sao!`);
    return state.hint;
  }

  function starsFor(winner) {
    if (winner === PLAYER) return 3;
    if (winner === EMPTY) return Math.min(3, Math.max(1, Number(state.level.drawStars) || 1));
    return 0;
  }

  function finish(result) {
    clearBotTimer();
    state.result = result;
    if (result.winner === PLAYER) state.score.player += 1;
    else if (result.winner === BOT) state.score.bot += 1;
    else state.score.draw += 1;
    render();
    persist();
    showWin(result);
  }

  function showWin(result) {
    const { winner } = result;
    const { winLength } = state.rules;
    let title;
    let text;
    let stars = 0;
    if (!vsBot()) {
      title = winner ? `${sideName(winner)} thắng!` : 'Hòa nhau rồi!';
      text = winner
        ? `${winLength} hình thẳng hàng rồi! Đổi lượt đi trước và chơi tiếp nhé.`
        : 'Kín bàn mà chưa ai thắng. Chơi ván nữa nào!';
    } else if (winner === PLAYER) {
      stars = starsFor(winner);
      title = 'Bé thắng rồi!';
      text = `Bé xếp được ${winLength} ${state.marks.player.symbol} thẳng hàng ở cấp ${state.level.label}.`;
    } else if (winner === EMPTY) {
      stars = starsFor(winner);
      title = 'Hòa nhau rồi!';
      text = `Kín bàn rồi — bé và ${state.marks.bot.name} ngang tài ngang sức.`;
    } else {
      title = `${state.marks.bot.name} thắng ván này`;
      text = 'Không sao đâu! Nhớ chặn ngay khi Gấu có 3 hình liền nhau, rồi thử lại nhé.';
    }

    els.winStars.textContent = stars ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : (vsBot() ? '🤗' : '🎉');
    els.winTitle.textContent = title;
    els.winText.textContent = text;
    els.win.hidden = false;
    announce(`${title} ${text}`);
    playTone(winner === BOT && vsBot() ? [392, 330] : [523, 659, 784, 1047], 0.14);
    root.setTimeout(() => els.winNext.focus(), 30);
    awardCompletion(winner, stars);
  }

  function awardCompletion(winner, stars) {
    if (els.winRewards) {
      els.winRewards.replaceChildren();
      els.winRewards.hidden = true;
    }
    if (!vsBot()) return Promise.resolve(null);
    if (winner === BOT) return withRewards((api) => api.abandon());

    const levelId = state.level.id;
    const matchId = state.matchId;
    const result = {
      levelId,
      matchId,
      outcome: winner === PLAYER ? 'win' : 'draw',
      stars,
      moves: state.moves,
      durationSeconds: state.startedAt ? Math.max(0, Math.round((Date.now() - state.startedAt) / 1000)) : null
    };
    return withRewards((api) => {
      const detail = api.complete(result);
      if (!detail || detail.duplicate || !els.winRewards || state.matchId !== matchId) return detail;
      els.winRewards.replaceChildren(...api.rewardLines(detail).map((text, index) => {
        const line = document.createElement('p');
        line.className = index === 0 ? 'caro-reward-stars' : 'caro-reward-unlock';
        line.textContent = text;
        return line;
      }));
      els.winRewards.hidden = false;
      return detail;
    });
  }

  /** Bỏ ván dở với máy: xóa đánh dấu "đang chơi dở" trong Góc phụ huynh. */
  function abandonTracking() {
    if (vsBot() && state.moves > 0 && !state.result) withRewards((api) => api.abandon());
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
    const { size } = state.rules;
    const row = Math.floor(state.focus / size);
    const col = state.focus % size;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      const [dRow, dCol] = arrows[event.key];
      focusCell(((row + dRow + size) % size) * size + ((col + dCol + size) % size));
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusCell(row * size + (event.key === 'Home' ? 0 : size - 1));
    }
  }

  function init(content) {
    const normalized = normalizeContent(content);
    state.levels = normalized.levels;
    state.marks = normalized.marks;
    state.rules = normalized.board;
    const saved = readSaved();
    state.score = validScore(saved?.score);
    state.nextStarter = [PLAYER, BOT].includes(saved?.nextStarter) ? saved.nextStarter : PLAYER;
    const levelId = state.levels.some((level) => level.id === saved?.levelId) ? saved.levelId : normalized.defaultLevelId;
    const mode = MODES.includes(saved?.mode) ? saved.mode : (MODES.includes(normalized.defaultMode) ? normalized.defaultMode : 'bot');
    state.level = state.levels.find((level) => level.id === levelId) || state.levels[0];
    state.mode = mode;
    buildBoard();
    startMatch({ levelId, mode, saved });

    root.BongGame14 = Object.freeze({
      getState: () => ({
        levelId: state.level.id,
        mode: state.mode,
        rules: { ...state.rules },
        board: state.board.slice(),
        turn: state.turn,
        starter: state.starter,
        matchId: state.matchId,
        moves: state.moves,
        lastMove: state.lastMove,
        hint: state.hint,
        result: state.result ? { winner: state.result.winner, line: state.result.line.slice() } : null,
        score: { ...state.score }
      }),
      newGame: (options = {}) => startMatch({ ...options, fresh: true }),
      play,
      hint: showHint,
      botMoveNow: () => { clearBotTimer(); botMove(); }
    });
  }

  function boot() {
    Object.assign(els, {
      board: document.getElementById('caroBoard'),
      modes: document.getElementById('caroModes'),
      levels: document.getElementById('caroLevels'),
      goal: document.getElementById('caroGoal'),
      turn: document.getElementById('caroTurn'),
      hintButton: document.getElementById('caroHint'),
      scorePlayer: document.getElementById('caroScorePlayer'),
      scoreDraw: document.getElementById('caroScoreDraw'),
      scoreBot: document.getElementById('caroScoreBot'),
      scorePlayerLabel: document.getElementById('caroScorePlayerLabel'),
      scoreBotLabel: document.getElementById('caroScoreBotLabel'),
      status: document.getElementById('caroStatus'),
      win: document.getElementById('caroWin'),
      winStars: document.getElementById('caroWinStars'),
      winTitle: document.getElementById('caroWinTitle'),
      winText: document.getElementById('caroWinText'),
      winRewards: document.getElementById('caroWinRewards'),
      winNext: document.getElementById('caroWinNext')
    });
    if (!els.board) return;

    els.board.addEventListener('keydown', onBoardKeyDown);
    els.hintButton.addEventListener('click', showHint);
    document.getElementById('caroNew').addEventListener('click', () => startMatch({ fresh: true }));
    els.winNext.addEventListener('click', () => {
      startMatch({ fresh: true });
      focusCell(state.focus);
    });
    els.win.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideWin();
        focusCell(state.focus);
      }
    });

    fetch(CONTENT_URL, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .catch((error) => {
        console.warn('[Bông Home] Dùng nội dung dự phòng cho Game 14', error);
        return FALLBACK_CONTENT;
      })
      .then(init);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof window !== 'undefined' ? window : null);
