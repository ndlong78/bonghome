(() => {
  'use strict';

  const CONTENT_URL = './content/games/game11.json';
  const state = {
    rows: 16,
    cols: 10,
    board: [],
    shapes: [],
    shapeMap: new Map(),
    colors: [],
    fallIntervalMs: 1000,
    initialShapeIds: [],
    sequenceIndex: 0,
    pieceCount: 0,
    active: null,
    next: null,
    score: 0,
    lines: 0,
    gameOver: false,
    timer: null,
    manualPaused: false
  };

  const els = {};

  function announce(message) {
    if (els.status) els.status.textContent = message;
  }

  function normalizeCells(cells) {
    const minRow = Math.min(...cells.map(([row]) => row));
    const minCol = Math.min(...cells.map(([, col]) => col));
    return cells
      .map(([row, col]) => [row - minRow, col - minCol])
      .sort(([rowA, colA], [rowB, colB]) => rowA - rowB || colA - colB);
  }

  function getBounds(cells) {
    return cells.reduce((bounds, [row, col]) => ({
      rows: Math.max(bounds.rows, row + 1),
      cols: Math.max(bounds.cols, col + 1)
    }), { rows: 0, cols: 0 });
  }

  function normalizeContent(content) {
    if (content?.schemaVersion !== 2 || !Array.isArray(content.shapes)) {
      throw new Error('Nội dung Game 11 không hợp lệ');
    }
    const rows = Number(content.boardRows);
    const cols = Number(content.boardCols);
    const fallIntervalMs = Number(content.fallIntervalMs);
    if (!Number.isInteger(rows) || rows < 12 || rows > 24) throw new Error('Số hàng không hợp lệ');
    if (!Number.isInteger(cols) || cols < 8 || cols > 12) throw new Error('Số cột không hợp lệ');
    if (!Number.isFinite(fallIntervalMs) || fallIntervalMs < 500 || fallIntervalMs > 2500) {
      throw new Error('Tốc độ rơi không hợp lệ');
    }

    const shapes = content.shapes
      .filter((shape) => typeof shape?.id === 'string' && Array.isArray(shape.cells) && shape.cells.length === 4)
      .map((shape) => ({
        id: shape.id,
        cells: normalizeCells(shape.cells.map(([row, col]) => [Number(row), Number(col)]))
      }))
      .filter((shape) => shape.cells.every(([row, col]) => Number.isInteger(row) && Number.isInteger(col) && row >= 0 && col >= 0));
    if (shapes.length < 7) throw new Error('Chưa đủ hình khối');

    return {
      rows,
      cols,
      fallIntervalMs,
      shapes,
      colors: Array.isArray(content.colors) && content.colors.length ? content.colors.slice() : ['#6FA8FF'],
      initialShapeIds: Array.isArray(content.initialShapeIds) ? content.initialShapeIds.slice() : []
    };
  }

  async function loadContent() {
    const response = await fetch(CONTENT_URL);
    if (!response.ok) throw new Error(`${CONTENT_URL}: HTTP ${response.status}`);
    return normalizeContent(await response.json());
  }

  function boardIndex(row, col) {
    return row * state.cols + col;
  }

  function emptyBoard() {
    state.board = Array.from({ length: state.rows * state.cols }, () => null);
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function nextShape() {
    const preferredId = state.initialShapeIds[state.sequenceIndex];
    state.sequenceIndex += 1;
    return state.shapeMap.get(preferredId) || randomItem(state.shapes);
  }

  function makePiece() {
    const shape = nextShape();
    const color = state.colors[state.pieceCount % state.colors.length];
    state.pieceCount += 1;
    return { id: shape.id, cells: shape.cells.map(([row, col]) => [row, col]), color, row: 0, col: 0 };
  }

  function centerPiece(piece) {
    const bounds = getBounds(piece.cells);
    piece.row = 0;
    piece.col = Math.floor((state.cols - bounds.cols) / 2);
    return piece;
  }

  function canPlace(piece, row = piece.row, col = piece.col, cells = piece.cells) {
    return cells.every(([dr, dc]) => {
      const targetRow = row + dr;
      const targetCol = col + dc;
      return targetRow >= 0 && targetRow < state.rows
        && targetCol >= 0 && targetCol < state.cols
        && state.board[boardIndex(targetRow, targetCol)] === null;
    });
  }

  function buildBoard() {
    els.board.innerHTML = '';
    els.board.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    els.board.style.setProperty('--board-rows', String(state.rows));
    els.board.style.setProperty('--board-cols', String(state.cols));
    els.board.setAttribute('aria-rowcount', String(state.rows));
    els.board.setAttribute('aria-colcount', String(state.cols));

    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        const cell = document.createElement('div');
        cell.className = 'block-cell';
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `Hàng ${row + 1}, cột ${col + 1}`);
        els.board.appendChild(cell);
      }
    }
  }

  function landingRow(piece) {
    let row = piece.row;
    while (canPlace(piece, row + 1, piece.col)) row += 1;
    return row;
  }

  function renderBoard() {
    const activeCells = new Map();
    const ghostCells = new Set();

    if (state.active && !state.gameOver) {
      const ghostRow = landingRow(state.active);
      state.active.cells.forEach(([dr, dc]) => {
        activeCells.set(`${state.active.row + dr}:${state.active.col + dc}`, state.active.color);
        if (ghostRow !== state.active.row) ghostCells.add(`${ghostRow + dr}:${state.active.col + dc}`);
      });
    }

    els.board.querySelectorAll('.block-cell').forEach((cell) => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const key = `${row}:${col}`;
      const fixedColor = state.board[boardIndex(row, col)];
      const activeColor = activeCells.get(key);
      cell.className = 'block-cell';
      cell.style.removeProperty('--block-color');

      if (fixedColor) {
        cell.classList.add('filled');
        cell.style.setProperty('--block-color', fixedColor);
      } else if (activeColor) {
        cell.classList.add('filled', 'active');
        cell.style.setProperty('--block-color', activeColor);
      } else if (ghostCells.has(key)) {
        cell.classList.add('ghost');
        cell.style.setProperty('--block-color', state.active.color);
      }
    });
  }

  function pieceVisual(piece) {
    const visual = document.createElement('span');
    visual.className = 'piece-shape';
    if (!piece) return visual;
    const bounds = getBounds(piece.cells);
    visual.style.gridTemplateColumns = `repeat(${bounds.cols}, 1fr)`;
    visual.style.setProperty('--piece-color', piece.color);
    const occupied = new Set(piece.cells.map(([row, col]) => `${row}:${col}`));
    for (let row = 0; row < bounds.rows; row += 1) {
      for (let col = 0; col < bounds.cols; col += 1) {
        const mini = document.createElement('span');
        mini.className = occupied.has(`${row}:${col}`) ? 'piece-mini-cell on' : 'piece-mini-cell';
        visual.appendChild(mini);
      }
    }
    return visual;
  }

  function renderNext() {
    els.next.innerHTML = '';
    if (state.next) els.next.appendChild(pieceVisual(state.next));
  }

  function updateScore() {
    els.score.textContent = String(state.score);
  }

  function updateControls() {
    [els.left, els.rotate, els.right, els.drop].forEach((button) => {
      button.disabled = state.gameOver;
    });
  }

  function renderAll() {
    updateScore();
    renderNext();
    renderBoard();
    updateControls();
  }

  function spawnNextPiece() {
    if (!state.next) state.next = makePiece();
    state.active = centerPiece(state.next);
    state.next = makePiece();

    if (!canPlace(state.active)) {
      state.gameOver = true;
      stopTimer();
      renderAll();
      announce('Bàn đã đầy rồi. Bé bấm Chơi lại để bắt đầu một bàn mới nhé!');
      return false;
    }
    renderAll();
    return true;
  }

  function rotateCells(cells) {
    const bounds = getBounds(cells);
    return normalizeCells(cells.map(([row, col]) => [col, bounds.rows - 1 - row]));
  }

  function rotateActive() {
    if (!state.active || state.gameOver) return false;
    const rotated = rotateCells(state.active.cells);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (canPlace(state.active, state.active.row, state.active.col + kick, rotated)) {
        state.active.cells = rotated;
        state.active.col += kick;
        renderBoard();
        announce('Đã quay khối.');
        return true;
      }
    }
    announce('Chỗ này chưa đủ rộng để quay khối.');
    return false;
  }

  function moveActive(deltaCol) {
    if (!state.active || state.gameOver) return false;
    const nextCol = state.active.col + deltaCol;
    if (!canPlace(state.active, state.active.row, nextCol)) return false;
    state.active.col = nextCol;
    renderBoard();
    return true;
  }

  function completedRows() {
    const rows = [];
    for (let row = 0; row < state.rows; row += 1) {
      const full = Array.from({ length: state.cols }, (_, col) => state.board[boardIndex(row, col)]).every(Boolean);
      if (full) rows.push(row);
    }
    return rows;
  }

  function clearRows(rowsToClear) {
    if (!rowsToClear.length) return;
    const clearing = new Set(rowsToClear);
    const keptRows = [];
    for (let row = 0; row < state.rows; row += 1) {
      if (!clearing.has(row)) {
        keptRows.push(Array.from({ length: state.cols }, (_, col) => state.board[boardIndex(row, col)]));
      }
    }
    while (keptRows.length < state.rows) keptRows.unshift(Array.from({ length: state.cols }, () => null));
    state.board = keptRows.flat();
  }

  function lockActive() {
    if (!state.active || state.gameOver) return;
    state.active.cells.forEach(([dr, dc]) => {
      state.board[boardIndex(state.active.row + dr, state.active.col + dc)] = state.active.color;
    });
    state.score += state.active.cells.length;

    const clearedRows = completedRows();
    if (clearedRows.length) {
      clearRows(clearedRows);
      state.lines += clearedRows.length;
      state.score += clearedRows.length * 100;
    }

    const message = clearedRows.length
      ? `Tuyệt lắm! Bé vừa dọn được ${clearedRows.length} hàng.`
      : 'Khối đã nằm gọn rồi. Khối tiếp theo đang rơi xuống nhé!';

    spawnNextPiece();
    if (!state.gameOver) announce(message);
  }

  function stepDown() {
    if (!state.active || state.gameOver || state.manualPaused) return false;
    if (canPlace(state.active, state.active.row + 1, state.active.col)) {
      state.active.row += 1;
      renderBoard();
      return true;
    }
    lockActive();
    return false;
  }

  function hardDrop() {
    if (!state.active || state.gameOver) return false;
    state.active.row = landingRow(state.active);
    renderBoard();
    lockActive();
    return true;
  }

  function stopTimer() {
    if (state.timer) window.clearInterval(state.timer);
    state.timer = null;
  }

  function startTimer() {
    stopTimer();
    if (state.gameOver || state.manualPaused || document.hidden) return;
    state.timer = window.setInterval(stepDown, state.fallIntervalMs);
  }

  function pauseGame() {
    state.manualPaused = true;
    stopTimer();
  }

  function resumeGame() {
    state.manualPaused = false;
    startTimer();
  }

  function resetGame() {
    stopTimer();
    state.score = 0;
    state.lines = 0;
    state.gameOver = false;
    state.manualPaused = false;
    state.sequenceIndex = 0;
    state.pieceCount = 0;
    state.active = null;
    state.next = null;
    emptyBoard();
    spawnNextPiece();
    startTimer();
    announce('Bàn mới đã sẵn sàng. Bé dùng các nút để đưa khối xuống nhé!');
    els.board.focus({ preventScroll: true });
  }

  function onBoardKey(event) {
    const actions = {
      ArrowLeft: () => moveActive(-1),
      ArrowRight: () => moveActive(1),
      ArrowUp: rotateActive,
      ArrowDown: stepDown,
      ' ': hardDrop
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  function bindEvents() {
    els.left.addEventListener('click', () => moveActive(-1));
    els.rotate.addEventListener('click', rotateActive);
    els.right.addEventListener('click', () => moveActive(1));
    els.drop.addEventListener('click', hardDrop);
    els.reset.addEventListener('click', resetGame);
    els.board.addEventListener('keydown', onBoardKey);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopTimer();
      else startTimer();
    });
  }

  async function init() {
    Object.assign(els, {
      board: document.getElementById('blockBoard'),
      next: document.getElementById('blockNext'),
      score: document.getElementById('blockScore'),
      status: document.getElementById('blockStatus'),
      reset: document.getElementById('blockReset'),
      left: document.getElementById('blockLeft'),
      rotate: document.getElementById('blockRotate'),
      right: document.getElementById('blockRight'),
      drop: document.getElementById('blockDrop')
    });
    if (Object.values(els).some((value) => !value)) return;

    try {
      const content = await loadContent();
      state.rows = content.rows;
      state.cols = content.cols;
      state.fallIntervalMs = content.fallIntervalMs;
      state.shapes = content.shapes;
      state.shapeMap = new Map(state.shapes.map((shape) => [shape.id, shape]));
      state.colors = content.colors;
      state.initialShapeIds = content.initialShapeIds;
      emptyBoard();
      buildBoard();
      bindEvents();
      resetGame();

      window.BongGame11 = Object.freeze({
        reset: resetGame,
        pause: pauseGame,
        resume: resumeGame,
        moveLeft: () => moveActive(-1),
        moveRight: () => moveActive(1),
        rotate: rotateActive,
        stepDown,
        hardDrop,
        getState: () => ({
          rows: state.rows,
          cols: state.cols,
          score: state.score,
          lines: state.lines,
          usedCells: state.board.filter(Boolean).length,
          gameOver: state.gameOver,
          active: state.active ? {
            id: state.active.id,
            row: state.active.row,
            col: state.active.col,
            cells: state.active.cells.map(([row, col]) => [row, col])
          } : null,
          nextId: state.next?.id || null
        })
      });
    } catch (error) {
      console.error('[Bông Home] Game 11 không khởi động được', error);
      announce('Game chưa tải đủ dữ liệu. Bé quay lại khi có mạng rồi thử lại nhé.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
