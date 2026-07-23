(() => {
  'use strict';

  const AVATAR_ICONS = Object.freeze({
    flower: '🌸', rabbit: '🐰', bunny: '🐰', cat: '🐱', bear: '🐻', rainbow: '🌈', star: '⭐'
  });

  const isParentPage = (pathname) => /\/parents\.html$/.test(pathname || '');

  function formatProgress(count, isInProgress) {
    if (isInProgress && count) return `${count} lượt hoàn thành · đang chơi dở`;
    if (isInProgress) return 'Đang chơi dở';
    return `${count} lượt hoàn thành`;
  }

  function formatRewardSummary(gameId, reward, catalog) {
    if (!catalog?.hasRewards?.(gameId)) return '🎁 Phần thưởng chưa áp dụng';

    const parts = [];
    if (reward?.stars) parts.push(`⭐ ${reward.stars} sao`);
    (reward?.stickerIds || []).forEach((id) => {
      const item = catalog?.getSticker?.(id);
      parts.push(item ? `${item.icon} ${item.name}` : `🎁 ${id}`);
    });
    (reward?.badgeIds || []).forEach((id) => {
      const item = catalog?.getBadge?.(id);
      parts.push(item ? `${item.icon} ${item.name}` : `🏅 ${id}`);
    });
    return parts.length ? parts.join(' · ') : '🎁 Chưa ghi nhận phần thưởng';
  }

  function renderGameSummary(container, byGame, games, catalog, rewardsByGame) {
    container.textContent = '';
    const completed = byGame || {};
    const inProgress = games || {};
    const rewardSummary = rewardsByGame || {};
    const gameIds = [...new Set([...Object.keys(completed), ...Object.keys(inProgress), ...Object.keys(rewardSummary)])]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (!gameIds.length) {
      const empty = document.createElement('p');
      empty.className = 'bh-parent-empty';
      empty.textContent = 'Chưa có hoạt động nào được lưu trên thiết bị này.';
      container.appendChild(empty);
      return;
    }

    gameIds.forEach((gameId) => {
      const count = completed[gameId] || 0;
      const row = document.createElement('article');
      row.className = 'bh-parent-game-row';

      const header = document.createElement('div');
      header.className = 'bh-parent-game-main';
      const name = document.createElement('strong');
      name.className = 'bh-parent-game-name';
      name.textContent = catalog?.getTitle?.(gameId) || `Trò chơi ${gameId.replace('game', '')}`;
      const progress = document.createElement('span');
      progress.className = 'bh-parent-game-progress';
      progress.textContent = formatProgress(count, Boolean(inProgress[gameId]));
      header.append(name, progress);

      const reward = document.createElement('p');
      reward.className = 'bh-parent-game-rewards';
      reward.textContent = formatRewardSummary(gameId, rewardSummary[gameId], catalog);

      row.append(header, reward);
      container.appendChild(row);
    });
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return 'Chưa có';
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return minutes ? `${minutes} phút ${remaining} giây` : `${remaining} giây`;
  }

  function formatDate(value) {
    if (!value) return 'Chưa có';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Chưa có' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
  }

  async function render(modules) {
    const profile = modules.profile?.getProfile?.() || { displayName: 'Bông', avatarId: 'flower' };
    const progress = modules.progress?.getSummary?.() || { completed: 0, inProgress: 0, byGame: {}, games: {} };
    const rewards = modules.rewards?.getSummary?.() || { stars: 0, stickerIds: [], badgeIds: [] };
    const rewardsByGame = modules.rewards?.getByGameSummary?.() || {};
    const statistics = window.BongStatisticsFactory && modules.storage
      ? window.BongStatisticsFactory(modules.storage).summarize()
      : { last7DaysCompleted: 0, latestCompletedAt: null, averageDurationSeconds: null, averageMoves: null };
    const catalog = window.BongGameCatalog;
    await catalog?.ready;

    document.getElementById('parentAvatar').textContent = AVATAR_ICONS[profile.avatarId] || AVATAR_ICONS.flower;
    document.getElementById('parentName').textContent = profile.displayName || 'Bông';
    document.getElementById('completedCount').textContent = String(progress.completed || 0);
    document.getElementById('inProgressCount').textContent = String(progress.inProgress || 0);
    document.getElementById('starCount').textContent = String(rewards.stars || 0);
    document.getElementById('collectionCount').textContent = String((rewards.stickerIds?.length || 0) + (rewards.badgeIds?.length || 0));
    document.getElementById('recentCount').textContent = String(statistics.last7DaysCompleted || 0);
    document.getElementById('latestActivity').textContent = formatDate(statistics.latestCompletedAt);
    document.getElementById('averageDuration').textContent = formatDuration(statistics.averageDurationSeconds);
    document.getElementById('averageMoves').textContent = Number.isFinite(statistics.averageMoves) ? `${statistics.averageMoves} lượt` : 'Chưa có';
    renderGameSummary(document.getElementById('gameSummary'), progress.byGame, progress.games, catalog, rewardsByGame);
  }

  if (!isParentPage(window.location.pathname)) return;
  window.BongModulesReady
    .then(render)
    .catch((error) => {
      console.error('[Bông Home] Không tải được Góc phụ huynh', error);
      render({});
    });

  window.BongParentDashboard = Object.freeze({
    isParentPage,
    renderGameSummary,
    formatProgress,
    formatRewardSummary,
    formatDuration,
    formatDate
  });
})();
