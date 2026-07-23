(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongProgress && root?.BongRewards) {
    root.BongProgress = factory(root.BongProgress, root.BongRewards, root);
  }
})(typeof window !== 'undefined' ? window : globalThis, function createGames5To7Rewards(progress, rewards, root) {
  'use strict';

  root = root || null;
  if (!progress || !rewards) throw new Error('Games 5-7 rewards require progress and rewards modules');

  const REWARD_CONFIG = Object.freeze({
    game5: Object.freeze({ stars: 2, stickerId: 'diligent-pencil', stickerName: 'Bút chì chăm chỉ', stickerIcon: '✏️' }),
    game6: Object.freeze({ stars: 2, stickerId: 'best-friends', stickerName: 'Đôi bạn thân', stickerIcon: '👯' }),
    game7: Object.freeze({ stars: 2, stickerId: 'bright-idea', stickerName: 'Bóng đèn thông minh', stickerIcon: '💡' })
  });

  function hashText(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function makeRewardTransactionId(gameId, progressTransactionId) {
    if (!REWARD_CONFIG[gameId]) throw new TypeError('Unsupported reward game');
    if (typeof progressTransactionId !== 'string' || !progressTransactionId) {
      throw new TypeError('Progress transactionId must be a non-empty string');
    }
    return `${gameId}-reward-${hashText(progressTransactionId)}`;
  }

  function rewardLines(detail) {
    const lines = [`⭐ Bé nhận ${detail.stars} sao`];
    if (detail.newSticker) lines.push(`${detail.stickerIcon} Sticker mới: ${detail.stickerName}`);
    if (detail.newBadge) lines.push('🧠 Huy hiệu mới: Bé tư duy');
    return lines;
  }

  function renderInWinDialog(detail) {
    if (!root?.document || typeof root.document.querySelector !== 'function' || !detail || detail.duplicate) return false;
    const dialog = root.document.querySelector('.man-thang .hop-thang');
    if (!dialog || typeof dialog.querySelector !== 'function') return false;

    let summary = dialog.querySelector('.bh-reward-summary');
    if (!summary) {
      summary = root.document.createElement('div');
      summary.className = 'bh-reward-summary';
      summary.setAttribute('role', 'status');
      summary.setAttribute('aria-live', 'polite');
      const actions = dialog.querySelector('.nhom-nut');
      dialog.insertBefore(summary, actions || null);
    }

    summary.replaceChildren(...rewardLines(detail).map((text, index) => {
      const line = root.document.createElement('p');
      line.className = index === 0 ? 'bh-reward-stars' : 'bh-reward-unlock';
      line.textContent = text;
      return line;
    }));
    summary.hidden = false;
    return true;
  }

  function announce(detail) {
    if (!root?.document || !detail || detail.duplicate) return;
    if (renderInWinDialog(detail)) return;

    let status = root.document.getElementById('bhGameRewardStatus');
    if (!status) {
      status = root.document.createElement('div');
      status.id = 'bhGameRewardStatus';
      status.className = 'bh-game-autosave-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      root.document.body.appendChild(status);
    }
    status.textContent = rewardLines(detail).join(' · ');
    status.hidden = false;
    root.clearTimeout(status.__hideTimer);
    status.__hideTimer = root.setTimeout(() => { status.hidden = true; }, 3000);
  }

  function completeGame(gameId, result) {
    result = result || {};
    const completionResult = progress.completeGame(gameId, result);
    const config = REWARD_CONFIG[gameId];
    if (!config) return completionResult;

    const progressTransactionId = completionResult?.completion?.transactionId || result.transactionId;
    if (!progressTransactionId) return completionResult;

    const rewardResult = rewards.awardStars(
      makeRewardTransactionId(gameId, progressTransactionId),
      config.stars,
      { gameId, progressTransactionId }
    );
    const stickerResult = rewards.unlockSticker(config.stickerId, { source: `${gameId}-completion` });

    const byGame = progress.getSummary()?.byGame || {};
    const completedAll = ['game5', 'game6', 'game7'].every((id) => Number(byGame[id]) > 0);
    const badgeResult = completedAll
      ? rewards.unlockBadge('thinking-kid', { source: 'games5-7-complete' })
      : { duplicate: true };

    const detail = {
      gameId,
      duplicate: rewardResult.duplicate,
      stars: config.stars,
      totalStars: rewardResult.summary.stars,
      stickerId: config.stickerId,
      stickerName: config.stickerName,
      stickerIcon: config.stickerIcon,
      newSticker: !stickerResult.duplicate,
      newBadge: !badgeResult.duplicate
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
    rewardLines,
    renderInWinDialog,
    rewardConfig: REWARD_CONFIG
  });
});
