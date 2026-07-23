(() => {
  'use strict';

  let games = Object.create(null);
  let stickers = Object.create(null);
  let badges = Object.create(null);

  const fetchJson = (url) => fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
  });

  const ready = Promise.all([
    fetchJson('./content/games/index.json'),
    fetchJson('./content/rewards/catalog.json')
  ])
    .then(([gameCatalog, rewardCatalog]) => {
      if (gameCatalog?.schemaVersion !== 1 || !Array.isArray(gameCatalog.games)) {
        throw new Error('Catalog trò chơi không hợp lệ');
      }
      if (rewardCatalog?.schemaVersion !== 1 || !Array.isArray(rewardCatalog.stickers) || !Array.isArray(rewardCatalog.badges)) {
        throw new Error('Catalog phần thưởng không hợp lệ');
      }
      games = Object.fromEntries(
        gameCatalog.games
          .filter((game) => typeof game?.id === 'string' && typeof game?.title === 'string')
          .map((game) => [game.id, {
            title: game.title.trim(),
            rewardsEnabled: game.rewardsEnabled === true
          }])
      );
      stickers = Object.fromEntries(rewardCatalog.stickers.map((item) => [item.id, item]));
      badges = Object.fromEntries(rewardCatalog.badges.map((item) => [item.id, item]));
      return { games, stickers, badges };
    })
    .catch((error) => {
      console.warn('[Bông Home] Không tải được catalog dùng chung', error);
      return { games, stickers, badges };
    });

  function getTitle(gameId) {
    return games[gameId]?.title || `Trò chơi ${String(gameId || '').replace('game', '')}`;
  }

  function hasRewards(gameId) {
    return games[gameId]?.rewardsEnabled === true;
  }

  function getSticker(id) {
    return stickers[id] || null;
  }

  function getBadge(id) {
    return badges[id] || null;
  }

  window.BongGameCatalog = Object.freeze({ ready, getTitle, hasRewards, getSticker, getBadge });
})();
