(() => {
  'use strict';

  const AVATAR_ICONS = Object.freeze({
    flower: '🌸', rabbit: '🐰', cat: '🐱', bear: '🐻', rainbow: '🌈', star: '⭐'
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

  function render(modules) {
    const profile = modules.profile?.getProfile?.() || { displayName: 'Bông', avatarId: 'flower' };
    const progress = modules.progress?.getSummary?.() || { completed: 0, inProgress: 0, byGame: {} };
    const rewards = modules.rewards?.getSummary?.() || { stars: 0, stickerIds: [], badgeIds: [] };

    document.getElementById('parentAvatar').textContent = AVATAR_ICONS[profile.avatarId] || AVATAR_ICONS.flower;
    document.getElementById('parentName').textContent = profile.displayName || 'Bông';
    document.getElementById('completedCount').textContent = String(progress.completed || 0);
    document.getElementById('inProgressCount').textContent = String(progress.inProgress || 0);
    document.getElementById('starCount').textContent = String(rewards.stars || 0);
    document.getElementById('collectionCount').textContent = String((rewards.stickerIds?.length || 0) + (rewards.badgeIds?.length || 0));
    renderGameSummary(document.getElementById('gameSummary'), progress.byGame);
  }

  if (!isParentPage(window.location.pathname)) return;
  window.BongModulesReady
    .then(render)
    .catch((error) => {
      console.error('[Bông Home] Không tải được Góc phụ huynh', error);
      render({});
    });

  window.BongParentDashboard = Object.freeze({ isParentPage, renderGameSummary });
})();
