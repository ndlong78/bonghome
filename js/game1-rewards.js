(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongProgress && root?.BongRewards) {
    root.BongProgress = factory(root.BongProgress, root.BongRewards, root);
  }
})(typeof window !== 'undefined' ? window : globalThis, function createGame1Rewards(progress, rewards, root) {
  'use strict';

  root = root || null;
  if (!progress || !rewards) throw new Error('Game 1 rewards require progress and rewards modules');

  function hashText(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function makeRewardTransactionId(progressTransactionId) {
    if (typeof progressTransactionId !== 'string' || !progressTransactionId) {
      throw new TypeError('Progress transactionId must be a non-empty string');
    }
    return `game1-reward-${hashText(progressTransactionId)}`;
  }

  function starsForDifficulty(difficulty) {
    const pairs = Number(difficulty);
    if (pairs >= 8) return 3;
    if (pairs >= 6) return 2;
    return 1;
  }

  function rewardLines(detail) {
    const lines = [`⭐ Bé nhận ${detail.stars} sao`];
    if (detail.newSticker) lines.push('🌟 Sticker mới: Ngôi sao vui vẻ');
    if (detail.newBadge) lines.push('🎈 Huy hiệu mới: Lần đầu hoàn thành');
    return lines;
  }

  function renderInWinDialog(detail) {
    if (!root?.document || typeof root.document.querySelector !== 'function' || !detail || detail.duplicate) return false;
    const dialog = root.document.querySelector('#manThang .hop-thang');
    if (!dialog) return false;

    let summary = dialog.querySelector('.bh-game1-reward-summary');
    if (!summary) {
      summary = root.document.createElement('div');
      summary.className = 'bh-game1-reward-summary';
      summary.setAttribute('role', 'status');
      summary.setAttribute('aria-live', 'polite');
      const actions = dialog.querySelector('.nhom-nut');
      dialog.insertBefore(summary, actions || null);
    }

    summary.replaceChildren(...rewardLines(detail).map((text, index) => {
      const line = root.document.createElement('p');
      line.className = index === 0 ? 'bh-game1-reward-stars' : 'bh-game1-reward-unlock';
      line.textContent = text;
      return line;
    }));
    summary.hidden = false;
    return true;
  }

  function announce(detail) {
    if (!root?.document || !detail || detail.duplicate) return;
    if (renderInWinDialog(detail)) return;

    let status = root.document.getElementById('bhGame1RewardStatus');
    if (!status) {
      status = root.document.createElement('div');
      status.id = 'bhGame1RewardStatus';
      status.className = 'bh-game1-save-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      root.document.body.appendChild(status);
    }
    status.textContent = rewardLines(detail).join(' · ');
    status.hidden = false;
    root.clearTimeout(status.__hideTimer);
    status.__hideTimer = root.setTimeout(() => { status.hidden = true; }, 2800);
  }

  function completeGame(gameId, result = {}) {
    const completionResult = progress.completeGame(gameId, result);
    if (gameId !== 'game1') return completionResult;

    const progressTransactionId = completionResult?.completion?.transactionId || result.transactionId;
    if (!progressTransactionId) return completionResult;

    const stars = starsForDifficulty(result.difficulty || completionResult?.completion?.difficulty);
    const rewardResult = rewards.awardStars(
      makeRewardTransactionId(progressTransactionId),
      stars,
      {
        gameId,
        progressTransactionId,
        difficulty: result.difficulty || null,
        theme: result.theme || completionResult?.completion?.theme || null
      }
    );

    const sticker = rewards.unlockSticker('happy-star', { source: 'game1-completion' });
    const badge = rewards.unlockBadge('first-finish', { source: 'game1-completion' });

    const detail = {
      duplicate: rewardResult.duplicate,
      stars,
      totalStars: rewardResult.summary.stars,
      newSticker: !sticker.duplicate,
      newBadge: !badge.duplicate
    };
    announce(detail);
    if (root?.dispatchEvent && root.CustomEvent) {
      root.dispatchEvent(new root.CustomEvent('bonghome:reward', { detail }));
    }
    return completionResult;
  }

  return Object.freeze({
    schemaVersion: progress.schemaVersion,
    saveGame: progress.saveGame.bind(progress),
    loadGame: progress.loadGame.bind(progress),
    clearGame: progress.clearGame.bind(progress),
    completeGame,
    getSummary: progress.getSummary.bind(progress),
    makeRewardTransactionId,
    starsForDifficulty,
    rewardLines,
    renderInWinDialog
  });
});
