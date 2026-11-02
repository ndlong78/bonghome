const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const engine = require('../js/game15-adventure.js');
const content = JSON.parse(read('content/games/game15.json'));
const sw = read('sw.js');
const redirects = read('_redirects');
const levels = content.levels.map((def) => engine.parseLevel(def));

/** Bản đồ thử nghiệm: hàng 10–11 là đất, `extra` vẽ đè lên các hàng phía trên. */
function testLevel(extra = {}, width = 40) {
  const rows = Array.from({ length: 12 }, (_, y) => (y >= 10 ? '#'.repeat(width) : '.'.repeat(width)).split(''));
  rows[9][2] = 'S';
  rows[9][width - 2] = 'F';
  for (const [key, ch] of Object.entries(extra)) {
    const [x, y] = key.split(',').map(Number);
    rows[y][x] = ch;
  }
  return engine.parseLevel({ id: 'thu', rows: rows.map((row) => row.join('')) });
}

function settle(world, frames = 30) {
  for (let i = 0; i < frames; i += 1) engine.step(world, {});
}

function run(world, input, frames) {
  const events = [];
  for (let i = 0; i < frames; i += 1) events.push(...engine.step(world, { ...input, jumpPressed: i === 0 && Boolean(input.jumpPressed) }));
  return events.map((event) => event.type);
}

autoTest('nội dung Game 15: 3 màn hợp lệ, có xuất phát, nhà, cờ lưu và đủ sao', () => {
  assert.equal(content.schemaVersion, 1);
  assert.deepEqual(levels.map((level) => level.id), ['vuon-hoa', 'rung-xanh', 'troi-may']);
  assert.ok(levels.some((level) => level.id === content.defaultLevelId));
  for (const level of levels) {
    assert.equal(level.height, 12, level.id);
    assert.ok(level.width >= 60, `${level.id} đủ dài`);
    assert.ok(level.stars.length >= 15, `${level.id} có ít nhất 15 ngôi sao`);
    assert.ok(level.checkpoints.length >= 1, `${level.id} có cờ lưu`);
    assert.ok(level.finish.x > level.width - 6, `${level.id}: nhà ở cuối đường`);
  }
  assert.ok(levels[0].enemies.every((enemy) => enemy.type === 'caterpillar'), 'màn đầu chỉ có sâu chậm');
  assert.ok(levels.slice(1).every((level) => level.enemies.some((enemy) => enemy.type === 'bee')));
});

autoTest('parseLevel từ chối bản đồ hỏng', () => {
  assert.throws(() => engine.parseLevel({ id: 'x', rows: ['...'] }), /6 hàng/);
  const ok = Array.from({ length: 6 }, () => '..........');
  assert.throws(() => engine.parseLevel({ id: 'x', rows: [...ok.slice(0, 5), '.........'] }), /dài bằng nhau/);
  assert.throws(() => engine.parseLevel({ id: 'x', rows: [...ok.slice(0, 5), 'S.......F?'] }), /ký tự lạ/);
  assert.throws(() => engine.parseLevel({ id: 'x', rows: [...ok.slice(0, 5), 'S.........'] }), /thiếu/);
  assert.throws(() => engine.parseLevel({ id: 'x', rows: [...ok.slice(0, 5), 'S..S.....F'] }), /một chỗ xuất phát/);
});

autoTest('Bông đứng trên đất, không đi xuyên tường, mép trái bản đồ là tường', () => {
  const level = testLevel({ '8,9': '#', '8,8': '#' });
  const world = engine.createWorld(level);
  settle(world);
  assert.equal(world.player.onGround, true);
  assert.ok(Math.abs(world.player.y + world.player.h - 10) < 1e-6);
  run(world, { right: true }, 120);
  assert.ok(world.player.x + world.player.w <= 8 + 1e-6, 'bị tường chặn');
  run(world, { left: true }, 240);
  assert.ok(world.player.x >= 0, 'không đi ra khỏi mép trái');
});

