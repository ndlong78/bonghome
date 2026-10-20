(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongModulesReady) {
    root.BongGame12RewardsReady = Promise.resolve(root.BongModulesReady)
      .then((modules) => (modules?.progress && modules?.rewards ? factory(modules.progress, modules.rewards, root) : null))
      .catch((error) => {
        console.warn('[Bông Home] Không bật được phần thưởng Game 12', error);
        return null;
      });
  }
})(typeof window !== 'undefined' ? window : globalThis, function createGame12Rewards(progress, rewards, root) {
  'use strict';

  root = root || null;
  if (!progress || !rewards) throw new Error('Game 12 rewards require progress and rewards modules');

  const GAME_ID = 'game12';
  const STICKER = Object.freeze({ id: 'wise-owl', name: 'Cú mèo thông thái', icon: '🦉' });
  const MASTER_BADGE = Object.freeze({ id: 'sudoku-master', name: 'Bậc thầy Sudoku', icon: '🎓', levelId: 'cay' });

  function hashText(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function makeProgressTransactionId(levelId, givens) {
    if (typeof levelId !== 'string' || !/^[a-z0-9-]+$/.test(levelId)) throw new TypeError('levelId must be kebab-case');
    if (!Array.isArray(givens) || !givens.length) throw new TypeError('givens must be a non-empty array');
    return `${GAME_ID}-${levelId}-${hashText(givens.join(','))}`;
  }

  function makeRewardTransactionId(progressTransactionId) {
    if (typeof progressTransactionId !== 'string' || !progressTransactionId) {
      throw new TypeError('Progress transactionId must be a non-empty string');
    }
    return `${GAME_ID}-reward-${hashText(progressTransactionId)}`;
  }

  function rewardLines(detail) {
    const lines = [`⭐ Bé nhận ${detail.stars} sao`];
    if (detail.newSticker) lines.push(`${STICKER.icon} Sticker mới: ${STICKER.name}`);
    if (detail.newBadge) lines.push(`${MASTER_BADGE.icon} Huy hiệu mới: ${MASTER_BADGE.name}`);
    return lines;
  }

  /** Đánh dấu "đang chơi dở" cho Góc phụ huynh, chỉ lưu thông tin tóm tắt. */
  function trackProgress({ levelId, left } = {}) {
    return progress.saveGame(GAME_ID, {
      difficulty: levelId || null,
      state: { left: Number.isInteger(left) ? left : null }
    });
  }

  function complete({ levelId, givens, stars, hints, durationSeconds, moves } = {}) {
    const transactionId = makeProgressTransactionId(levelId, givens);
    const starCount = Math.min(3, Math.max(1, Number.isInteger(stars) ? stars : 1));
    const completion = progress.completeGame(GAME_ID, {
      transactionId,
      difficulty: levelId,
      durationSeconds,
      moves,
      metadata: { hints: Number.isInteger(hints) ? hints : 0 }
    });

    const rewardResult = rewards.awardStars(
      makeRewardTransactionId(transactionId),
      starCount,
      { gameId: GAME_ID, progressTransactionId: transactionId, levelId }
    );
    const stickerResult = rewards.unlockSticker(STICKER.id, { source: `${GAME_ID}-completion` });
    const badgeResult = levelId === MASTER_BADGE.levelId
      ? rewards.unlockBadge(MASTER_BADGE.id, { source: `${GAME_ID}-completion` })
      : { duplicate: true };

    const detail = {
      gameId: GAME_ID,
      levelId,
      duplicate: Boolean(completion?.duplicate || rewardResult.duplicate),
      stars: starCount,
      totalStars: rewardResult.summary.stars,
      stickerId: STICKER.id,
      newSticker: !stickerResult.duplicate,
      newBadge: !badgeResult.duplicate
    };
    if (root?.dispatchEvent && root.CustomEvent) {
      root.dispatchEvent(new root.CustomEvent('bonghome:reward', { detail }));
    }
    return detail;
  }

  return Object.freeze({
    gameId: GAME_ID,
    sticker: STICKER,
    masterBadge: MASTER_BADGE,
    makeProgressTransactionId,
    makeRewardTransactionId,
    rewardLines,
    trackProgress,
    complete
  });
});
