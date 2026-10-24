(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.BongModulesReady) {
    root.BongGame11RewardsReady = Promise.resolve(root.BongModulesReady)
      .then((modules) => (modules?.progress && modules?.rewards ? factory(modules.progress, modules.rewards, root) : null))
      .catch((error) => {
        console.warn('[Bông Home] Không bật được phần thưởng Game 11', error);
        return null;
      });
  }
})(typeof window !== 'undefined' ? window : globalThis, function createGame11Rewards(progress, rewards, root) {
  'use strict';

  root = root || null;
  if (!progress || !rewards) throw new Error('Game 11 rewards require progress and rewards modules');

  const GAME_ID = 'game11';
  const DIFFICULTY = 'endless';
  const STICKER = Object.freeze({ id: 'block-builder', name: 'Thợ xây khối nhí', icon: '🧱' });
  const MASTER_BADGE = Object.freeze({ id: 'block-master', name: 'Kiến trúc sư khối', icon: '🏗️', minLines: 10 });

  function hashText(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function makeProgressTransactionId(roundId) {
    if (typeof roundId !== 'string' || !roundId) throw new TypeError('roundId must be a non-empty string');
    return `${GAME_ID}-${DIFFICULTY}-${hashText(roundId)}`;
  }

  function makeRewardTransactionId(progressTransactionId) {
    if (typeof progressTransactionId !== 'string' || !progressTransactionId) {
      throw new TypeError('Progress transactionId must be a non-empty string');
    }
    return `${GAME_ID}-reward-${hashText(progressTransactionId)}`;
  }

  /** Sao theo số hàng đã dọn trong một bàn: 1-3 hàng → 1, 4-9 → 2, từ 10 → 3. */
  function starsForLines(lines) {
    if (lines >= MASTER_BADGE.minLines) return 3;
    if (lines >= 4) return 2;
    return 1;
  }

  function rewardLines(detail) {
    const lines = [`⭐ Bé nhận ${detail.stars} sao`];
    if (detail.newSticker) lines.push(`${STICKER.icon} Sticker mới: ${STICKER.name}`);
    if (detail.newBadge) lines.push(`${MASTER_BADGE.icon} Huy hiệu mới: ${MASTER_BADGE.name}`);
    return lines;
  }

  /**
   * Ghi nhận một bàn đã kết thúc. Game chơi liên tục nên bàn chỉ tính là hoàn thành khi
   * bé dọn được ít nhất một hàng; bàn trắng trả về null và không ghi gì.
   */
  function complete({ roundId, lines, score, pieces, durationSeconds } = {}) {
    const clearedLines = Number.isInteger(lines) && lines > 0 ? lines : 0;
    if (!clearedLines) return null;
    const transactionId = makeProgressTransactionId(roundId);
    const stars = starsForLines(clearedLines);
    const completion = progress.completeGame(GAME_ID, {
      transactionId,
      difficulty: DIFFICULTY,
      durationSeconds,
      moves: Number.isInteger(pieces) ? pieces : null,
      metadata: { lines: clearedLines, score: Number.isInteger(score) ? score : null }
    });

    const rewardResult = rewards.awardStars(
      makeRewardTransactionId(transactionId),
      stars,
      { gameId: GAME_ID, progressTransactionId: transactionId, lines: clearedLines }
    );
    const stickerResult = rewards.unlockSticker(STICKER.id, { source: `${GAME_ID}-completion` });
    const badgeResult = clearedLines >= MASTER_BADGE.minLines
      ? rewards.unlockBadge(MASTER_BADGE.id, { source: `${GAME_ID}-completion` })
      : { duplicate: true };

    const detail = {
      gameId: GAME_ID,
      lines: clearedLines,
      duplicate: Boolean(completion?.duplicate || rewardResult.duplicate),
      stars,
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
    starsForLines,
    rewardLines,
    complete
  });
});