autoTest('nhảy: giữ lâu cao hơn 3,5 ô, chạm nhẹ thì thấp; chạy-nhảy xa hơn 5 ô', () => {
  const level = testLevel();
  const high = engine.createWorld(level);
  settle(high);
  const ground = high.player.y;
  let apex = ground;
  const first = engine.step(high, { jump: true, jumpPressed: true });
  assert.deepEqual(first.map((event) => event.type), ['jump']);
  for (let i = 0; i < 90; i += 1) { engine.step(high, { jump: true }); apex = Math.min(apex, high.player.y); }
  assert.ok(ground - apex > 3.5, `cao ${ground - apex}`);

  const low = engine.createWorld(level);
  settle(low);
  let lowApex = ground;
  engine.step(low, { jump: true, jumpPressed: true });
  for (let i = 0; i < 90; i += 1) { engine.step(low, {}); lowApex = Math.min(lowApex, low.player.y); }
  assert.ok(ground - lowApex < 1.5, 'thả nút sớm nhảy thấp');

  const far = engine.createWorld(level);
  settle(far);
  run(far, { right: true }, 60);
  const startX = far.player.x;
  engine.step(far, { right: true, jump: true, jumpPressed: true });
  let frames = 0;
  while (!far.player.onGround && frames < 200) { engine.step(far, { right: true, jump: true }); frames += 1; }
  assert.ok(far.player.x - startX > 5, `xa ${far.player.x - startX}`);
});

autoTest('nhấn nhảy sớm một chút trước khi chạm đất vẫn nhảy được (đệm nút nhảy)', () => {
  const world = engine.createWorld(testLevel());
  settle(world);
  engine.step(world, { jump: true, jumpPressed: true });
  while (world.player.vy < 0) engine.step(world, { jump: true });
  while (world.player.y + world.player.h < 9.85) engine.step(world, {});
  const events = run(world, { jump: true, jumpPressed: true }, 12);
  assert.ok(events.includes('jump'));
});

autoTest('mây chỉ đứng được từ phía trên; lò xo hoa bật cao', () => {
  const level = testLevel({ '3,7': '-', '2,7': '-', '1,7': '-', '6,9': 'T' });
  const world = engine.createWorld(level);
  settle(world);
  engine.step(world, { jump: true, jumpPressed: true });
  let landed = false;
  for (let i = 0; i < 90; i += 1) { engine.step(world, { jump: true }); if (world.player.onGround && world.player.y < 7) landed = true; }
  assert.ok(landed, 'nhảy xuyên mây từ dưới lên rồi đứng trên mây');
  assert.ok(Math.abs(world.player.y + world.player.h - 7) < 1e-6);

  const spring = engine.createWorld(level);
  settle(spring);
  spring.player.x = 6.15;
  spring.player.y = 6;
  let events = [];
  let apex = 99;
  for (let i = 0; i < 90; i += 1) { events = events.concat(engine.step(spring, {}).map((event) => event.type)); apex = Math.min(apex, spring.player.y); }
  assert.ok(events.includes('spring'));
  assert.ok(9 - apex > 5.5, `lò xo bật ${9 - apex} ô`);
});

autoTest('nhặt sao một lần; nhảy lên lưng sâu thì sâu ngủ và Bông bật lên; chạm ngang thì mất tim', () => {
  const level = testLevel({ '6,9': '*', '12,9': 'w' });
  const world = engine.createWorld(level);
  settle(world);
  const events = run(world, { right: true }, 60);
  assert.equal(events.filter((type) => type === 'star').length, 1);
  assert.deepEqual([...world.collected], ['s6-9']);

  const stomp = engine.createWorld(level);
  const caterpillar = stomp.enemies[0];
  stomp.player.x = caterpillar.x + 0.1;
  stomp.player.y = caterpillar.y - 2;
  const stompEvents = run(stomp, {}, 40);
  assert.ok(stompEvents.includes('stomp'));
  assert.equal(caterpillar.asleep, true);
  assert.equal(stomp.player.hearts, 3);

  const hurt = engine.createWorld(level);
  settle(hurt);
  hurt.enemies[0].x = hurt.player.x + 0.5;
  const hurtEvents = run(hurt, {}, 2);
  assert.ok(hurtEvents.includes('hurt'));
  assert.equal(hurt.player.hearts, 2);
  // Được bảo vệ một lúc sau khi chạm, không mất tim liên tục.
  hurt.enemies[0].x = hurt.player.x;
  run(hurt, {}, 30);
  assert.equal(hurt.player.hearts, 2);
});

