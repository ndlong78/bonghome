(() => {
  'use strict';

  const AVATAR_ICONS = Object.freeze({
    flower: '🌸', rabbit: '🐰', bunny: '🐰', cat: '🐱', bear: '🐻', rainbow: '🌈', star: '⭐'
  });

  const isParentPage = (pathname) => /\/parents\.html$/.test(pathname || '');

  function renderGameSummary(container, byGame) {
    container.textContent = '';
    const entries = Object.entries(byGame || {}).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'bh-parent-empty';
      empty.textContent = 'Chưa có lượt hoàn thành nào trên thiết bị này.';
      container.appendChild(empty);
      return;
    }
    entries.forEach(([gameId, count]) => {
      const row = document.createElement('div');
      row.className = 'bh-parent-game-row';
      const name = document.createElement('span');
      name.textContent = `Trò chơi ${gameId.replace('game', '')}`;
      const value = document.createElement('strong');
      value.textContent = `${count} lượt`;
      row.append(name, value);
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

  function render(modules) {
    const profile = modules.profile?.getProfile?.() || { displayName: 'Bông', avatarId: 'flower' };
    const progress = modules.progress?.getSummary?.() || { completed: 0, inProgress: 0, byGame: {} };
    const rewards = modules.rewards?.getSummary?.() || { stars: 0, stickerIds: [], badgeIds: [] };
    const statistics = window.BongStatisticsFactory && modules.storage
      ? window.BongStatisticsFactory(modules.storage).summarize()
      : { last7DaysCompleted: 0, latestCompletedAt: null, averageDurationSeconds: null, averageMoves: null };

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
    renderGameSummary(document.getElementById('gameSummary'), progress.byGame);
  }

  if (!isParentPage(window.location.pathname)) return;
  window.BongModulesReady
    .then(render)
    .catch((error) => {
      console.error('[Bông Home] Không tải được Góc phụ huynh', error);
      render({});
    });

  window.BongParentDashboard = Object.freeze({ isParentPage, renderGameSummary, formatDuration, formatDate });
})();