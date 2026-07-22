(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root?.document) root.BongGame1ContentLoader = api;
})(typeof window !== 'undefined' ? window : globalThis, function createGame1ContentLoader() {
  'use strict';

  const CONTENT_URLS = Object.freeze({
    'bong-home': './content/games/game1.json',
    animals: './content/games/game1-animals.json'
  });
  const SCHEMA_VERSION = 1;

  function resolveContentUrl(themeId) {
    return CONTENT_URLS[themeId] || CONTENT_URLS['bong-home'];
  }

  function validateContent(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.schemaVersion !== SCHEMA_VERSION || value.gameId !== 'game1') return null;
    if (value.themeId != null && (typeof value.themeId !== 'string' || !value.themeId.trim())) return null;
    if (typeof value.title !== 'string' || !value.title.trim()) return null;
    if (typeof value.instruction !== 'string' || !value.instruction.trim()) return null;
    if (!Array.isArray(value.difficulties) || value.difficulties.length !== 3) return null;
    if (!Array.isArray(value.cards) || value.cards.length !== 12) return null;

    const pairCounts = new Set();
    for (const level of value.difficulties) {
      if (!Number.isInteger(level?.pairs) || level.pairs < 1 || pairCounts.has(level.pairs)) return null;
      if (typeof level.label !== 'string' || typeof level.ariaLabel !== 'string') return null;
      pairCounts.add(level.pairs);
    }
    if (![3, 6, 12].every((pairs) => pairCounts.has(pairs))) return null;

    const ids = new Set();
    for (const card of value.cards) {
      if (!card || typeof card !== 'object') return null;
      if (typeof card.id !== 'string' || !card.id || ids.has(card.id)) return null;
      if (typeof card.name !== 'string' || !card.name.trim()) return null;
      if (typeof card.svg !== 'string' || !/^<svg[\s>]/.test(card.svg.trim())) return null;
      ids.add(card.id);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function applyContent(root, content, requestedThemeId = 'bong-home') {
    const valid = validateContent(content);
    if (!valid) throw new TypeError('Nội dung Game 1 không hợp lệ');
    valid.themeId = valid.themeId || requestedThemeId || 'bong-home';

    root.BongGame1Content = valid;
    if (typeof KHO_HINH !== 'undefined' && Array.isArray(KHO_HINH)) {
      KHO_HINH.splice(0, KHO_HINH.length, ...valid.cards.map((card) => card.svg));
    }

    const title = root.document.querySelector('.thanh-tren h1');
    if (title) title.textContent = valid.title;
    const instruction = root.document.querySelector('.huong-dan');
    if (instruction) instruction.textContent = valid.instruction;

    const group = root.document.getElementById('mucDo');
    if (group) {
      group.setAttribute('aria-label', valid.difficultyAriaLabel || 'Chọn mức độ');
      const buttons = group.querySelectorAll('button');
      valid.difficulties.forEach((level, index) => {
        const button = buttons[index];
        if (!button) return;
        button.dataset.cap = String(level.pairs);
        button.textContent = level.label;
        button.setAttribute('aria-label', level.ariaLabel);
      });
    }

    if (root.CustomEvent) {
      root.dispatchEvent(new root.CustomEvent('bonghome:game1contentready', {
        detail: { content: valid, themeId: valid.themeId }
      }));
    }
    return valid;
  }

  async function load(root, fetchImpl = root.fetch?.bind(root), themeId = root.BongThemes?.getActiveTheme()?.id || 'bong-home') {
    if (!fetchImpl) throw new Error('Fetch không khả dụng');
    const contentUrl = resolveContentUrl(themeId);
    const response = await fetchImpl(contentUrl, { cache: 'no-cache' });
    if (!response?.ok) throw new Error(`Không tải được nội dung Game 1: HTTP ${response?.status || 0}`);
    return applyContent(root, await response.json(), themeId);
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    contentUrls: CONTENT_URLS,
    resolveContentUrl,
    validateContent,
    applyContent,
    load
  });
});
