'use strict';

/*
 * Hành vi của ba adapter autosave dùng chung (games2-4, games5-7, games8-10), chạy thật trong sandbox:
 * nhận đúng trang, khôi phục bản lưu, lưu định kỳ/khi rời trang, ghi hoàn thành khi màn thắng hiện,
 * đổi phiên khi bấm ván mới. Thay cho các kiểm tra so chuỗi mã nguồn trước đây.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { runBrowserModule, createFakeProgress, createFakeGame, root } = require('./helpers/browser-sandbox');

const routes = require(path.join(root, 'js', 'routes.js'));

const GROUPS = [
  {
    file: 'js/games2-4-autosave.js',
    games: { game2: '5-differences', game3: '6-shapes', game4: '12-objects' },
    newGameButtons: ['nutVanMoi', 'nutChoiLai'],
    exposed: 'BongGamesAutosave'
  },
  {
    file: 'js/games5-7-autosave.js',
    games: { game5: 'connect-the-dots', game6: '5-rounds', game7: '8-patterns' },
    newGameButtons: ['nutHinhMoi', 'nutVanMoi', 'nutChoiLai'],
    exposed: 'BongGames57Autosave'
  },
  {
    file: 'js/games8-10-autosave.js',
    // Game 8 lấy mức độ từ engine (kích thước mê cung); game 9/10 có mức cố định.
    games: { game8: 'easy', game9: 'keyword-story', game10: '24-stars' },
    newGameButtons: ['nutVanMoi', 'nutChoiLai', 'nutBatDau', 'mucDo'],
    exposed: 'BongGames810Autosave'
  }
];

const ALL_GAMES = GROUPS.flatMap((group) => Object.keys(group.games));
const SAVE_INTERVAL_MS = 2000;

/** Dựng trang game `gameId` với API BongGameN giả rồi chạy adapter của nhóm. */
async function start(group, gameId, { pathname = `/${gameId}.html`, sharedRoutes = routes, saved = null, game = createFakeGame() } = {}) {
  const progress = createFakeProgress(saved);
  let winDialog;
  const buttons = {};
  const sandbox = await runBrowserModule(group.file, {
    pathname,
    routes: sharedRoutes,
    modules: { progress },
    setup({ window, addElement }) {
      window[`BongGame${gameId.slice(4)}`] = game;
      winDialog = addElement('manThang');
      group.newGameButtons.forEach((id) => { buttons[id] = addElement(id, 'button'); });
    }
  });
  const status = () => sandbox.document.getElementById('bhGameAutosaveStatus');
  return { ...sandbox, progress, game, winDialog, buttons, status };
}

