(() => {
  'use strict';

  const MIN_GAME_ID = 1;
  const MAX_GAME_ID = 10;

  function normalizePathname(value) {
    let pathname = typeof value === 'string'
      ? value
      : globalThis.location?.pathname || '/';

    try {
      if (/^[a-z][a-z\d+.-]*:\/\//i.test(pathname)) pathname = new URL(pathname).pathname;
    } catch (error) {
      pathname = '/';
    }

    pathname = String(pathname || '/').split(/[?#]/, 1)[0];
    if (!pathname.startsWith('/')) pathname = `/${pathname}`;
    pathname = pathname.replace(/\/{2,}/g, '/');
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    return pathname || '/';
  }

  function getPageSlug(value) {
    const pathname = normalizePathname(value);
    if (pathname === '/' || /\/index(?:\.html)?$/i.test(pathname)) return 'home';
    const segment = pathname.split('/').filter(Boolean).at(-1) || '';
    return segment.toLowerCase().replace(/\.html$/i, '');
  }

  function getGameId(value) {
    const match = /^game(\d+)$/.exec(getPageSlug(value));
    if (!match) return null;
    const gameId = Number(match[1]);
    return gameId >= MIN_GAME_ID && gameId <= MAX_GAME_ID ? gameId : null;
  }

  function isGame(gameId, value) {
    return getGameId(value) === Number(gameId);
  }

  function isGameInRange(startGameId, endGameId, value) {
    const gameId = getGameId(value);
    return gameId !== null && gameId >= Number(startGameId) && gameId <= Number(endGameId);
  }

  function isHome(value) {
    return getPageSlug(value) === 'home';
  }

  function isParentPage(value) {
    return getPageSlug(value) === 'parents';
  }

  function isCollectionPage(value) {
    return getPageSlug(value) === 'collection';
  }

  const api = Object.freeze({
    normalizePathname,
    getGameId,
    isGame,
    isGameInRange,
    isHome,
    isParentPage,
    isCollectionPage
  });

  globalThis.BongRoutes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