autoTest('hết tim hoặc rơi xuống vực thì quay lại cờ lưu với tim đầy, sao đã nhặt vẫn giữ', () => {
  const rows = Array.from({ length: 12 }, () => '.'.repeat(30).split(''));
  for (let x = 0; x < 30; x += 1) if (x < 10 || x > 13) { rows[10][x] = '#'; rows[11][x] = '#'; }
  rows[9][2] = 'S';
  rows[9][6] = 'C';
  rows[9][5] = '*';
  rows[9][27] = 'F';
  const level = engine.parseLevel({ id: 'vuc', rows: rows.map((row) => row.join('')) });
  const world = engine.createWorld(level);
  settle(world);
  const reach = [];
  for (let i = 0; i < 300 && !reach.includes('fall'); i += 1) reach.push(...engine.step(world, { right: true }).map((event) => event.type));
  assert.ok(reach.includes('checkpoint'));
  assert.ok(reach.includes('fall'));
  assert.equal(world.checkpoint.id, 'c6-9');
  assert.ok(Math.abs(world.player.x - 6.15) < 0.5, 'quay lại cờ lưu');
  assert.equal(world.player.hearts, 3);
  assert.deepEqual([...world.collected], ['s5-9']);

  world.player.hearts = 1;
  world.player.invulnerable = 0;
  world.enemies.push({ id: 'w0', type: 'caterpillar', w: 0.9, h: 0.5, x: world.player.x + 0.3, y: 9.5, baseY: 9.5, dir: 1, phase: 0, asleep: false });
  const again = run(world, {}, 2);
  assert.ok(again.includes('respawn'));
  assert.equal(world.player.hearts, 3);
});

autoTest('về tới nhà thì kết thúc; snapshot/createWorld khôi phục cờ lưu, sao và bạn đã ngủ', () => {
  const level = levels[0];
  const world = engine.createWorld(level);
  world.player.x = level.finish.x - 1;
  world.player.y = level.finish.y + 0.1;
  const events = run(world, { right: true }, 60);
  assert.ok(events.includes('finish'));
  assert.equal(world.finished, true);
  assert.deepEqual(engine.step(world, { right: true }), []);

  const saved = { checkpointId: level.checkpoints[0].id, collected: [level.stars[0].id, 'khong-co'], asleep: [level.enemies[0].id] };
  const restored = engine.createWorld(level, saved);
  assert.equal(restored.checkpoint.id, level.checkpoints[0].id);
  assert.deepEqual([...restored.collected], [level.stars[0].id]);
  assert.equal(restored.enemies[0].asleep, true);
  assert.ok(Math.abs(restored.player.x - (level.checkpoints[0].x + 0.15)) < 1e-9);
  assert.deepEqual(engine.snapshot(restored), { checkpointId: saved.checkpointId, collected: [level.stars[0].id], asleep: [level.enemies[0].id] });
});

autoTest('xếp sao: ≥90% được 3 sao, ≥50% được 2 sao, về nhà là ít nhất 1 sao', () => {
  assert.equal(engine.starRating(20, 20), 3);
  assert.equal(engine.starRating(18, 20), 3);
  assert.equal(engine.starRating(10, 20), 2);
  assert.equal(engine.starRating(0, 20), 1);
  assert.equal(engine.starRating(0, 0), 3);
});

/**
 * Kiểm tra mọi màn đều chơi được: tìm đường (BFS) giữa các ô Bông đứng được, với giới hạn bước
 * thấp hơn khả năng nhảy thật (đã đo ở test trên: cao > 3,5 ô, xa > 5 ô).
 */
autoTest('mọi màn đều đi được tới nhà, mọi cờ lưu và ngôi sao đều với tới được', () => {
  for (const level of levels) {
    const standable = (x, y) => {
      const below = engine.tileAt(level, x, y + 1);
      return x >= 0 && x < level.width && y >= 0 && y < level.height - 1
        && !engine.isSolid(level, x, y)
        && (engine.isSolid(level, x, y + 1) || below === '-');
    };
    const key = (x, y) => `${x},${y}`;
    const start = level.start;
    assert.ok(standable(start.x, start.y), `${level.id}: chỗ xuất phát phải đứng được`);
    const seen = new Set([key(start.x, start.y)]);
    const queue = [[start.x, start.y]];
    while (queue.length) {
      const [x, y] = queue.shift();
      const spring = engine.tileAt(level, x, y + 1) === 'T';
      const maxUp = spring ? 6 : 3;
      const maxDx = spring ? 5 : 4;
      for (let nx = x - 6; nx <= x + 6; nx += 1) {
        for (let ny = 0; ny < level.height; ny += 1) {
          if (seen.has(key(nx, ny)) || !standable(nx, ny)) continue;
          const up = y - ny;
          const dx = Math.abs(nx - x);
          const ok = up >= 0 ? (up <= maxUp && dx <= maxDx) : dx <= Math.min(6, maxDx + Math.ceil(-up / 2));
          if (!ok) continue;
          seen.add(key(nx, ny));
          queue.push([nx, ny]);
        }
      }
    }
    const reachable = [...seen].map((item) => item.split(',').map(Number));
    const canReach = (tx, ty, reach = 3) => reachable.some(([x, y]) => {
      const spring = engine.tileAt(level, x, y + 1) === 'T';
      const up = y - ty;
      return Math.abs(x - tx) <= (spring ? 3 : 2) && up >= 0 && up <= (spring ? 6 : reach);
    });
    assert.ok(seen.has(key(level.finish.x, level.finish.y)), `${level.id}: phải tới được nhà`);
    for (const checkpoint of level.checkpoints) assert.ok(seen.has(key(checkpoint.x, checkpoint.y)), `${level.id}: cờ ${checkpoint.id}`);
    for (const star of level.stars) assert.ok(canReach(star.x, star.y), `${level.id}: sao ${star.id}`);
  }
});

