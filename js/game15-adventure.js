(function (root) {
  'use strict';

  /* ---------- Engine: thuần logic, chạy được cả trong Node để test ---------- */
  /*
   * Đơn vị là ô bản đồ, trục y hướng xuống. Mỗi bước mô phỏng cố định 1/60 giây để vật lý
   * giống nhau trên mọi máy (máy chậm thì chạy nhiều bước trong một khung hình).
   */

  const DT = 1 / 60;
  const PHYSICS = Object.freeze({
    gravity: 38,
    maxFall: 18,
    runSpeed: 6,
    groundAccel: 45,
    airAccel: 30,
    friction: 36,
    jumpVelocity: 17,
    jumpCut: 0.45,
    coyoteTime: 0.1,
    jumpBuffer: 0.12,
    stompBounce: 11,
    springVelocity: 23,
    hurtInvulnerable: 1.4,
    respawnInvulnerable: 1,
    hearts: 3
  });
  const PLAYER_SIZE = Object.freeze({ w: 0.7, h: 0.9 });
  const ENEMY_SPECS = Object.freeze({
    w: Object.freeze({ type: 'caterpillar', w: 0.9, h: 0.5, speed: 1.5 }),
    b: Object.freeze({ type: 'bee', w: 0.7, h: 0.6, amplitude: 1.4, period: 2.6 })
  });
  const SOLID = new Set(['#', '=', 'T']);
  const ONE_WAY = '-';
  const SPRING = 'T';
  const TILE_CHARS = new Set(['.', '#', '=', '-', 'T']);
  const ENTITY_CHARS = new Set(['S', '*', 'C', 'F', 'w', 'b']);
  const EPS = 1e-6;

  /**
   * Đọc màn chơi từ bản đồ ô chữ (xem `legend` trong content/games/game15.json).
   * Ném lỗi khi bản đồ sai để test bắt được ngay, giao diện thì bỏ qua màn hỏng.
   */
  function parseLevel(def) {
    const rows = def?.rows;
    if (!Array.isArray(rows) || rows.length < 6) throw new TypeError(`Màn ${def?.id}: cần ít nhất 6 hàng`);
    const width = rows[0].length;
    if (width < 10 || !rows.every((row) => typeof row === 'string' && row.length === width)) {
      throw new TypeError(`Màn ${def?.id}: mọi hàng phải dài bằng nhau`);
    }
    const tiles = [];
    const stars = [];
    const enemies = [];
    const checkpoints = [];
    let start = null;
    let finish = null;
    rows.forEach((row, y) => {
      let line = '';
      [...row].forEach((ch, x) => {
        if (TILE_CHARS.has(ch)) { line += ch; return; }
        if (!ENTITY_CHARS.has(ch)) throw new TypeError(`Màn ${def.id}: ký tự lạ "${ch}" ở (${x}, ${y})`);
        line += '.';
        if (ch === 'S') {
          if (start) throw new TypeError(`Màn ${def.id}: chỉ được một chỗ xuất phát`);
          start = { x, y };
        } else if (ch === 'F') {
          if (finish) throw new TypeError(`Màn ${def.id}: chỉ được một ngôi nhà về đích`);
          finish = { x, y };
        } else if (ch === '*') {
          stars.push({ id: `s${x}-${y}`, x, y });
        } else if (ch === 'C') {
          checkpoints.push({ id: `c${x}-${y}`, x, y });
        } else {
          const spec = ENEMY_SPECS[ch];
          enemies.push({ id: `${ch}${x}-${y}`, type: spec.type, x, y });
        }
      });
      tiles.push(line);
    });
    if (!start || !finish) throw new TypeError(`Màn ${def.id}: thiếu chỗ xuất phát hoặc ngôi nhà về đích`);
    checkpoints.sort((a, b) => a.x - b.x);
    return Object.freeze({
      id: def.id,
      name: def.name || def.id,
      icon: def.icon || '⭐',
      theme: def.theme || 'garden',
      width,
      height: rows.length,
      tiles: Object.freeze(tiles),
      stars: Object.freeze(stars),
      enemies: Object.freeze(enemies),
      checkpoints: Object.freeze(checkpoints),
      start: Object.freeze(start),
      finish: Object.freeze(finish)
    });
  }

  /** Ngoài hai mép trái/phải là tường; phía trên và phía dưới bản đồ là khoảng trống (rơi xuống vực). */
  function tileAt(level, tx, ty) {
    if (tx < 0 || tx >= level.width) return '#';
    if (ty < 0 || ty >= level.height) return '.';
    return level.tiles[ty][tx];
  }

  function isSolid(level, tx, ty) {
    return SOLID.has(tileAt(level, tx, ty));
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function spawnPoint(level, checkpoint) {
    const spot = checkpoint || level.start;
    return { x: spot.x + (1 - PLAYER_SIZE.w) / 2, y: spot.y + 1 - PLAYER_SIZE.h };
  }

  function createEnemy(def) {
    const spec = ENEMY_SPECS[def.id[0]];
    const enemy = {
      id: def.id,
      type: spec.type,
      w: spec.w,
      h: spec.h,
      x: def.x + (1 - spec.w) / 2,
      y: def.y + 1 - spec.h,
      baseY: def.y + (1 - spec.h) / 2,
      dir: -1,
      phase: (def.x * 0.7) % (Math.PI * 2),
      asleep: false
    };
    if (spec.type === 'bee') enemy.y = enemy.baseY;
    return enemy;
  }

  /**
   * Tạo thế giới cho một lượt chơi. `saved` (tùy chọn) khôi phục cờ lưu, sao đã nhặt và
   * bạn đã "ru ngủ" từ lần chơi trước.
   */
  function createWorld(level, saved = null) {
    const checkpoint = level.checkpoints.find((item) => item.id === saved?.checkpointId) || null;
    const collected = new Set((saved?.collected || []).filter((id) => level.stars.some((star) => star.id === id)));
    const asleep = new Set(saved?.asleep || []);
    const spawn = spawnPoint(level, checkpoint);
    const world = {
      level,
      time: 0,
      player: {
        ...spawn,
        w: PLAYER_SIZE.w,
        h: PLAYER_SIZE.h,
        vx: 0,
        vy: 0,
        facing: 1,
        onGround: false,
        coyote: 0,
        buffer: 0,
        jumpHeld: false,
        invulnerable: 0,
        hearts: PHYSICS.hearts
      },
      enemies: level.enemies.map((def) => {
        const enemy = createEnemy(def);
        enemy.asleep = asleep.has(enemy.id);
        return enemy;
      }),
      collected,
      checkpoint,
      reached: new Set(level.checkpoints.filter((item) => checkpoint && item.x <= checkpoint.x).map((item) => item.id)),
      finished: false,
      falls: 0,
      hurts: 0,
      stomps: 0
    };
    return world;
  }

  function moveX(world, dx) {
    const { level, player: p } = world;
    p.x += dx;
    const top = Math.floor(p.y + EPS);
    const bottom = Math.floor(p.y + p.h - EPS);
    if (dx > 0) {
      const tx = Math.floor(p.x + p.w - EPS);
      for (let ty = top; ty <= bottom; ty += 1) {
        if (isSolid(level, tx, ty)) { p.x = tx - p.w; p.vx = 0; return; }
      }
    } else if (dx < 0) {
      const tx = Math.floor(p.x + EPS);
      for (let ty = top; ty <= bottom; ty += 1) {
        if (isSolid(level, tx, ty)) { p.x = tx + 1; p.vx = 0; return; }
      }
    }
  }

  function moveY(world, dy, events) {
    const { level, player: p } = world;
    const previousBottom = p.y + p.h;
    p.y += dy;
    p.onGround = false;
    const left = Math.floor(p.x + EPS);
    const right = Math.floor(p.x + p.w - EPS);
    if (dy > 0) {
      const ty = Math.floor(p.y + p.h - EPS);
      for (let tx = left; tx <= right; tx += 1) {
        const tile = tileAt(level, tx, ty);
        const lands = SOLID.has(tile) || (tile === ONE_WAY && previousBottom <= ty + EPS);
        if (!lands) continue;
        p.y = ty - p.h;
        if (tile === SPRING || (right !== left && tileAt(level, tx === left ? right : left, ty) === SPRING)) {
          p.vy = -PHYSICS.springVelocity;
          p.jumpHeld = false;
          events.push({ type: 'spring' });
        } else {
          p.vy = 0;
          p.onGround = true;
        }
        return;
      }
    } else if (dy < 0) {
      const ty = Math.floor(p.y + EPS);
      for (let tx = left; tx <= right; tx += 1) {
        if (isSolid(level, tx, ty)) { p.y = ty + 1; p.vy = 0; return; }
      }
    }
  }

  function updateEnemy(world, enemy, dt) {
    const { level } = world;
    if (enemy.asleep) return;
    if (enemy.type === 'bee') {
      const spec = ENEMY_SPECS.b;
      enemy.y = enemy.baseY + Math.sin((world.time * Math.PI * 2) / spec.period + enemy.phase) * spec.amplitude;
      return;
    }
    const spec = ENEMY_SPECS.w;
    enemy.x += enemy.dir * spec.speed * dt;
    const front = enemy.dir > 0 ? enemy.x + enemy.w : enemy.x;
    const tx = Math.floor(front + (enemy.dir > 0 ? -EPS : EPS));
    const row = Math.floor(enemy.y + enemy.h / 2);
    const below = Math.floor(enemy.y + enemy.h + 0.5);
    const blocked = isSolid(level, tx, row);
    const noFloor = !isSolid(level, tx, below) && tileAt(level, tx, below) !== ONE_WAY;
    if (blocked || noFloor) {
      enemy.x -= enemy.dir * spec.speed * dt;
      enemy.dir *= -1;
    }
  }

  function respawn(world) {
    const p = world.player;
    Object.assign(p, spawnPoint(world.level, world.checkpoint), {
      vx: 0,
      vy: 0,
      onGround: false,
      coyote: 0,
      buffer: 0,
      jumpHeld: false,
      invulnerable: PHYSICS.respawnInvulnerable,
      hearts: PHYSICS.hearts
    });
  }

  /**
   * Chạy một bước mô phỏng. `input`: { left, right, jump (đang giữ), jumpPressed (vừa nhấn) }.
   * Trả về danh sách sự kiện để giao diện phát âm thanh/thông báo: jump, spring, star, stomp,
   * hurt, fall, respawn, checkpoint, finish.
   */
  function step(world, input = {}, dt = DT) {
    const events = [];
    if (world.finished) return events;
    const p = world.player;
    const { level } = world;
    world.time += dt;
    p.invulnerable = Math.max(0, p.invulnerable - dt);

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) {
      p.vx += dir * (p.onGround ? PHYSICS.groundAccel : PHYSICS.airAccel) * dt;
      p.vx = Math.max(-PHYSICS.runSpeed, Math.min(PHYSICS.runSpeed, p.vx));
      p.facing = dir;
    } else {
      const slow = PHYSICS.friction * dt * (p.onGround ? 1 : 0.4);
      p.vx = Math.abs(p.vx) <= slow ? 0 : p.vx - Math.sign(p.vx) * slow;
    }

    p.buffer = input.jumpPressed ? PHYSICS.jumpBuffer : Math.max(0, p.buffer - dt);
    p.coyote = p.onGround ? PHYSICS.coyoteTime : Math.max(0, p.coyote - dt);
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -PHYSICS.jumpVelocity;
      p.buffer = 0;
      p.coyote = 0;
      p.onGround = false;
      p.jumpHeld = true;
      events.push({ type: 'jump' });
    }
    // Thả nút nhảy sớm thì nhảy thấp: bé tự điều chỉnh được độ cao.
    if (p.jumpHeld && !input.jump && p.vy < 0) {
      p.vy *= PHYSICS.jumpCut;
      p.jumpHeld = false;
    }
    if (p.vy >= 0) p.jumpHeld = false;
    p.vy = Math.min(PHYSICS.maxFall, p.vy + PHYSICS.gravity * dt);

    const previousBottom = p.y + p.h;
    moveX(world, p.vx * dt);
    moveY(world, p.vy * dt, events);

    for (const star of level.stars) {
      if (world.collected.has(star.id)) continue;
      if (overlaps(p, { x: star.x + 0.15, y: star.y + 0.15, w: 0.7, h: 0.7 })) {
        world.collected.add(star.id);
        events.push({ type: 'star', id: star.id });
      }
    }

    for (const checkpoint of level.checkpoints) {
      if (world.reached.has(checkpoint.id)) continue;
      if (overlaps(p, { x: checkpoint.x, y: checkpoint.y - 1, w: 1, h: 2 })) {
        world.reached.add(checkpoint.id);
        if (!world.checkpoint || checkpoint.x > world.checkpoint.x) world.checkpoint = checkpoint;
        events.push({ type: 'checkpoint', id: checkpoint.id });
      }
    }

    for (const enemy of world.enemies) {
      updateEnemy(world, enemy, dt);
      if (enemy.asleep || !overlaps(p, enemy)) continue;
      if (p.vy > 0 && previousBottom <= enemy.y + 0.3) {
        enemy.asleep = true;
        world.stomps += 1;
        p.vy = -PHYSICS.stompBounce;
        p.jumpHeld = Boolean(input.jump);
        events.push({ type: 'stomp', id: enemy.id, enemy: enemy.type });
      } else if (p.invulnerable <= 0) {
        p.hearts -= 1;
        world.hurts += 1;
        p.invulnerable = PHYSICS.hurtInvulnerable;
        const away = p.x + p.w / 2 < enemy.x + enemy.w / 2 ? -1 : 1;
        p.vx = away * 5;
        p.vy = -7;
        events.push({ type: 'hurt', hearts: p.hearts });
        if (p.hearts <= 0) {
          respawn(world);
          events.push({ type: 'respawn', reason: 'hearts' });
        }
      }
    }

    if (overlaps(p, { x: level.finish.x, y: level.finish.y - 1, w: 1, h: 2 })) {
      world.finished = true;
      p.vx = 0;
      events.push({ type: 'finish' });
    } else if (p.y > level.height + 1) {
      world.falls += 1;
      respawn(world);
      events.push({ type: 'fall' });
      events.push({ type: 'respawn', reason: 'fall' });
    }
    return events;
  }

  /** 1–3 sao theo tỉ lệ ngôi sao nhặt được; về tới nhà là ít nhất 1 sao. */
  function starRating(collected, total) {
    if (!total) return 3;
    const ratio = collected / total;
    if (ratio >= 0.9) return 3;
    if (ratio >= 0.5) return 2;
    return 1;
  }

  function snapshot(world) {
    return {
      checkpointId: world.checkpoint?.id || null,
      collected: [...world.collected],
      asleep: world.enemies.filter((enemy) => enemy.asleep).map((enemy) => enemy.id)
    };
  }

  const engine = Object.freeze({
    DT,
    PHYSICS,
    PLAYER_SIZE,
    parseLevel,
    tileAt,
    isSolid,
    createWorld,
    step,
    respawn,
    starRating,
    snapshot
  });

  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (!root || !root.document) return;
  root.BongAdventureEngine = engine;

  /* ---------- Giao diện ---------- */

  const document = root.document;
  const CONTENT_URL = './content/games/game15.json';
  const SAVE_KEY = 'bonghome_game15_adventure';
  const MAX_STEPS_PER_FRAME = 5;
  const THEMES = Object.freeze({
    garden: { skyTop: '#bfe6ff', skyBottom: '#fff4e6', hill: '#bfe8b4', hillFar: '#d9f2cf', grass: '#6cc56c', dirt: '#c98b5a', dirtDark: '#a96f45' },
    forest: { skyTop: '#a8dcc8', skyBottom: '#f0fbe9', hill: '#7cc48f', hillFar: '#a9dbb0', grass: '#4fa85d', dirt: '#9c6b43', dirtDark: '#7d5434' },
    sky: { skyTop: '#8ebef7', skyBottom: '#ffe9f3', hill: '#cfe0fb', hillFar: '#bcd3f5', grass: '#7fd17f', dirt: '#c98b5a', dirtDark: '#a96f45' }
  });

  const state = {
    levels: [],
    level: null,
    world: null,
    best: {},
    runId: '',
    startedAt: 0,
    tracked: false,
    paused: false,
    manualPause: false,
    running: false,
    lastFrame: 0,
    accumulator: 0,
    lastSave: 0,
    input: { left: false, right: false, jump: false, jumpPressed: false },
    reducedMotion: false
  };
  const els = {};
  const held = { keys: new Set(), pointers: new Map() };
  let audioContext = null;
  let frameHandle = 0;

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
      frequencies.forEach((frequency, index) => {
        const start = audioContext.currentTime + index * duration;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'triangle';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain).connect(audioContext.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      });
    } catch (error) { /* Âm thanh chỉ là phụ. */ }
  }

  function withRewards(action) {
    const ready = root.BongGame15RewardsReady;
    if (!ready || typeof ready.then !== 'function') return Promise.resolve(null);
    return ready
      .then((api) => (api ? action(api) : null))
      .catch((error) => {
        console.warn('[Bông Home] Không ghi được tiến độ/phần thưởng Game 15', error);
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
    const saved = {
      schemaVersion: 1,
      levelId: state.level.id,
      best: state.best,
      run: state.world && !state.world.finished ? {
        levelId: state.level.id,
        runId: state.runId,
        startedAt: state.startedAt,
        tracked: state.tracked,
        ...snapshot(state.world)
      } : null
    };
    try { root.localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); }
    catch (error) { /* Storage bị chặn: vẫn chơi được trong phiên hiện tại. */ }
  }

  function newRunId() {
    return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }

  function validBest(best) {
    const result = {};
    if (!best || typeof best !== 'object') return result;
    for (const level of state.levels) {
      const value = best[level.id];
      if (Number.isInteger(value) && value >= 1 && value <= 3) result[level.id] = value;
    }
    return result;
  }

  /* --- Bắt đầu / đổi màn --- */

  function startLevel(levelId, { fresh = true, saved = null } = {}) {
    const next = state.levels.find((level) => level.id === levelId) || state.levels[0];
    if (state.world && !state.world.finished && state.tracked && (fresh || next.id !== state.level?.id)) {
      withRewards((api) => api.abandon());
    }
    hideWin();
    state.level = next;
    const restore = !fresh && saved?.levelId === next.id ? saved : null;
    state.world = createWorld(next, restore);
    state.runId = restore?.runId || newRunId();
    state.startedAt = Number.isFinite(restore?.startedAt) ? restore.startedAt : Date.now();
    state.tracked = Boolean(restore?.tracked);
    state.accumulator = 0;
    clearInput();
    buildLevels();
    updateHud();
    persist();
    setPaused(false);
    announce(restore
      ? `Tiếp tục màn ${next.name}${state.world.checkpoint ? ' từ cờ lưu' : ''}.`
      : `Màn ${next.name}: đưa Bông về ngôi nhà ở cuối đường và nhặt thật nhiều ngôi sao nhé!`);
    render();
  }

  function buildLevels() {
    els.levels.replaceChildren(...state.levels.map((level) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'adv-level';
      button.dataset.level = level.id;
      const best = state.best[level.id];
      button.textContent = `${level.icon} ${level.name}${best ? ` ${'⭐'.repeat(best)}` : ''}`;
      const active = level.id === state.level.id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute('aria-label', `Màn ${level.name}${best ? `, đã đạt ${best} sao` : ''}`);
      button.addEventListener('click', () => {
        if (level.id !== state.level.id) startLevel(level.id);
      });
      return button;
    }));
  }

  function updateHud() {
    const world = state.world;
    const total = state.level.stars.length;
    els.hearts.textContent = `${'❤️'.repeat(Math.max(0, world.player.hearts))}${'🤍'.repeat(Math.max(0, PHYSICS.hearts - world.player.hearts))}`;
    els.hearts.setAttribute('aria-label', `Còn ${world.player.hearts} trái tim`);
    els.stars.textContent = `${world.collected.size}/${total}`;
  }

  /* --- Vòng lặp --- */

  function setPaused(paused, { manual = false } = {}) {
    state.paused = paused;
    if (manual || !paused) state.manualPause = paused && manual;
    els.pause.textContent = paused ? '▶️ Chơi tiếp' : '⏸️ Tạm dừng';
    els.pause.setAttribute('aria-pressed', paused ? 'true' : 'false');
    els.stage.classList.toggle('paused', paused);
    if (paused) clearInput();
    if (!paused) {
      state.lastFrame = 0;
      ensureLoop();
    }
    render();
  }

  function ensureLoop() {
    if (state.running) return;
    state.running = true;
    frameHandle = root.requestAnimationFrame(frame);
  }

  function frame(now) {
    state.running = false;
    if (state.paused || !state.world || state.world.finished) return;
    const elapsed = state.lastFrame ? Math.min(0.25, (now - state.lastFrame) / 1000) : DT;
    state.lastFrame = now;
    state.accumulator += elapsed;
    let steps = 0;
    while (state.accumulator >= DT && steps < MAX_STEPS_PER_FRAME) {
      runStep();
      state.accumulator -= DT;
      steps += 1;
      if (state.world.finished) break;
    }
    if (steps >= MAX_STEPS_PER_FRAME) state.accumulator = 0;
    render();
    if (!state.world.finished && !state.paused) {
      state.running = true;
      frameHandle = root.requestAnimationFrame(frame);
    }
  }

  function runStep(input = state.input) {
    const events = step(state.world, input);
    state.input.jumpPressed = false;
    if (events.length) handleEvents(events);
    return events;
  }

  function handleEvents(events) {
    let hudChanged = false;
    let save = false;
    for (const event of events) {
      switch (event.type) {
        case 'jump':
          playTone([520, 700], 0.06);
          trackStart();
          break;
        case 'spring':
          playTone([400, 600, 900], 0.06);
          break;
        case 'star':
          playTone([880, 1175], 0.07);
          hudChanged = true;
          save = true;
          trackStart();
          if (state.world.collected.size === state.level.stars.length) announce('Bông nhặt đủ tất cả ngôi sao rồi!');
          break;
        case 'stomp':
          playTone([300, 450], 0.08);
          announce(event.enemy === 'bee' ? 'Bé Ong ngủ quên rồi, Zzz…' : 'Bạn Sâu ngủ quên rồi, Zzz…');
          save = true;
          break;
        case 'hurt':
          playTone([300, 220], 0.1);
          hudChanged = true;
          if (event.hearts > 0) announce(`Ối, chạm phải bạn rồi! Còn ${event.hearts} trái tim.`);
          break;
        case 'fall':
          playTone([330, 262, 196], 0.1);
          break;
        case 'respawn':
          hudChanged = true;
          announce(`${event.reason === 'fall' ? 'Ối, rơi mất rồi!' : 'Hết tim rồi!'} Bông quay lại ${state.world.checkpoint ? 'cờ lưu gần nhất' : 'chỗ xuất phát'}, tim đầy trở lại.`);
          break;
        case 'checkpoint':
          playTone([660, 880, 990], 0.08);
          announce('Bông tới cờ lưu! Nếu rơi sẽ quay lại đây.');
          save = true;
          break;
        case 'finish':
          finishLevel();
          break;
        default:
          break;
      }
    }
    if (hudChanged) updateHud();
    if (save && !state.world.finished) persist();
  }

  /** Đánh dấu "đang chơi dở" cho Góc phụ huynh khi bé thật sự bắt đầu chơi. */
  function trackStart() {
    if (state.tracked) return;
    state.tracked = true;
    persist();
    withRewards((api) => api.trackProgress({ levelId: state.level.id }));
  }

  function finishLevel() {
    const world = state.world;
    const total = state.level.stars.length;
    const stars = starRating(world.collected.size, total);
    state.best[state.level.id] = Math.max(state.best[state.level.id] || 0, stars);
    persist();
    buildLevels();
    updateHud();
    clearInput();
    playTone([523, 659, 784, 1047], 0.13);

    const index = state.levels.indexOf(state.level);
    const next = state.levels[index + 1] || null;
    els.winStars.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    els.winTitle.textContent = 'Bông về tới nhà rồi!';
    els.winText.textContent = `Màn ${state.level.name}: nhặt được ${world.collected.size}/${total} ngôi sao${world.stomps ? `, ru ngủ ${world.stomps} bạn` : ''}.`;
    els.winNext.textContent = next ? `➡️ Màn tiếp: ${next.name}` : '🔁 Chơi lại từ màn đầu';
    els.winNext.dataset.next = next ? next.id : state.levels[0].id;
    els.win.hidden = false;
    announce(`${els.winTitle.textContent} ${els.winText.textContent}`);
    root.setTimeout(() => els.winNext.focus(), 30);

    if (els.winRewards) {
      els.winRewards.replaceChildren();
      els.winRewards.hidden = true;
    }
    const runId = state.runId;
    const levelId = state.level.id;
    withRewards((api) => {
      const detail = api.complete({
        levelId,
        runId,
        stars,
        starsCollected: world.collected.size,
        totalStars: total,
        durationSeconds: Math.max(0, Math.round((Date.now() - state.startedAt) / 1000))
      });
      if (!detail || detail.duplicate || state.runId !== runId) return detail;
      els.winRewards.replaceChildren(...api.rewardLines(detail).map((text, lineIndex) => {
        const line = document.createElement('p');
        line.className = lineIndex === 0 ? 'adv-reward-stars' : 'adv-reward-unlock';
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

  /* --- Điều khiển --- */

  function clearInput() {
    held.keys.clear();
    held.pointers.clear();
    syncInput();
    state.input.jumpPressed = false;
  }

  function syncInput() {
    const has = (name) => held.keys.has(name) || [...held.pointers.values()].includes(name);
    state.input.left = has('left');
    state.input.right = has('right');
    state.input.jump = has('jump');
    for (const button of els.pad?.querySelectorAll('[data-control]') || []) {
      button.classList.toggle('held', has(button.dataset.control));
    }
  }

  function press(control, pressed) {
    if (pressed && control === 'jump' && !state.input.jump) state.input.jumpPressed = true;
    syncInput();
    if (pressed && state.paused && !state.manualPause && els.win.hidden) setPaused(false);
  }

  const KEYS = Object.freeze({
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump'
  });

  function onKey(event, pressed) {
    if (!els.win.hidden) return;
    const control = KEYS[event.key];
    if (!control) {
      if (pressed && (event.key === 'p' || event.key === 'P')) setPaused(!state.paused, { manual: true });
      return;
    }
    // Phím Space/Enter trên nút vẫn bấm nút như bình thường; chỉ nhận điều khiển khi focus ở vùng chơi.
    const target = event.target;
    const onButton = target instanceof root.HTMLElement && target.matches('button, a') && !target.closest('#advPad');
    if (onButton && event.key === ' ') return;
    if (event.key.startsWith('Arrow') || event.key === ' ') event.preventDefault();
    if (pressed) {
      if (event.repeat && held.keys.has(control)) return;
      const wasHeld = held.keys.has(control) || [...held.pointers.values()].includes(control);
      held.keys.add(control);
      if (control === 'jump' && !wasHeld) state.input.jumpPressed = true;
      syncInput();
      if (state.paused && !state.manualPause) setPaused(false);
    } else {
      held.keys.delete(control);
      syncInput();
    }
  }

  function bindPad() {
    for (const button of els.pad.querySelectorAll('[data-control]')) {
      const control = button.dataset.control;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        // Giữ nút khi ngón tay trượt ra ngoài; trình duyệt không cho bắt con trỏ thì vẫn nhận lần bấm.
        try { button.setPointerCapture?.(event.pointerId); } catch (error) { /* bỏ qua */ }
        const wasHeld = state.input[control];
        held.pointers.set(event.pointerId, control);
        if (control === 'jump' && !wasHeld) state.input.jumpPressed = true;
        syncInput();
        if (state.paused && !state.manualPause && els.win.hidden) setPaused(false);
      });
      const release = (event) => {
        held.pointers.delete(event.pointerId);
        syncInput();
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
      // Bàn phím/trình đọc màn hình: Enter trên nút nhảy là nhảy một lần; nút đi giữ bằng phím mũi tên.
      button.addEventListener('click', (event) => {
        if (event.detail !== 0) return;
        if (control === 'jump') {
          state.input.jumpPressed = true;
          held.keys.add('jump');
          syncInput();
          root.setTimeout(() => { held.keys.delete('jump'); syncInput(); }, 220);
        }
      });
    }
  }

  /* --- Vẽ --- */

  function resizeCanvas() {
    const canvas = els.canvas;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(2, root.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawStar(ctx, cx, cy, outer, inner, fill) {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 ? inner : outer;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = Math.max(1, outer * 0.12);
    ctx.strokeStyle = '#e0a100';
    ctx.stroke();
  }

  function render() {
    const canvas = els.canvas;
    if (!canvas || !state.world) return;
    resizeCanvas();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { level, player: p } = state.world;
    const theme = THEMES[level.theme] || THEMES.garden;
    const ts = canvas.height / level.height;
    const viewW = canvas.width / ts;
    const camX = level.width <= viewW ? (level.width - viewW) / 2 : Math.max(0, Math.min(level.width - viewW, p.x + p.w / 2 - viewW * 0.4));
    const t = state.world.time;
    const sx = (x) => (x - camX) * ts;

    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Đồi/mây nền trôi chậm hơn (parallax) để tạo chiều sâu.
    for (const [speed, color, base, spacing, radius] of [[0.2, theme.hillFar, 8.6, 9, 4.2], [0.45, theme.hill, 9.6, 7, 3.2]]) {
      ctx.fillStyle = color;
      const offset = camX * speed;
      for (let i = Math.floor(offset / spacing) - 1; i < (offset + viewW) / spacing + 1; i += 1) {
        ctx.beginPath();
        ctx.arc((i * spacing - offset + 3) * ts, base * ts, radius * ts, Math.PI, 0);
        ctx.fill();
      }
    }

    const fromX = Math.max(0, Math.floor(camX));
    const toX = Math.min(level.width - 1, Math.ceil(camX + viewW));
    for (let ty = 0; ty < level.height; ty += 1) {
      for (let tx = fromX; tx <= toX; tx += 1) {
        const tile = level.tiles[ty][tx];
        if (tile === '.') continue;
        const x = sx(tx);
        const y = ty * ts;
        if (tile === '#') {
          ctx.fillStyle = theme.dirt;
          ctx.fillRect(x, y, ts + 1, ts + 1);
          ctx.fillStyle = theme.dirtDark;
          ctx.fillRect(x + ts * 0.2, y + ts * 0.55, ts * 0.14, ts * 0.14);
          ctx.fillRect(x + ts * 0.65, y + ts * 0.3, ts * 0.12, ts * 0.12);
          if (tileAt(level, tx, ty - 1) !== '#') {
            ctx.fillStyle = theme.grass;
            ctx.fillRect(x, y, ts + 1, ts * 0.28);
            ctx.beginPath();
            for (let k = 0; k < 4; k += 1) ctx.arc(x + ts * (0.125 + k * 0.25), y + ts * 0.28, ts * 0.125, 0, Math.PI);
            ctx.fill();
          }
        } else if (tile === '=') {
          ctx.fillStyle = '#d9a066';
          roundRect(ctx, x + 1, y + 1, ts - 2, ts - 2, ts * 0.15);
          ctx.fill();
          ctx.strokeStyle = '#a8703c';
          ctx.lineWidth = Math.max(1, ts * 0.07);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + ts * 0.15, y + ts * 0.5);
          ctx.lineTo(x + ts * 0.85, y + ts * 0.5);
          ctx.stroke();
        } else if (tile === '-') {
          ctx.fillStyle = '#ffffff';
          roundRect(ctx, x - 1, y + ts * 0.05, ts + 2, ts * 0.5, ts * 0.25);
          ctx.fill();
          ctx.strokeStyle = '#9db8e3';
          ctx.lineWidth = Math.max(1, ts * 0.05);
          ctx.stroke();
          ctx.fillStyle = '#e3eeff';
          ctx.fillRect(x, y + ts * 0.42, ts, ts * 0.1);
        } else if (tile === 'T') {
          ctx.strokeStyle = '#3f9a52';
          ctx.lineWidth = Math.max(2, ts * 0.1);
          ctx.beginPath();
          for (let k = 0; k <= 4; k += 1) ctx.lineTo(x + ts * (k % 2 ? 0.3 : 0.7), y + ts * (1 - k * 0.15));
          ctx.stroke();
          ctx.fillStyle = '#ff7fa8';
          ctx.beginPath();
          ctx.ellipse(x + ts / 2, y + ts * 0.3, ts * 0.46, ts * 0.22, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffd36b';
          ctx.beginPath();
          ctx.arc(x + ts / 2, y + ts * 0.28, ts * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (const checkpoint of level.checkpoints) {
      const x = sx(checkpoint.x);
      if (x < -ts || x > canvas.width + ts) continue;
      const reached = state.world.reached.has(checkpoint.id);
      const y = (checkpoint.y + 1) * ts;
      ctx.fillStyle = '#8a6f5a';
      ctx.fillRect(x + ts * 0.42, y - ts * 1.6, ts * 0.12, ts * 1.6);
      ctx.fillStyle = reached ? '#ff7fa8' : '#c9c1d1';
      ctx.beginPath();
      const top = y - ts * (reached ? 1.6 : 0.9);
      ctx.moveTo(x + ts * 0.54, top);
      ctx.lineTo(x + ts * 1.1, top + ts * 0.25);
      ctx.lineTo(x + ts * 0.54, top + ts * 0.5);
      ctx.fill();
    }

    {
      const { x: fx, y: fy } = level.finish;
      const x = sx(fx);
      const base = (fy + 1) * ts;
      ctx.fillStyle = '#fff3d6';
      ctx.fillRect(x - ts * 0.3, base - ts * 1.3, ts * 1.6, ts * 1.3);
      ctx.fillStyle = '#e8728f';
      ctx.beginPath();
      ctx.moveTo(x - ts * 0.55, base - ts * 1.25);
      ctx.lineTo(x + ts * 0.5, base - ts * 2.2);
      ctx.lineTo(x + ts * 1.55, base - ts * 1.25);
      ctx.fill();
      ctx.fillStyle = '#a8703c';
      roundRect(ctx, x + ts * 0.25, base - ts * 0.8, ts * 0.5, ts * 0.8, ts * 0.12);
      ctx.fill();
      ctx.fillStyle = '#8fd0ff';
      ctx.fillRect(x - ts * 0.15, base - ts * 1.05, ts * 0.32, ts * 0.32);
    }

    for (const star of level.stars) {
      if (state.world.collected.has(star.id)) continue;
      const x = sx(star.x + 0.5);
      if (x < -ts || x > canvas.width + ts) continue;
      const bob = state.reducedMotion ? 0 : Math.sin(t * 3 + star.x) * 0.06;
      drawStar(ctx, x, (star.y + 0.5 + bob) * ts, ts * 0.36, ts * 0.16, '#ffd84d');
    }

    for (const enemy of state.world.enemies) {
      const x = sx(enemy.x);
      if (x < -ts * 2 || x > canvas.width + ts) continue;
      const y = enemy.y * ts;
      const w = enemy.w * ts;
      const h = enemy.h * ts;
      ctx.globalAlpha = enemy.asleep ? 0.55 : 1;
      if (enemy.type === 'caterpillar') {
        for (let k = 0; k < 3; k += 1) {
          ctx.fillStyle = k === (enemy.dir > 0 ? 2 : 0) ? '#7fcf5f' : '#a5e07f';
          ctx.beginPath();
          ctx.arc(x + w * (0.18 + k * 0.32), y + h * 0.55, h * 0.48, 0, Math.PI * 2);
          ctx.fill();
        }
        const headX = x + w * (enemy.dir > 0 ? 0.82 : 0.18);
        ctx.fillStyle = '#2f3b2f';
        ctx.beginPath();
        if (enemy.asleep) ctx.fillRect(headX - h * 0.18, y + h * 0.45, h * 0.36, h * 0.07);
        else ctx.arc(headX + enemy.dir * h * 0.12, y + h * 0.45, h * 0.09, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const flap = state.reducedMotion || enemy.asleep ? 0 : Math.sin(t * 30) * 0.08;
        ctx.beginPath();
        ctx.ellipse(x + w * 0.4, y + h * (0.05 - flap), w * 0.22, h * 0.3, -0.4, 0, Math.PI * 2);
        ctx.ellipse(x + w * 0.65, y + h * (0.05 - flap), w * 0.22, h * 0.3, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffcf3f';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.5, h * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(x + w * 0.38, y + h * 0.18, w * 0.1, h * 0.75);
        ctx.fillRect(x + w * 0.6, y + h * 0.18, w * 0.1, h * 0.75);
      }
      if (enemy.asleep) {
        ctx.fillStyle = '#6b4e71';
        ctx.font = `bold ${Math.round(ts * 0.4)}px sans-serif`;
        ctx.fillText('z', x + w * 0.8, y - h * 0.2);
      }
      ctx.globalAlpha = 1;
    }

    drawPlayer(ctx, sx(p.x), p.y * ts, ts, p);

    if (state.paused && els.win.hidden) {
      ctx.fillStyle = 'rgba(107, 78, 113, 0.35)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = `900 ${Math.round(ts * 0.9)}px sans-serif`;
      ctx.fillText('Tạm dừng', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'start';
    }
  }

  /** Bông: bé gái tóc hai búi, váy hồng. Nhấp nháy khi đang được bảo vệ sau khi chạm bạn. */
  function drawPlayer(ctx, x, y, ts, p) {
    if (p.invulnerable > 0 && !state.reducedMotion && Math.floor(p.invulnerable * 12) % 2) return;
    const w = p.w * ts;
    const h = p.h * ts;
    const cx = x + w / 2;
    const headR = w * 0.36;
    const headY = y + headR;
    const walking = p.onGround && Math.abs(p.vx) > 0.5 && !state.reducedMotion;
    const swing = walking ? Math.sin(state.world.time * 18) * w * 0.12 : 0;

    ctx.fillStyle = '#6b4e71';
    ctx.fillRect(cx - w * 0.2 + swing, y + h * 0.8, w * 0.14, h * 0.2);
    ctx.fillRect(cx + w * 0.06 - swing, y + h * 0.8, w * 0.14, h * 0.2);

    ctx.fillStyle = '#ff8fb1';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.18, headY + headR * 0.7);
    ctx.lineTo(cx + w * 0.18, headY + headR * 0.7);
    ctx.lineTo(cx + w * 0.42, y + h * 0.84);
    ctx.lineTo(cx - w * 0.42, y + h * 0.84);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#5a3b2e';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * headR * 0.9, headY - headR * 0.75, headR * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe0c7';
    ctx.beginPath();
    ctx.arc(cx, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3b2e';
    ctx.beginPath();
    ctx.arc(cx, headY - headR * 0.15, headR, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();

    const look = p.facing * headR * 0.25;
    ctx.fillStyle = '#2f2430';
    ctx.beginPath();
    ctx.arc(cx - headR * 0.32 + look, headY + headR * 0.1, headR * 0.11, 0, Math.PI * 2);
    ctx.arc(cx + headR * 0.32 + look, headY + headR * 0.1, headR * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 120, 150, 0.5)';
    ctx.beginPath();
    ctx.arc(cx - headR * 0.55 + look, headY + headR * 0.4, headR * 0.14, 0, Math.PI * 2);
    ctx.arc(cx + headR * 0.55 + look, headY + headR * 0.4, headR * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  /* --- Khởi động --- */

  function init(content) {
    const parsed = [];
    for (const def of Array.isArray(content?.levels) ? content.levels : []) {
      try { parsed.push(parseLevel(def)); }
      catch (error) { console.warn('[Bông Home] Bỏ qua màn hỏng của Game 15', error); }
    }
    if (!parsed.length) {
      announce('Chưa tải được bản đồ. Bé kiểm tra mạng rồi tải lại trang nhé.');
      return;
    }
    state.levels = parsed;
    const saved = readSaved();
    state.best = validBest(saved?.best);
    const levelId = parsed.some((level) => level.id === saved?.levelId) ? saved.levelId : (content.defaultLevelId || parsed[0].id);
    startLevel(levelId, { fresh: false, saved: saved?.run });

    root.BongGame15 = Object.freeze({
      getState: () => {
        const world = state.world;
        return {
          levelId: state.level.id,
          levels: state.levels.map((level) => level.id),
          runId: state.runId,
          paused: state.paused,
          finished: world.finished,
          player: { x: world.player.x, y: world.player.y, vx: world.player.vx, vy: world.player.vy, onGround: world.player.onGround, hearts: world.player.hearts },
          collected: [...world.collected],
          totalStars: state.level.stars.length,
          checkpointId: world.checkpoint?.id || null,
          asleep: world.enemies.filter((enemy) => enemy.asleep).map((enemy) => enemy.id),
          best: { ...state.best }
        };
      },
      startLevel: (levelId) => startLevel(levelId),
      pause: () => setPaused(true, { manual: true }),
      resume: () => setPaused(false),
      /** Chạy `count` bước mô phỏng ngay lập tức (dùng cho test tự động; vòng lặp thường vẫn chạy song song). */
      stepFrames: (count, input = {}) => {
        const events = [];
        for (let index = 0; index < count && !state.world.finished; index += 1) {
          events.push(...runStep({ left: false, right: false, jump: false, jumpPressed: false, ...input, jumpPressed: index === 0 && Boolean(input.jumpPressed) }));
        }
        render();
        return events.map((event) => event.type);
      },
      /** Đặt Bông tới một ô (test tự động). */
      debugPlace: (x, y) => {
        Object.assign(state.world.player, { x: x + (1 - PLAYER_SIZE.w) / 2, y: y + 1 - PLAYER_SIZE.h, vx: 0, vy: 0 });
        render();
      }
    });
  }

  function boot() {
    Object.assign(els, {
      stage: document.getElementById('advStage'),
      canvas: document.getElementById('advCanvas'),
      levels: document.getElementById('advLevels'),
      hearts: document.getElementById('advHearts'),
      stars: document.getElementById('advStars'),
      pause: document.getElementById('advPause'),
      restart: document.getElementById('advRestart'),
      pad: document.getElementById('advPad'),
      status: document.getElementById('advStatus'),
      win: document.getElementById('advWin'),
      winStars: document.getElementById('advWinStars'),
      winTitle: document.getElementById('advWinTitle'),
      winText: document.getElementById('advWinText'),
      winRewards: document.getElementById('advWinRewards'),
      winNext: document.getElementById('advWinNext'),
      winAgain: document.getElementById('advWinAgain')
    });
    if (!els.canvas) return;

    try { state.reducedMotion = Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches); }
    catch (error) { state.reducedMotion = false; }

    bindPad();
    document.addEventListener('keydown', (event) => onKey(event, true));
    document.addEventListener('keyup', (event) => onKey(event, false));
    root.addEventListener('blur', () => clearInput());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.world && !state.world.finished) {
        persist();
        setPaused(true, { manual: true });
      }
    });
    root.addEventListener('pagehide', () => { if (state.world && !state.world.finished) persist(); });
    root.addEventListener('resize', () => render());
    els.pause.addEventListener('click', () => {
      if (state.world?.finished) return;
      setPaused(!state.paused, { manual: true });
    });
    els.restart.addEventListener('click', () => startLevel(state.level.id));
    els.winNext.addEventListener('click', () => startLevel(els.winNext.dataset.next));
    els.winAgain.addEventListener('click', () => startLevel(state.level.id));
    els.win.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideWin();
    });

    fetch(CONTENT_URL, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .catch((error) => {
        console.warn('[Bông Home] Không tải được bản đồ Game 15', error);
        return null;
      })
      .then(init);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof window !== 'undefined' ? window : null);
