(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongModulesReady) {
    root.BongGame15RewardsReady = Promise.resolve(root.BongModulesReady)
      .then((modules) => (modules?.progress && modules?.rewards ? factory(modules.progress, modules.rewards, root) : null))
      .catch((error) => {
        console.warn('[Bông Home] Không bật được phần thưởng Game 15', error);
        return null;
      });
  }
})(typeof window !== 'undefined' ? window : globalThis, function createGame15Rewards(progress, rewards, root) {
  'use strict';

  root = root || null;
  if (!progress || !rewards) throw new Error('Game 15 rewards require progress and rewards modules');

  const GAME_ID = 'game15';
  const STICKER = Object.freeze({ id: 'happy-cloud', name: 'Đám mây vui', icon: '☁️' });
  const MASTER_BADGE = Object.freeze({ id: 'adventure-hero', name: 'Nhà phiêu lưu nhí', icon: '🗺️', levelId: 'troi-may' });

  function hashText(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function makeProgressTransactionId(levelId, runId) {
    if (typeof levelId !== 'string' || !/^[a-z0-9-]+$/.test(levelId)) throw new TypeError('levelId must be kebab-case');
    if (typeof runId !== 'string' || !runId) throw new TypeError('runId must be a non-empty string');
    return `${GAME_ID}-${levelId}-${hashText(runId)}`;
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

  /** Đánh dấu "đang chơi dở" cho Góc phụ huynh, chỉ lưu màn đang chơi. */
  function trackProgress({ levelId } = {}) {
    return progress.saveGame(GAME_ID, { difficulty: levelId || null, state: {} });
  }

  /** Bỏ dở màn chơi không tính là hoàn thành: chỉ gỡ trạng thái "đang chơi dở". */
  function abandon() {
    return progress.clearGame(GAME_ID);
  }

  /** Ghi nhận một lần Bông về tới nhà. Sao 1–3 theo số ngôi sao nhặt được trong màn. */
  function complete({ levelId, runId, stars, starsCollected, totalStars, durationSeconds } = {}) {
    const transactionId = makeProgressTransactionId(levelId, runId);
    const starCount = Math.min(3, Math.max(1, Number.isInteger(stars) ? stars : 1));
    const completion = progress.completeGame(GAME_ID, {
      transactionId,
      difficulty: levelId,
      durationSeconds,
      metadata: {
        starsCollected: Number.isInteger(starsCollected) ? starsCollected : null,
        totalStars: Number.isInteger(totalStars) ? totalStars : null
      }
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
    abandon,
    complete
  });
});
