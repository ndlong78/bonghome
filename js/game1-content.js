(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root?.document) root.BongGame1ContentLoader = api;
})(typeof window !== 'undefined' ? window : globalThis, function createGame1ContentLoader() {
  'use strict';

  const CONTENT_URL = './content/games/game1.json';
  const SCHEMA_VERSION = 1;

  function validateContent(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.schemaVersion !== SCHEMA_VERSION || value.gameId !== 'game1') return null;
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

  function applyContent(root, content) {
    const valid = validateContent(content);
    if (!valid) throw new TypeError('Nội dung Game 1 không hợp lệ');

    root.BongGame1Content = valid;
    if (Array.isArray(root.KHO_HINH)) {
      root.KHO_HINH.splice(0, root.KHO_HINH.length, ...valid.cards.map((card) => card.svg));
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

    root.dispatchEvent(new CustomEvent('bonghome:game1contentready', { detail: { content: valid } }));
    return valid;
  }

  async function load(root, fetchImpl = root.fetch?.bind(root)) {
    if (!fetchImpl) throw new Error('Fetch không khả dụng');
    const response = await fetchImpl(CONTENT_URL, { cache: 'no-cache' });
    if (!response?.ok) throw new Error(`Không tải được nội dung Game 1: HTTP ${response?.status || 0}`);
    return applyContent(root, await response.json());
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    contentUrl: CONTENT_URL,
    validateContent,
    applyContent,
    load
  });
});
