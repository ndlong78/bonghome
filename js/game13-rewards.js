(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongModulesReady) {
    root.BongGame13RewardsReady = Promise.resolve(root.BongModulesReady)
      .then((modules) => (modules?.progress && modules?.rewards ? factory(modules.progress, modules.rewards, root) : null))
      .catch((error) => {
        console.warn('[Bông Home] Không bật được phần thưởng Game 13', error);
        return null;
      });
  }
})(typeof window !== 'undefined' ? window : globalThis, function createGame13Rewards(progress, rewards, root) {
  'use strict';

  root = root || null;
  if (!progress || !rewards) throw new Error('Game 13 rewards require progress and rewards modules');

  const GAME_ID = 'game13';
  const OUTCOMES = Object.freeze(['win', 'draw']);
  const STICKER = Object.freeze({ id: 'clever-fox', name: 'Cáo tinh nhanh', icon: '🦊' });
  const MASTER_BADGE = Object.freeze({ id: 'tictactoe-master', name: 'Kỳ thủ Ca-rô nhí', icon: '🏅', levelId: 'kho' });

  function hashText(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function makeProgressTransactionId(levelId, matchId) {
    if (typeof levelId !== 'string' || !/^[a-z0-9-]+$/.test(levelId)) throw new TypeError('levelId must be kebab-case');
    if (typeof matchId !== 'string' || !matchId) throw new TypeError('matchId must be a non-empty string');
    return `${GAME_ID}-${levelId}-${hashText(matchId)}`;
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
  function trackProgress({ levelId, moves } = {}) {
    return progress.saveGame(GAME_ID, {
      difficulty: levelId || null,
      state: { moves: Number.isInteger(moves) ? moves : null }
    });
  }

  /** Ván thua hoặc bỏ dở không tính là hoàn thành: chỉ gỡ trạng thái "đang chơi dở". */
  function abandon() {
    return progress.clearGame(GAME_ID);
  }

  /** Ghi nhận ván thắng/hòa với Gấu Bông. Ván thua không gọi hàm này. */
  function complete({ levelId, matchId, outcome, stars, moves, durationSeconds } = {}) {
    if (!OUTCOMES.includes(outcome)) throw new TypeError('outcome must be win or draw');
    const transactionId = makeProgressTransactionId(levelId, matchId);
    const starCount = Math.min(3, Math.max(1, Number.isInteger(stars) ? stars : 1));
    const completion = progress.completeGame(GAME_ID, {
      transactionId,
      difficulty: levelId,
      durationSeconds,
      moves,
      metadata: { outcome }
    });

    const rewardResult = rewards.awardStars(
      makeRewardTransactionId(transactionId),
      starCount,
      { gameId: GAME_ID, progressTransactionId: transactionId, levelId, outcome }
    );
    const stickerResult = rewards.unlockSticker(STICKER.id, { source: `${GAME_ID}-completion` });
    const badgeResult = levelId === MASTER_BADGE.levelId
      ? rewards.unlockBadge(MASTER_BADGE.id, { source: `${GAME_ID}-completion` })
      : { duplicate: true };

    const detail = {
      gameId: GAME_ID,
      levelId,
      outcome,
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
    abandon,
    complete
  });
});
