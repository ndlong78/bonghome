(() => {
  'use strict';

  let titles = Object.create(null);

  const ready = fetch('./content/games/index.json')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((catalog) => {
      if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.games)) {
        throw new Error('Catalog trò chơi không hợp lệ');
      }
      titles = Object.fromEntries(
        catalog.games
          .filter((game) => typeof game?.id === 'string' && typeof game?.title === 'string')
          .map((game) => [game.id, game.title.trim()])
      );
      return titles;
    })
    .catch((error) => {
      console.warn('[Bông Home] Không tải được tên trò chơi', error);
      return titles;
    });

  function getTitle(gameId) {
    return titles[gameId] || `Trò chơi ${String(gameId || '').replace('game', '')}`;
  }

  window.BongGameCatalog = Object.freeze({ ready, getTitle });
})();
