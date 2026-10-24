(() => {
  'use strict';

  const AVATAR_ICONS = Object.freeze({
    flower: '🌸', rabbit: '🐰', bunny: '🐰', cat: '🐱', bear: '🐻', rainbow: '🌈', star: '⭐'
  });

  const FALLBACK_ROUTES = Object.freeze({
    isParentPage(pathname) {
      return /\/parents\.html$/.test(pathname || '');
    }
  });
  const getRoutes = () => window.BongRoutes || FALLBACK_ROUTES;
  const isParentPage = (pathname) => getRoutes().isParentPage(pathname);

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

  /** Các cảnh báo về bộ nhớ thiết bị mà phụ huynh cần biết (trả về mảng câu). */
  function describeStorageHealth(health) {
    if (!health) return [];
    const messages = [];
    if (health.recoveryMode === 'write-failed' || health.pendingWrite) {
      messages.push('⚠️ Thiết bị đang từ chối lưu dữ liệu (có thể do đầy bộ nhớ). Tiến độ mới chỉ được giữ tới khi đóng ứng dụng — hãy giải phóng dung lượng rồi mở lại.');
    } else if (health.recoveryMode === 'storage-unavailable') {
      messages.push('⚠️ Trình duyệt đang chặn bộ nhớ (ví dụ chế độ riêng tư). Tiến độ sẽ không được lưu sau khi đóng ứng dụng.');
    } else if (health.recoveryMode === 'future-schema') {
      messages.push('⚠️ Dữ liệu trên máy được tạo bởi phiên bản mới hơn. Ứng dụng đang chạy tạm và không ghi đè dữ liệu đó — hãy cập nhật ứng dụng.');
    } else if (health.recoveryMode === 'corrupt-json-unsaved') {
      messages.push('⚠️ Dữ liệu của bé bị hỏng và chưa sao lưu được. Ứng dụng đang chạy tạm, không ghi đè dữ liệu gốc.');
    }
    const backups = Array.isArray(health.backupKeys) ? health.backupKeys : [];
    if (backups.length) {
      messages.push(`🛟 Đã phát hiện dữ liệu bị hỏng và giữ ${backups.length} bản sao lưu trên thiết bị (khóa "${backups[backups.length - 1]}"). Bản sao này bị xóa cùng lệnh "Xóa toàn bộ dữ liệu của bé".`);
    }
    return messages;
  }

  function renderStorageHealth(container, health) {
    if (!container) return;
    const messages = describeStorageHealth(health);
    container.textContent = '';
    messages.forEach((message) => {
      const line = document.createElement('p');
      line.textContent = message;
      container.appendChild(line);
    });
    container.hidden = !messages.length;
  }

  async function render(modules) {
    const profile = modules.profile?.getProfile?.() || { displayName: 'Bông', avatarId: 'flower' };
    const progress = modules.progress?.getSummary?.() || { completed: 0, inProgress: 0, byGame: {}, games: {} };
    const rewards = modules.rewards?.getSummary?.() || { stars: 0, stickerIds: [], badgeIds: [] };
    const rewardsByGame = modules.rewards?.getByGameSummary?.() || {};
    const statistics = window.BongStatisticsFactory && modules.progress?.listCompletions
      ? window.BongStatisticsFactory(modules.progress).summarize()
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
    renderStorageHealth(document.getElementById('storageHealth'), modules.storage?.getHealth?.());
  }

  function start() {
    if (!isParentPage(window.location.pathname)) return null;
    return window.BongModulesReady
      .then(render)
      .catch((error) => {
        console.error('[Bông Home] Không tải được Góc phụ huynh', error);
        return render({});
      });
  }

  Promise.resolve(window.BongRoutesReady)
    .catch((error) => console.warn('[Bông Home] Dùng nhận dạng trang dự phòng cho Góc phụ huynh', error))
    .then(start);

  window.BongParentDashboard = Object.freeze({
    isParentPage,
    renderGameSummary,
    formatProgress,
    formatRewardSummary,
    formatDuration,
    formatDate,
    describeStorageHealth
  });
})();