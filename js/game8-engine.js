/*
 * Game 8 – Mê Cung Về Nhà: logic thuần, không đụng DOM.
 * Mê cung N x N sinh bằng thuật toán "đào đường" (DFS); bé đi từ ô (0,0) về ngôi nhà ở góc dưới phải.
 * Mọi hàm trả về trạng thái mới, không sửa trạng thái cũ; giao diện ở js/game8-ui.js.
 * Một ô là { tren, phai, duoi, trai }: true nghĩa là còn tường ở cạnh đó.
 */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.BongGame8Engine = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createGame8Engine() {
  'use strict';

  /** Ba mức độ: Dễ, Vừa, Khó. */
  const SIZES = Object.freeze([8, 12, 16]);
  const WALLS = Object.freeze(['tren', 'phai', 'duoi', 'trai']);
  const DIRECTIONS = Object.freeze({
    len: Object.freeze({ dx: 0, dy: -1, wall: 'tren', opposite: 'duoi' }),
    phai: Object.freeze({ dx: 1, dy: 0, wall: 'phai', opposite: 'trai' }),
    xuong: Object.freeze({ dx: 0, dy: 1, wall: 'duoi', opposite: 'tren' }),
    trai: Object.freeze({ dx: -1, dy: 0, wall: 'trai', opposite: 'phai' })
  });
  const DIRECTION_ORDER = Object.freeze(['len', 'phai', 'xuong', 'trai']);

  const isSize = (value) => SIZES.includes(value);
  const freezeMaze = (grid) => Object.freeze(grid.map((row) => Object.freeze(row.map((cell) => Object.freeze({
    tren: cell.tren, phai: cell.phai, duoi: cell.duoi, trai: cell.trai
  })))));
  const freezePath = (path) => Object.freeze(path.map(([x, y]) => Object.freeze([x, y])));

  /**
   * Sinh mê cung hoàn hảo (mọi ô đều tới được, giữa hai ô chỉ có một đường).
   * Mỗi vòng lặp hoặc đào sang một ô mới, hoặc lùi lại một ô, nên dừng sau tối đa 2·N² vòng.
   */
  function generateMaze(size, rng = Math.random) {
    if (!isSize(size)) throw new RangeError(`Kích thước ${size} không hợp lệ`);
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ({
      tren: true, phai: true, duoi: true, trai: true
    })));
    const visited = Array.from({ length: size }, () => new Array(size).fill(false));
    const stack = [[0, 0]];
    visited[0][0] = true;

    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const neighbours = DIRECTION_ORDER
        .map((name) => [name, DIRECTIONS[name]])
        .filter(([, d]) => {
          const nx = x + d.dx;
          const ny = y + d.dy;
          return nx >= 0 && ny >= 0 && nx < size && ny < size && !visited[ny][nx];
        });
      if (!neighbours.length) {
        stack.pop();
        continue;
      }
      const pick = Math.min(neighbours.length - 1, Math.floor(rng() * neighbours.length));
      const [, d] = neighbours[pick];
      const nx = x + d.dx;
      const ny = y + d.dy;
      // Phá bức tường giữa hai ô.
      grid[y][x][d.wall] = false;
      grid[ny][nx][d.opposite] = false;
      visited[ny][nx] = true;
      stack.push([nx, ny]);
    }
    return freezeMaze(grid);
  }

  const update = (state, changes) => Object.freeze({ ...state, ...changes });
  const atGoal = (size, x, y) => x === size - 1 && y === size - 1;

  function createGame(size = SIZES[0], rng = Math.random) {
    return Object.freeze({
      size,
      maze: generateMaze(size, rng),
      player: Object.freeze({ x: 0, y: 0 }),
      path: freezePath([[0, 0]]),
      steps: 0,
      seconds: 0,
      started: false,
      finished: false
    });
  }

  /**
   * Bé đi một bước theo hướng `direction` ('len' | 'phai' | 'xuong' | 'trai').
   * Trả về { state, event, startedNow }: event là 'ignored' | 'wall' | 'moved' | 'won'.
   * Giữ hành vi cũ: đồng hồ bắt đầu từ lần bấm đầu tiên, kể cả khi đụng tường; đụng tường không tính bước.
   */
  function move(state, direction) {
    const d = typeof direction === 'string' && Object.hasOwn(DIRECTIONS, direction) ? DIRECTIONS[direction] : null;
    if (!d || state.finished) return { state, event: 'ignored', startedNow: false };
    const startedNow = !state.started;
    const base = startedNow ? update(state, { started: true }) : state;
    const { x, y } = base.player;
    const nx = x + d.dx;
    const ny = y + d.dy;
    const inside = nx >= 0 && ny >= 0 && nx < base.size && ny < base.size;
    if (base.maze[y][x][d.wall] || !inside) return { state: base, event: 'wall', startedNow };

    const finished = atGoal(base.size, nx, ny);
    const next = update(base, {
      player: Object.freeze({ x: nx, y: ny }),
      path: Object.freeze([...base.path, Object.freeze([nx, ny])]),
      steps: base.steps + 1,
      finished
    });
    return { state: next, event: finished ? 'won' : 'moved', startedNow };
  }

  /** Một giây trôi qua: đồng hồ chỉ chạy sau lần bấm đầu và trước khi về tới nhà. */
  function tick(state) {
    return state.started && !state.finished ? update(state, { seconds: state.seconds + 1 }) : state;
  }

  const moves = (state) => state.steps;
  const difficulty = (state) => `${state.size}x${state.size}`;
  const canSave = (state) => !state.finished;

  /**
   * Bản lưu: giữ đúng định dạng của adapter games8-10-autosave trước khi tách engine,
   * để ván đang chơi dở trên máy của bé vẫn khôi phục được sau khi cập nhật.
   */
  function serialize(state, sessionId) {
    return {
      schemaVersion: 1,
      sessionId,
      size: state.size,
      maze: state.maze.map((row) => row.map(({ tren, phai, duoi, trai }) => ({ tren, phai, duoi, trai }))),
      player: { x: state.player.x, y: state.player.y },
      path: state.path.map(([x, y]) => [x, y]),
      steps: state.steps,
      seconds: state.seconds,
      started: state.started
    };
  }

  /** Tường khép kín quanh mê cung và hai ô kề nhau thấy cùng một bức tường. */
  function wallsConsistent(grid, size) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const cell = grid[y][x];
        if (y === 0 && !cell.tren) return false;
        if (x === 0 && !cell.trai) return false;
        if (y === size - 1 && !cell.duoi) return false;
        if (x === size - 1 && !cell.phai) return false;
        if (x < size - 1 && cell.phai !== grid[y][x + 1].trai) return false;
        if (y < size - 1 && cell.duoi !== grid[y + 1][x].tren) return false;
      }
    }
    return true;
  }

  /** Trạng thái từ bản lưu, hoặc null nếu bản lưu không hợp lệ (khi đó bé bắt đầu ván mới). */
  function restore(saved) {
    if (!saved || typeof saved !== 'object') return null;
    const size = saved.size;
    if (!isSize(size)) return null;
    const maze = Array.isArray(saved.maze) ? saved.maze : null;
    if (!maze || maze.length !== size) return null;
    if (maze.some((row) => !Array.isArray(row) || row.length !== size || row.some((cell) => !cell || typeof cell !== 'object'))) return null;
    const grid = maze.map((row) => row.map((cell) => ({
      tren: Boolean(cell.tren), phai: Boolean(cell.phai), duoi: Boolean(cell.duoi), trai: Boolean(cell.trai)
    })));
    if (!wallsConsistent(grid, size)) return null;

    const clamp = (value) => (Number.isInteger(value) ? Math.max(0, Math.min(size - 1, value)) : 0);
    const player = { x: clamp(saved.player?.x), y: clamp(saved.player?.y) };
    // Đã về tới nhà mà vẫn còn bản lưu (lưu đúng lúc thắng): coi như ván đã xong, bé chơi ván mới.
    if (atGoal(size, player.x, player.y)) return null;
    const inside = (point) => Array.isArray(point) && Number.isInteger(point[0]) && Number.isInteger(point[1])
      && point[0] >= 0 && point[1] >= 0 && point[0] < size && point[1] < size;
    const path = (Array.isArray(saved.path) ? saved.path : []).filter(inside);
    if (!path.length) path.push([0, 0]);
    const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

    return Object.freeze({
      size,
      maze: freezeMaze(grid),
      player: Object.freeze(player),
      path: freezePath(path),
      steps: count(saved.steps),
      seconds: count(saved.seconds),
      started: Boolean(saved.started),
      finished: false
    });
  }

  return Object.freeze({
    SIZES,
    WALLS,
    DIRECTIONS: DIRECTION_ORDER,
    generateMaze,
    createGame,
    move,
    tick,
    moves,
    difficulty,
    canSave,
    serialize,
    restore
  });
});