/**
 * Bot chơi thử bằng đúng engine vật lý: tìm theo chiều rộng qua các "đoạn bấm nút" (chạy, nhảy giữ lâu/ngắn,
 * lái trên không). Bỏ các bạn Sâu/Ong để chỉ kiểm tra địa hình. Chứng minh mỗi màn về được tới nhà
 * và mọi ngôi sao đều nhặt được với cách bấm mà bé làm được.
 */
autoTest('bot chơi thử bằng vật lý thật: mọi màn về được tới nhà và nhặt được mọi ngôi sao', () => {
  const clone = (world) => ({ ...world, player: { ...world.player }, collected: new Set(world.collected), reached: new Set(world.reached), enemies: [] });
  const macros = [];
  for (const dir of [1, -1]) {
    macros.push({ jump: false, frames: 12, input: () => ({ right: dir > 0, left: dir < 0 }) });
    for (const hold of [4, 10, 18, 30]) {
      for (const steer of [12, 24, 60]) {
        macros.push({ jump: true, frames: 90, input: (i) => ({ right: dir > 0 && i < steer, left: dir < 0 && i < steer, jump: i < hold, jumpPressed: i === 0 }) });
      }
    }
  }
  macros.push({ jump: true, frames: 90, input: (i) => ({ jump: i < 30, jumpPressed: i === 0 }) });

  for (const level of levels) {
    const first = engine.createWorld(level);
    first.enemies = [];
    settle(first);
    const seen = new Set();
    const queue = [first];
    const stars = new Set();
    let finished = false;
    for (let nodes = 0; queue.length && nodes < 5000; nodes += 1) {
      const world = queue.shift();
      for (const macro of macros) {
        const next = clone(world);
        let fell = false;
        for (let i = 0; i < macro.frames && !next.finished; i += 1) {
          if (engine.step(next, macro.input(i)).some((event) => event.type === 'fall')) { fell = true; break; }
          if (macro.jump && i > 3 && next.player.onGround) break;
        }
        if (fell) continue;
        next.collected.forEach((id) => stars.add(id));
        if (next.finished) { finished = true; continue; }
        if (!next.player.onGround) continue;
        const key = `${Math.round(next.player.x * 2)},${Math.round(next.player.y)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push(next);
      }
    }
    assert.ok(finished, `${level.id}: bot phải về được tới nhà`);
    assert.deepEqual(level.stars.filter((star) => !stars.has(star.id)).map((star) => star.id), [], `${level.id}: sao không nhặt được`);
  }
});

autoTest('vòng mô phỏng đủ nhanh: 3 màn × 60 giây chạy dưới 1,5 giây', () => {
  const started = Date.now();
  for (const level of levels) {
    const world = engine.createWorld(level);
    for (let i = 0; i < 3600; i += 1) engine.step(world, { right: true, jump: i % 50 < 30, jumpPressed: i % 50 === 0 });
  }
  assert.ok(Date.now() - started < 1500);
});

// Canvas, nút cảm ứng, hộp thoại thắng là modal có tên, không đếm ngược: e2e/page-structure.spec.js và
// e2e/game15-adventure.spec.js. Giảm chuyển động, focus ring, vùng chạm: các E2E dùng chung.
autoTest('PWA precache, route và thẻ trang chủ có Game 15', () => {
  for (const asset of [
    './game15.html',
    './js/game15-adventure.js',
    './js/game15-rewards.js',
    './css/game15-adventure.css',
    './content/games/game15.json',
    './js/game15-home-card.js'
  ]) {
    assert.ok(sw.includes(`"${asset}"`), `Service Worker cần precache ${asset}`);
  }
  assert.match(redirects, /\/game15 \/game15\.html 301/);
  assert.match(redirects, /\/game15\/ \/game15\.html 301/);
});

function autoTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}
