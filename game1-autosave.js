(function (root, factory) {
  'use strict';
  const engine = root?.BongGame1Engine || (typeof require === 'function' ? require('./js/game1-engine.js') : null);
  const api = factory(engine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root?.document) {
    root.BongGame1Autosave = api;
    api.start(root);
  }
})(typeof window !== 'undefined' ? window : globalThis, function createGame1Autosave(engine) {
  'use strict';

  if (!engine) throw new Error('Game 1 autosave requires js/game1-engine.js');
  const SNAPSHOT_VERSION = engine.SNAPSHOT_VERSION;
  const BUNDLE_VERSION = 1;
  const GAME_ID = 'game1';
  const ALLOWED_DIFFICULTIES = new Set(engine.PAIR_COUNTS);

  /** Snapshot hợp lệ (đã chuẩn hoá) hoặc null; luật kiểm tra nằm ở engine (js/game1-engine.js). */
  function validateSnapshot(value) {
    const state = engine.restore(value);
    return state ? engine.serialize(state) : null;
  }

  function emptyBundle() {
    return { bundleVersion: BUNDLE_VERSION, activeDifficulty: null, snapshots: {} };
  }

  function validateBundle(value, legacyStartedAt = null) {
    const bundle = emptyBundle();
    const legacySnapshot = validateSnapshot(value);
    if (legacySnapshot) {
      bundle.activeDifficulty = legacySnapshot.difficulty;
      bundle.snapshots[String(legacySnapshot.difficulty)] = {
        snapshot: legacySnapshot,
        startedAt: legacyStartedAt || null
      };
      return bundle;
    }

    if (!value || typeof value !== 'object' || Array.isArray(value) || value.bundleVersion !== BUNDLE_VERSION) {
      return bundle;
    }

    for (const [key, entry] of Object.entries(value.snapshots || {})) {
      const snapshot = validateSnapshot(entry?.snapshot);
      if (!snapshot || String(snapshot.difficulty) !== key) continue;
      bundle.snapshots[key] = {
        snapshot,
        startedAt: typeof entry.startedAt === 'string' && entry.startedAt ? entry.startedAt : null
      };
    }

    const active = Number(value.activeDifficulty);
    if (ALLOWED_DIFFICULTIES.has(active) && bundle.snapshots[String(active)]) {
      bundle.activeDifficulty = active;
    } else {
      const first = Object.keys(bundle.snapshots)[0];
      bundle.activeDifficulty = first ? Number(first) : null;
    }
    return bundle;
  }

  function makeTransactionId(startedAt, difficulty) {
    const safeStartedAt = typeof startedAt === 'string' && startedAt ? startedAt : 'unknown';
    return `game1:${difficulty}:${safeStartedAt}`;
  }

  function matchesGameRoute(pathname, routes) {
    const path = typeof pathname === 'string' ? pathname : '';
    const sharedResult = routes?.isGame?.(1, path);
    if (typeof sharedResult === 'boolean') return sharedResult;
    return /\/game1(?:\.html)?\/?$/.test(path);
  }

  function start(root) {
    if (!matchesGameRoute(root.location?.pathname, root.BongRoutes) || root.__bongGame1AutosaveStarted) return;
    root.__bongGame1AutosaveStarted = true;

    const progress = root.BongProgress;
    // Game 1 đã tách engine/UI (js/game1-engine.js, js/game1-ui.js): mọi thao tác ván đi qua window.BongGame1.
    const game = root.BongGame1;
    if (!progress || !game) return;

    let startedAt = null;
    let periodicSave = null;
    let statusTimer = null;

    const status = root.document.createElement('div');
    status.className = 'bh-game1-save-status';
    status.hidden = true;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    root.document.body.appendChild(status);

    function announce(message) {
      root.clearTimeout(statusTimer);
      status.textContent = message;
      status.hidden = false;
      statusTimer = root.setTimeout(() => { status.hidden = true; }, 2200);
    }

    function readBundle() {
      const saved = progress.loadGame(GAME_ID);
      return { saved, bundle: validateBundle(saved?.state, saved?.startedAt) };
    }

    function writeBundle(bundle) {
      const keys = Object.keys(bundle.snapshots);
      if (!keys.length) {
        progress.clearGame(GAME_ID);
        return null;
      }
      if (!bundle.activeDifficulty || !bundle.snapshots[String(bundle.activeDifficulty)]) {
        bundle.activeDifficulty = Number(keys[0]);
      }
      return progress.saveGame(GAME_ID, {
        status: 'in_progress',
        difficulty: String(bundle.activeDifficulty),
        state: bundle,
        startedAt: bundle.snapshots[String(bundle.activeDifficulty)]?.startedAt || undefined
      });
    }

    const isMeaningful = (snapshot) => Boolean(snapshot) && engine.hasProgress(engine.restore(snapshot));

    function saveNow() {
      if (!game.canSave() || !game.hasProgress()) return false;
      const snapshot = validateSnapshot(game.serialize());
      if (!snapshot) return false;
      const { bundle } = readBundle();
      const key = String(snapshot.difficulty);
      const previousStartedAt = bundle.snapshots[key]?.startedAt;
      startedAt = startedAt || previousStartedAt || new Date().toISOString();
      bundle.snapshots[key] = { snapshot, startedAt };
      bundle.activeDifficulty = snapshot.difficulty;
      writeBundle(bundle);
      return true;
    }

    function clearDifficulty(difficulty) {
      const { bundle } = readBundle();
      delete bundle.snapshots[String(difficulty)];
      if (bundle.activeDifficulty === difficulty) bundle.activeDifficulty = null;
      writeBundle(bundle);
    }

    /** Khôi phục qua giao diện: vẽ lại bàn, chạy lại đồng hồ, cặp sai đang chờ thì tự úp lại. */
    function restoreSnapshot(snapshot, entry, message = '🌷 Bé tiếp tục từ chỗ đang chơi nhé!') {
      if (!game.restore(snapshot)) return false;
      startedAt = entry?.startedAt || null;
      announce(message);
      return true;
    }

    function restoreDifficulty(difficulty, message) {
      const { bundle } = readBundle();
      const entry = bundle.snapshots[String(difficulty)];
      const snapshot = validateSnapshot(entry?.snapshot);
      if (!snapshot || !isMeaningful(snapshot)) return false;
      bundle.activeDifficulty = difficulty;
      writeBundle(bundle);
      return restoreSnapshot(snapshot, entry, message);
    }

    function showResumeChoice(entry, snapshot) {
      const overlay = root.document.createElement('div');
      overlay.className = 'bh-game1-resume';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'bhGame1ResumeTitle');
      overlay.innerHTML = `
        <div class="bh-game1-resume-card">
          <div class="bh-game1-resume-icon" aria-hidden="true">🧩🌷</div>
          <h2 id="bhGame1ResumeTitle">Bé đang có một ván chưa xong</h2>
          <p>Tiếp tục từ đúng chỗ đang chơi, hay bắt đầu một ván mới nhé?</p>
          <div class="bh-game1-resume-actions">
            <button type="button" class="bh-game1-continue">Tiếp tục</button>
            <button type="button" class="bh-game1-restart">Chơi ván mới</button>
          </div>
        </div>`;
      root.document.body.appendChild(overlay);
      const continueButton = overlay.querySelector('.bh-game1-continue');
      const restartButton = overlay.querySelector('.bh-game1-restart');
      continueButton.addEventListener('click', () => {
        restoreSnapshot(snapshot, entry);
        overlay.remove();
      });
      restartButton.addEventListener('click', () => {
        clearDifficulty(snapshot.difficulty);
        startedAt = null;
        game.newGame(snapshot.difficulty);
        overlay.remove();
        announce('✨ Bé bắt đầu một ván mới nhé!');
      });
      continueButton.focus();
    }

    game.onWin((state) => {
      const finishedDifficulty = state.pairs;
      const finishedStartedAt = startedAt;
      const { bundle } = readBundle();
      delete bundle.snapshots[String(finishedDifficulty)];
      const remaining = JSON.parse(JSON.stringify(bundle));
      progress.completeGame(GAME_ID, {
        transactionId: makeTransactionId(finishedStartedAt, finishedDifficulty),
        difficulty: String(finishedDifficulty),
        durationSeconds: state.seconds,
        moves: state.moves,
        metadata: { pairs: finishedDifficulty }
      });
      writeBundle(remaining);
    });
    // Mỗi lần lật lá hoặc úp lại cặp sai thì lưu ngay (trước đây đoán bằng hẹn giờ 0 ms và 1100 ms sau cú chạm).
    game.onChange(saveNow);

    // Pha capture: lưu ván của mức cũ trước khi giao diện chuyển sang mức mới.
    root.document.addEventListener('click', (event) => {
      const difficultyButton = event.target.closest('#mucDo button');
      if (difficultyButton) saveNow();
    }, true);

    root.document.addEventListener('click', (event) => {
      const difficultyButton = event.target.closest('#mucDo button');
      if (difficultyButton) {
        const targetDifficulty = Number(difficultyButton.dataset.cap);
        startedAt = null;
        root.setTimeout(() => {
          restoreDifficulty(targetDifficulty, '🌼 Bé quay lại đúng ván của mức này nhé!');
        }, 0);
        return;
      }

      if (event.target.closest('#nutChoiLai')) {
        clearDifficulty(game.pairs());
        startedAt = null;
      }
    });

    root.addEventListener('bonghome:pause', saveNow);
    root.addEventListener('pagehide', saveNow);
    periodicSave = root.setInterval(saveNow, 5000);
    root.addEventListener('beforeunload', () => root.clearInterval(periodicSave), { once: true });

    const { bundle } = readBundle();
    const activeKey = bundle.activeDifficulty ? String(bundle.activeDifficulty) : null;
    const entry = activeKey ? bundle.snapshots[activeKey] : null;
    const snapshot = validateSnapshot(entry?.snapshot);
    if (snapshot && isMeaningful(snapshot)) showResumeChoice(entry, snapshot);
  }

  return Object.freeze({
    snapshotVersion: SNAPSHOT_VERSION,
    bundleVersion: BUNDLE_VERSION,
    validateSnapshot,
    validateBundle,
    makeTransactionId,
    matchesGameRoute,
    start
  });
});
