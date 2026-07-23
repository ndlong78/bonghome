(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongProgress && root?.BongRewards) {
    root.BongProgress = factory(root.BongProgress, root.BongRewards, root);
  }
})(typeof window !== 'undefined' ? window : globalThis, function createGames2To4Rewards(progress, rewards, root) {
  'use strict';

  root = root || null;
  if (!progress || !rewards) throw new Error('Games 2-4 rewards require progress and rewards modules');

  const REWARD_CONFIG = Object.freeze({
    game2: Object.freeze({ stars: 2, stickerId: 'little-flower', stickerName: 'Bông hoa nhỏ' }),
    game3: Object.freeze({ stars: 2, stickerId: 'rainbow-friend', stickerName: 'Bạn cầu vồng' }),
    game4: Object.freeze({ stars: 2, stickerId: 'kind-heart', stickerName: 'Trái tim ấm áp' })
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

  function announce(detail) {
    if (!root?.document || !detail || detail.duplicate) return;
    let status = root.document.getElementById('bhGameRewardStatus');
    if (!status) {
      status = root.document.createElement('div');
      status.id = 'bhGameRewardStatus';
      status.className = 'bh-game-autosave-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      root.document.body.appendChild(status);
    }
    const stickerText = detail.newSticker ? ` và sticker ${detail.stickerName}` : '';
    const badgeText = detail.newBadge ? ' cùng huy hiệu Bé ham khám phá' : '';
    status.textContent = `⭐ Bé nhận ${detail.stars} sao${stickerText}${badgeText}!`;
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
    const exploredAll = ['game2', 'game3', 'game4'].every((id) => Number(byGame[id]) > 0);
    const badgeResult = exploredAll
      ? rewards.unlockBadge('curious-learner', { source: 'games2-4-complete' })
      : { duplicate: true };

    const detail = {
      gameId,
      duplicate: rewardResult.duplicate,
      stars: config.stars,
      totalStars: rewardResult.summary.stars,
      stickerId: config.stickerId,
      stickerName: config.stickerName,
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
    rewardConfig: REWARD_CONFIG
  });
});
