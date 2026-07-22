(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root?.document) {
    root.BongGame1Autosave = api;
    api.start(root);
  }
})(typeof window !== 'undefined' ? window : globalThis, function createGame1Autosave() {
  'use strict';

  const SNAPSHOT_VERSION = 1;
  const GAME_ID = 'game1';
  const ALLOWED_DIFFICULTIES = new Set([3, 6, 8, 12]);

  const uniqueIntegers = (values, max) => {
    if (!Array.isArray(values)) return null;
    const output = [];
    const seen = new Set();
    for (const value of values) {
      if (!Number.isInteger(value) || value < 0 || value >= max || seen.has(value)) return null;
      seen.add(value);
      output.push(value);
    }
    return output;
  };

  function validateSnapshot(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const difficulty = Number(value.difficulty);
    if (value.version !== SNAPSHOT_VERSION || !ALLOWED_DIFFICULTIES.has(difficulty)) return null;
    if (!Array.isArray(value.deck) || value.deck.length !== difficulty * 2) return null;
    if (!value.deck.every((code) => Number.isInteger(code) && code >= 0 && code < difficulty)) return null;

    const counts = new Map();
    value.deck.forEach((code) => counts.set(code, (counts.get(code) || 0) + 1));
    if (counts.size !== difficulty || [...counts.values()].some((count) => count !== 2)) return null;

    const matchedIndices = uniqueIntegers(value.matchedIndices, value.deck.length);
    const openIndices = uniqueIntegers(value.openIndices, value.deck.length);
    if (!matchedIndices || !openIndices || matchedIndices.length % 2 !== 0 || openIndices.length > 2) return null;
    if (openIndices.some((index) => matchedIndices.includes(index))) return null;

    const moves = Number(value.moves);
    const seconds = Number(value.seconds);
    if (!Number.isInteger(moves) || moves < 0 || !Number.isInteger(seconds) || seconds < 0) return null;

    return {
      version: SNAPSHOT_VERSION,
      difficulty,
      deck: value.deck.slice(),
      matchedIndices,
      openIndices,
      moves,
      seconds,
      started: Boolean(value.started),
      locked: Boolean(value.locked)
    };
  }

  function makeTransactionId(startedAt, difficulty) {
    const safeStartedAt = typeof startedAt === 'string' && startedAt ? startedAt : 'unknown';
    return `game1:${difficulty}:${safeStartedAt}`;
  }

  function start(root) {
    if (!/\/game1\.html$/.test(root.location.pathname) || root.__bongGame1AutosaveStarted) return;
    root.__bongGame1AutosaveStarted = true;

    const progress = root.BongProgress;
    if (!progress) return;

    let startedAt = null;
    let completed = false;
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

    function setDifficultyButton(difficulty) {
      root.document.querySelectorAll('#mucDo button').forEach((button) => {
        const selected = Number(button.dataset.cap) === difficulty;
        button.classList.toggle('dang-chon', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    }

    function resizeBoard() {
      const columns = soCapCanTim === 3 ? 3 : 4;
      const width = Math.min(140, Math.floor((Math.min(root.innerWidth - 40, 700)) / columns) - 12);
      sanBai.style.gridTemplateColumns = `repeat(${columns}, ${width}px)`;
    }

    function startClock() {
      root.clearInterval(dongHoChay);
      dongHoChay = null;
      if (!daBatDau || completed || capDaTim >= soCapCanTim) return;
      dongHoChay = root.setInterval(() => {
        giay += 1;
        oDongHo.textContent = dinhDangGio(giay);
      }, 1000);
    }

    function captureSnapshot() {
      const cards = [...sanBai.querySelectorAll('.la-bai')];
      if (cards.length !== soCapCanTim * 2) return null;
      return validateSnapshot({
        version: SNAPSHOT_VERSION,
        difficulty: soCapCanTim,
        deck: cards.map((card) => Number(card.dataset.ma)),
        matchedIndices: cards.flatMap((card, index) => card.classList.contains('dung') ? [index] : []),
        openIndices: cards.flatMap((card, index) => card.classList.contains('lat') && !card.classList.contains('dung') ? [index] : []),
        moves: soLuot,
        seconds: giay,
        started: daBatDau,
        locked: khoaBai
      });
    }

    function isMeaningful(snapshot) {
      return Boolean(snapshot && (snapshot.started || snapshot.moves || snapshot.matchedIndices.length || snapshot.openIndices.length));
    }

    function saveNow() {
      if (completed) return false;
      const snapshot = captureSnapshot();
      if (!isMeaningful(snapshot)) return false;
      const saved = progress.saveGame(GAME_ID, {
        status: 'in_progress',
        difficulty: String(snapshot.difficulty),
        state: snapshot,
        startedAt
      });
      startedAt = saved.startedAt;
      return true;
    }

    function closePendingMismatch(delay = 700) {
      if (!khoaBai || baiDangMo.length !== 2) return;
      root.setTimeout(() => {
        baiDangMo.forEach((card) => card.classList.remove('lat', 'sai'));
        baiDangMo = [];
        khoaBai = false;
        saveNow();
      }, delay);
    }

    function buildCard(code) {
      const button = root.document.createElement('button');
      button.className = 'la-bai';
      button.dataset.ma = String(code);
      button.setAttribute('aria-label', 'Lá bài úp');
      button.innerHTML = `<div class="mat mat-sau">${HINH_MAT_SAU}</div><div class="mat mat-truoc">${KHO_HINH[code]}</div>`;
      button.addEventListener('click', () => chamVaoBai(button));
      return button;
    }

    function restoreSnapshot(snapshot, saved) {
      root.clearInterval(dongHoChay);
      dongHoChay = null;
      completed = false;
      startedAt = saved.startedAt || null;
      soCapCanTim = snapshot.difficulty;
      setDifficultyButton(soCapCanTim);

      sanBai.innerHTML = '';
      snapshot.deck.forEach((code) => sanBai.appendChild(buildCard(code)));
      const cards = [...sanBai.querySelectorAll('.la-bai')];
      snapshot.matchedIndices.forEach((index) => cards[index].classList.add('lat', 'dung'));
      snapshot.openIndices.forEach((index) => cards[index].classList.add('lat'));

      baiDangMo = snapshot.openIndices.map((index) => cards[index]);
      capDaTim = snapshot.matchedIndices.length / 2;
      soLuot = snapshot.moves;
      giay = snapshot.seconds;
      daBatDau = snapshot.started;
      khoaBai = snapshot.locked && baiDangMo.length === 2;

      oSoCap.textContent = `${capDaTim}/${soCapCanTim}`;
      oSoLuot.textContent = String(soLuot);
      oDongHo.textContent = dinhDangGio(giay);
      const record = docKyLuc(soCapCanTim);
      oKyLuc.textContent = record ? dinhDangGio(record) : '--';
      manThang.classList.remove('hien');
      root.document.getElementById('bangKyLuc').classList.remove('hien');
      dungPhaoGiay();
      resizeBoard();
      startClock();
      closePendingMismatch();
      announce('🌷 Bé tiếp tục từ chỗ đang chơi nhé!');
    }

    function showResumeChoice(saved, snapshot) {
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
        restoreSnapshot(snapshot, saved);
        overlay.remove();
      });
      restartButton.addEventListener('click', () => {
        progress.clearGame(GAME_ID);
        startedAt = null;
        completed = false;
        vanMoi();
        overlay.remove();
        announce('✨ Bé bắt đầu một ván mới nhé!');
      });
      continueButton.focus();
    }

    const originalWin = thangCuoc;
    thangCuoc = function autosavedWin() {
      originalWin();
      if (completed) return;
      completed = true;
      const transactionId = makeTransactionId(startedAt, soCapCanTim);
      progress.completeGame(GAME_ID, {
        transactionId,
        difficulty: String(soCapCanTim),
        durationSeconds: giay,
        moves: soLuot,
        metadata: { pairs: soCapCanTim }
      });
    };

    root.document.addEventListener('click', (event) => {
      const restart = event.target.closest('#nutChoiLai, #mucDo button');
      if (restart) {
        progress.clearGame(GAME_ID);
        startedAt = null;
        completed = false;
        return;
      }
      if (event.target.closest('#sanBai .la-bai')) {
        root.setTimeout(saveNow, 0);
        root.setTimeout(saveNow, 1100);
      }
    });

    root.addEventListener('bonghome:pause', saveNow);
    root.addEventListener('pagehide', saveNow);
    periodicSave = root.setInterval(saveNow, 5000);
    root.addEventListener('beforeunload', () => root.clearInterval(periodicSave), { once: true });

    const saved = progress.loadGame(GAME_ID);
    const snapshot = validateSnapshot(saved?.state);
    if (saved && snapshot && isMeaningful(snapshot)) showResumeChoice(saved, snapshot);
    else if (saved) progress.clearGame(GAME_ID);
  }

  return Object.freeze({
    snapshotVersion: SNAPSHOT_VERSION,
    validateSnapshot,
    makeTransactionId,
    start
  });
});
