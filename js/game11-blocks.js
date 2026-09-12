(() => {
  'use strict';

  const CONTENT_URL = './content/games/game11.json';
  const state = {
    size: 10,
    board: [],
    shapes: [],
    shapeMap: new Map(),
    colors: [],
    tray: [],
    score: 0,
    selectedSlot: 0,
    cursor: { row: 0, col: 0 },
    preview: null,
    drag: null,
    initialShapeIds: []
  };

  const els = {};

  function announce(message) {
    if (!els.status) return;
    els.status.textContent = message;
  }

  function getBounds(cells) {
    return cells.reduce((acc, [row, col]) => ({
      rows: Math.max(acc.rows, row + 1),
      cols: Math.max(acc.cols, col + 1)
    }), { rows: 0, cols: 0 });
  }

  function normalizeContent(content) {
    if (content?.schemaVersion !== 1 || !Array.isArray(content.shapes)) {
      throw new Error('Nội dung Game 11 không hợp lệ');
    }
    const size = Number(content.boardSize);
    if (!Number.isInteger(size) || size < 6 || size > 12) throw new Error('Kích thước bàn không hợp lệ');
    const shapes = content.shapes
      .filter((shape) => typeof shape?.id === 'string' && Array.isArray(shape.cells) && shape.cells.length)
      .map((shape) => ({
        id: shape.id,
        cells: shape.cells.map(([row, col]) => [Number(row), Number(col)])
      }))
      .filter((shape) => shape.cells.every(([row, col]) => Number.isInteger(row) && Number.isInteger(col) && row >= 0 && col >= 0));
    if (shapes.length < 6) throw new Error('Chưa đủ hình khối');
    return {
      size,
      shapes,
      colors: Array.isArray(content.colors) && content.colors.length ? content.colors.slice() : ['#6FA8FF'],
      initialShapeIds: Array.isArray(content.initialShapeIds) ? content.initialShapeIds.slice(0, 3) : []
    };
  }

  async function loadContent() {
    const response = await fetch(CONTENT_URL);
    if (!response.ok) throw new Error(`${CONTENT_URL}: HTTP ${response.status}`);
    return normalizeContent(await response.json());
  }

  function emptyBoard() {
    state.board = Array.from({ length: state.size * state.size }, () => null);
  }

  function boardIndex(row, col) {
    return row * state.size + col;
  }

  function inBoard(row, col) {
    return row >= 0 && col >= 0 && row < state.size && col < state.size;
  }

  function canPlace(shape, row, col) {
    return shape.cells.every(([dr, dc]) => {
      const targetRow = row + dr;
      const targetCol = col + dc;
      return inBoard(targetRow, targetCol) && state.board[boardIndex(targetRow, targetCol)] === null;
    });
  }

  function hasPlacement(shape) {
    const bounds = getBounds(shape.cells);
    for (let row = 0; row <= state.size - bounds.rows; row += 1) {
      for (let col = 0; col <= state.size - bounds.cols; col += 1) {
        if (canPlace(shape, row, col)) return true;
      }
    }
    return false;
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function makePiece(shape, color) {
    return { shape, color, used: false };
  }

  function makeTray(useInitial = false) {
    let shapes;
    if (useInitial && state.initialShapeIds.length === 3) {
      shapes = state.initialShapeIds.map((id) => state.shapeMap.get(id)).filter(Boolean);
    }
    if (!shapes || shapes.length !== 3) {
      shapes = Array.from({ length: 3 }, () => randomItem(state.shapes));
    }
    state.tray = shapes.map((shape, index) => makePiece(shape, state.colors[(state.score + index) % state.colors.length]));
    state.selectedSlot = state.tray.findIndex((piece) => !piece.used);
    if (state.selectedSlot < 0) state.selectedSlot = 0;
    ensurePlayableTray();
  }

  function ensurePlayableTray() {
    if (state.tray.some((piece) => !piece.used && hasPlacement(piece.shape))) return;
    const fittingShapes = state.shapes.filter(hasPlacement);
    if (!fittingShapes.length) return;
    state.tray = state.tray.map((piece, index) => piece.used
      ? piece
      : makePiece(randomItem(fittingShapes), state.colors[(state.score + index + 2) % state.colors.length]));
    state.selectedSlot = state.tray.findIndex((piece) => !piece.used && hasPlacement(piece.shape));
    announce('Bàn hơi chật nên Bông được đổi sang những khối dễ đặt hơn nhé!');
  }

  function buildBoard() {
    els.board.innerHTML = '';
    els.board.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
    els.board.setAttribute('aria-rowcount', String(state.size));
    els.board.setAttribute('aria-colcount', String(state.size));
    for (let row = 0; row < state.size; row += 1) {
      for (let col = 0; col < state.size; col += 1) {
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

  function renderBoard() {
    const previewCells = new Map();
    if (state.preview) {
      const piece = state.tray[state.preview.slot];
      if (piece && !piece.used) {
        const valid = canPlace(piece.shape, state.preview.row, state.preview.col);
        piece.shape.cells.forEach(([dr, dc]) => {
          const row = state.preview.row + dr;
          const col = state.preview.col + dc;
          if (inBoard(row, col)) previewCells.set(`${row}:${col}`, valid ? 'ok' : 'bad');
        });
      }
    }

    els.board.querySelectorAll('.block-cell').forEach((cell) => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const value = state.board[boardIndex(row, col)];
      cell.className = 'block-cell';
      cell.style.removeProperty('--block-color');
      cell.style.removeProperty('--preview-color');
      if (value) {
        cell.classList.add('filled');
        cell.style.setProperty('--block-color', value);
      }
      const previewType = previewCells.get(`${row}:${col}`);
      if (previewType === 'ok' && !value) {
        cell.classList.add('preview-ok');
        const piece = state.tray[state.preview.slot];
        if (piece) cell.style.setProperty('--preview-color', piece.color);
      } else if (previewType === 'bad' && !value) {
        cell.classList.add('preview-bad');
      }
      if (row === state.cursor.row && col === state.cursor.col) cell.classList.add('cursor-cell');
    });
  }

  function pieceVisual(piece) {
    const bounds = getBounds(piece.shape.cells);
    const shape = document.createElement('span');
    shape.className = 'piece-shape';
    shape.style.gridTemplateColumns = `repeat(${bounds.cols}, 1fr)`;
    shape.style.setProperty('--piece-color', piece.color);
    const occupied = new Set(piece.shape.cells.map(([row, col]) => `${row}:${col}`));
    for (let row = 0; row < bounds.rows; row += 1) {
      for (let col = 0; col < bounds.cols; col += 1) {
        const mini = document.createElement('span');
        mini.className = occupied.has(`${row}:${col}`) ? 'piece-mini-cell on' : 'piece-mini-cell';
        shape.appendChild(mini);
      }
    }
    return shape;
  }

  function renderTray() {
    els.tray.innerHTML = '';
    state.tray.forEach((piece, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'block-piece';
      button.dataset.slot = String(index);
      button.style.setProperty('--piece-color', piece.color);
      button.setAttribute('aria-label', piece.used ? `Khối ${index + 1} đã dùng` : `Chọn khối ${index + 1}`);
      button.setAttribute('aria-pressed', !piece.used && state.selectedSlot === index ? 'true' : 'false');
      button.disabled = piece.used;
      button.appendChild(pieceVisual(piece));
      button.addEventListener('click', () => selectPiece(index));
      button.addEventListener('pointerdown', (event) => startDrag(event, index));
      els.tray.appendChild(button);
    });
  }

  function updateScore() {
    els.score.textContent = String(state.score);
  }

  function selectPiece(index) {
    const piece = state.tray[index];
    if (!piece || piece.used) return;
    state.selectedSlot = index;
    state.preview = { slot: index, row: state.cursor.row, col: state.cursor.col };
    renderTray();
    renderBoard();
    announce(`Đã chọn khối ${index + 1}. Chạm vào bàn để đặt khối.`);
  }

  function completedLines() {
    const rows = [];
    const cols = [];
    for (let row = 0; row < state.size; row += 1) {
      if (Array.from({ length: state.size }, (_, col) => state.board[boardIndex(row, col)]).every(Boolean)) rows.push(row);
    }
    for (let col = 0; col < state.size; col += 1) {
      if (Array.from({ length: state.size }, (_, row) => state.board[boardIndex(row, col)]).every(Boolean)) cols.push(col);
    }
    return { rows, cols };
  }

  function clearLines(lines) {
    lines.rows.forEach((row) => {
      for (let col = 0; col < state.size; col += 1) state.board[boardIndex(row, col)] = null;
    });
    lines.cols.forEach((col) => {
      for (let row = 0; row < state.size; row += 1) state.board[boardIndex(row, col)] = null;
    });
  }

  function placeSelected(row, col) {
    const piece = state.tray[state.selectedSlot];
    if (!piece || piece.used) {
      announce('Hãy chọn một khối ở phía dưới trước nhé.');
      return false;
    }
    if (!canPlace(piece.shape, row, col)) {
      state.preview = { slot: state.selectedSlot, row, col };
      renderBoard();
      announce('Chỗ này chưa vừa. Bé thử một ô khác nhé!');
      return false;
    }

    piece.shape.cells.forEach(([dr, dc]) => {
      state.board[boardIndex(row + dr, col + dc)] = piece.color;
    });
    piece.used = true;
    state.score += piece.shape.cells.length;
    const lines = completedLines();
    const cleared = lines.rows.length + lines.cols.length;
    if (cleared) {
      clearLines(lines);
      state.score += cleared * 10;
    }

    state.preview = null;
    if (state.tray.every((item) => item.used)) makeTray(false);
    else {
      const next = state.tray.findIndex((item) => !item.used && hasPlacement(item.shape));
      state.selectedSlot = next >= 0 ? next : state.tray.findIndex((item) => !item.used);
      ensurePlayableTray();
    }
    renderAll();
    announce(cleared
      ? `Tuyệt lắm! Bé vừa dọn được ${cleared} ${cleared === 1 ? 'hàng hoặc cột' : 'hàng và cột'}.`
      : 'Đặt khối thành công! Bé chọn khối tiếp theo nhé.');
    return true;
  }

  function renderAll() {
    updateScore();
    renderTray();
    renderBoard();
  }

  function cellFromPoint(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    const cell = element?.closest?.('.block-cell');
    if (!cell || !els.board.contains(cell)) return null;
    return { row: Number(cell.dataset.row), col: Number(cell.dataset.col), cell };
  }

  function setPreviewAtPoint(clientX, clientY, slot = state.selectedSlot) {
    const target = cellFromPoint(clientX, clientY);
    if (!target) {
      state.preview = null;
      renderBoard();
      return null;
    }
    state.cursor = { row: target.row, col: target.col };
    state.preview = { slot, row: target.row, col: target.col };
    renderBoard();
    return target;
  }

  function makeGhost(piece) {
    const ghost = pieceVisual(piece);
    ghost.classList.add('block-drag-ghost');
    document.body.appendChild(ghost);
    return ghost;
  }

  function startDrag(event, index) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const piece = state.tray[index];
    if (!piece || piece.used) return;
    selectPiece(index);
    event.preventDefault();
    const ghost = makeGhost(piece);
    ghost.style.left = `${event.clientX}px`;
    ghost.style.top = `${event.clientY}px`;
    state.drag = { pointerId: event.pointerId, slot: index, ghost };
    window.addEventListener('pointermove', onDragMove, { passive: false });
    window.addEventListener('pointerup', onDragEnd, { once: true });
    window.addEventListener('pointercancel', onDragCancel, { once: true });
  }

  function onDragMove(event) {
    if (!state.drag || event.pointerId !== state.drag.pointerId) return;
    event.preventDefault();
    state.drag.ghost.style.left = `${event.clientX}px`;
    state.drag.ghost.style.top = `${event.clientY - 34}px`;
    setPreviewAtPoint(event.clientX, event.clientY - 34, state.drag.slot);
  }

  function finishDrag() {
    if (!state.drag) return;
    state.drag.ghost.remove();
    state.drag = null;
    window.removeEventListener('pointermove', onDragMove);
  }

  function onDragEnd(event) {
    if (!state.drag || event.pointerId !== state.drag.pointerId) return;
    const target = cellFromPoint(event.clientX, event.clientY - 34) || cellFromPoint(event.clientX, event.clientY);
    const slot = state.drag.slot;
    finishDrag();
    if (target) {
      state.selectedSlot = slot;
      placeSelected(target.row, target.col);
    } else {
      state.preview = null;
      renderBoard();
    }
  }

  function onDragCancel() {
    finishDrag();
    state.preview = null;
    renderBoard();
  }

  function onBoardPointer(event) {
    if (state.drag) return;
    const cell = event.target.closest('.block-cell');
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    state.cursor = { row, col };
    state.preview = { slot: state.selectedSlot, row, col };
    placeSelected(row, col);
  }

  function onBoardMove(event) {
    if (event.pointerType === 'touch' || state.drag) return;
    const cell = event.target.closest('.block-cell');
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (state.preview?.row === row && state.preview?.col === col && state.preview?.slot === state.selectedSlot) return;
    state.cursor = { row, col };
    state.preview = { slot: state.selectedSlot, row, col };
    renderBoard();
  }

  function onBoardKey(event) {
    const moves = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1]
    };
    if (moves[event.key]) {
      event.preventDefault();
      const [dr, dc] = moves[event.key];
      state.cursor.row = Math.max(0, Math.min(state.size - 1, state.cursor.row + dr));
      state.cursor.col = Math.max(0, Math.min(state.size - 1, state.cursor.col + dc));
      state.preview = { slot: state.selectedSlot, row: state.cursor.row, col: state.cursor.col };
      renderBoard();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      placeSelected(state.cursor.row, state.cursor.col);
    }
  }

  function resetGame() {
    state.score = 0;
    state.cursor = { row: 0, col: 0 };
    state.preview = null;
    emptyBoard();
    makeTray(true);
    renderAll();
    announce('Bàn mới đã sẵn sàng. Bé chọn một khối rồi chạm vào bàn nhé!');
    els.board.focus({ preventScroll: true });
  }

  function bindEvents() {
    els.board.addEventListener('click', onBoardPointer);
    els.board.addEventListener('pointermove', onBoardMove);
    els.board.addEventListener('mouseleave', () => {
      if (state.drag) return;
      state.preview = null;
      renderBoard();
    });
    els.board.addEventListener('keydown', onBoardKey);
    els.reset.addEventListener('click', resetGame);
  }

  async function init() {
    Object.assign(els, {
      board: document.getElementById('blockBoard'),
      tray: document.getElementById('blockTray'),
      score: document.getElementById('blockScore'),
      status: document.getElementById('blockStatus'),
      reset: document.getElementById('blockReset')
    });
    if (Object.values(els).some((value) => !value)) return;

    try {
      const content = await loadContent();
      state.size = content.size;
      state.shapes = content.shapes;
      state.shapeMap = new Map(state.shapes.map((shape) => [shape.id, shape]));
      state.colors = content.colors;
      state.initialShapeIds = content.initialShapeIds;
      emptyBoard();
      buildBoard();
      makeTray(true);
      bindEvents();
      renderAll();
      announce('Chọn một khối rồi chạm vào ô muốn đặt. Đầy một hàng hoặc cột là khối sẽ được dọn đi.');
      window.BongGame11 = Object.freeze({
        reset: resetGame,
        getState: () => ({
          score: state.score,
          usedCells: state.board.filter(Boolean).length,
          selectedSlot: state.selectedSlot,
          tray: state.tray.map((piece) => ({ id: piece.shape.id, used: piece.used }))
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