(async () => {
  for (const group of GROUPS) {
    const ownGames = Object.keys(group.games);

    // Nhận đúng trang của nhóm (qua js/routes.js và qua regex dự phòng, kể cả URL không đuôi), bỏ qua trang khác.
    for (const gameId of ALL_GAMES) {
      // null: js/routes.js chưa tải xong, adapter phải dùng regex dự phòng (undefined sẽ rơi về tham số mặc định).
      for (const sharedRoutes of [routes, null]) {
        for (const pathname of [`/${gameId}.html`, `/${gameId}`, `/${gameId}/`, `/bonghome/${gameId}.html`]) {
          const { progress, errors } = await start(group, gameId, { pathname, sharedRoutes });
          const expected = ownGames.includes(gameId) ? 1 : 0;
          assert.equal(progress.calls.load.length, expected, `${group.file} ${pathname} (routes: ${Boolean(sharedRoutes)})`);
          assert.deepEqual(errors, []);
        }
      }
    }

    for (const gameId of ownGames) {
      const label = `${group.file} ${gameId}`;
      const difficulty = group.games[gameId];

      // Khôi phục: gọi BongGameN.restore với state đã lưu, báo cho bé, giữ sessionId cũ cho lượt hoàn thành.
      {
        const saved = { state: { sessionId: `${gameId}-old-session`, any: 1 }, startedAt: '2026-10-01T00:00:00.000Z' };
        const page = await start(group, gameId, { saved });
        assert.deepEqual(page.game.calls.restore, [saved.state], label);
        assert.match(page.status().textContent, /Đã khôi phục/, label);
        assert.equal(page.status().getAttribute('role'), 'status');
        assert.equal(page.status().getAttribute('aria-live'), 'polite');
        assert.equal(page.status().getAttribute('aria-atomic'), 'true');
        assert.ok(page.document.body.children.includes(page.status()), `${label}: thông báo nằm trong trang`);

        page.clock.tick(SAVE_INTERVAL_MS);
        assert.equal(page.progress.calls.save.length, 1, `${label}: lưu sau mỗi ${SAVE_INTERVAL_MS} ms`);
        assert.deepEqual(page.progress.calls.save[0], {
          gameId,
          record: {
            status: 'in_progress',
            difficulty,
            state: { sessionId: `${gameId}-old-session`, marker: 'snapshot' },
            startedAt: saved.startedAt
          }
        }, label);

        page.winDialog.classList.add('hien');
        assert.equal(page.progress.calls.complete.length, 1, `${label}: ghi hoàn thành khi màn thắng hiện`);
        assert.deepEqual(page.progress.calls.complete[0].result, {
          transactionId: `${gameId}-finish-${gameId}-old-session`,
          difficulty,
          durationSeconds: 42,
          moves: 3,
          metadata: page.progress.calls.complete[0].result.metadata
        }, label);
        assert.match(page.status().textContent, /Đã lưu lượt hoàn thành/, label);
        page.clock.tick(SAVE_INTERVAL_MS * 3);
        assert.equal(page.progress.calls.save.length, 1, `${label}: ngừng lưu sau khi thắng`);
        assert.deepEqual(page.errors, [], label);
      }

      // Bản lưu không khôi phục được: không báo khôi phục, lưu ván mới với startedAt mới.
      {
        const page = await start(group, gameId, { saved: { state: { bad: true } }, game: createFakeGame({ restoreOk: false }) });
        assert.equal(page.status(), null, label);
        page.clock.tick(SAVE_INTERVAL_MS);
        assert.equal(page.progress.calls.save.length, 1, label);
        assert.match(page.progress.calls.save[0].record.startedAt, /^\d{4}-\d{2}-\d{2}T/, label);
      }

      // Không lưu khi engine báo không lưu được hoặc màn thắng đang hiện; lưu khi rời trang/ẩn tab.
      {
        const page = await start(group, gameId, { game: createFakeGame({ canSave: false }) });
        page.clock.tick(SAVE_INTERVAL_MS * 2);
        page.window.dispatch('pagehide');
        assert.equal(page.progress.calls.save.length, 0, `${label}: canSave() false`);

        page.game.state.canSave = true;
        page.window.dispatch('pagehide');
        assert.equal(page.progress.calls.save.length, 1, `${label}: pagehide`);
        page.document.visibilityState = 'visible';
        page.document.dispatch('visibilitychange');
        assert.equal(page.progress.calls.save.length, 1, `${label}: tab vẫn hiện thì không lưu`);
        page.document.visibilityState = 'hidden';
        page.document.dispatch('visibilitychange');
        assert.equal(page.progress.calls.save.length, 2, `${label}: ẩn tab`);
        assert.equal(typeof page.window[group.exposed].save, 'function', label);
        assert.equal(page.window[group.exposed].gameId, gameId, label);
      }

      // Ván mới: phiên mới nên lượt hoàn thành sau đó có transactionId khác; hoàn thành trùng không báo lại.
      for (const buttonId of group.newGameButtons) {
        const page = await start(group, gameId);
        page.winDialog.classList.add('hien');
        page.winDialog.classList.remove('hien');
        const savesBefore = page.progress.calls.save.length;
        page.buttons[buttonId].click();
        await new Promise((resolve) => setImmediate(resolve)); // game 2–4 đổi phiên trong queueMicrotask
        page.clock.tick(0);
        assert.equal(page.progress.calls.save.length, savesBefore + 1, `${label}: ${buttonId} lưu ngay ván mới`);
        page.winDialog.classList.add('hien');
        const [first, second] = page.progress.calls.complete.map((call) => call.result.transactionId);
        assert.ok(first && second && first !== second, `${label}: ${buttonId} đổi phiên (${first} → ${second})`);
        assert.deepEqual(page.errors, [], label);
      }
    }
  }

  // Game 8: mức độ lưu theo engine (8/12/16 ô) chứ không cố định.
  {
    const group = GROUPS[2];
    const page = await start(group, 'game8', { game: createFakeGame({ difficulty: '16x16' }) });
    page.clock.tick(SAVE_INTERVAL_MS);
    assert.equal(page.progress.calls.save[0].record.difficulty, '16x16');
  }

  // Game 2–4: bấm ván mới xoá tóm tắt phần thưởng của ván trước.
  {
    const group = GROUPS[0];
    let summary;
    const progress = createFakeProgress();
    const sandbox = await runBrowserModule(group.file, {
      pathname: '/game3.html',
      routes,
      modules: { progress },
      setup({ window, addElement, addSelector }) {
        window.BongGame3 = createFakeGame();
        addElement('manThang');
        addElement('nutVanMoi', 'button');
        summary = addSelector('.man-thang .bh-reward-summary');
        summary.textContent = '⭐ Bé nhận 2 sao';
      }
    });
    sandbox.document.getElementById('nutVanMoi').click();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(summary.hidden, true);
    assert.deepEqual(summary.children, []);
  }

  console.log('Games autosave behavior checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
