(() => {
  'use strict';

  const board = document.getElementById('sanBai');
  if (!board) return;

  function describeCard(card, index) {
    if (card.classList.contains('dung')) return `Lá bài ${index + 1}, đã ghép đúng`;
    if (card.classList.contains('lat')) return `Lá bài ${index + 1}, đang mở`;
    return `Lá bài ${index + 1}, đang úp`;
  }

  function syncCard(card, index) {
    const matched = card.classList.contains('dung');
    const flipped = card.classList.contains('lat');
    card.type = 'button';
    card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
    card.setAttribute('aria-label', describeCard(card, index));
    card.disabled = matched;
  }

  function syncAllCards() {
    board.querySelectorAll('.la-bai').forEach(syncCard);
  }

  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === 'childList' || record.attributeName === 'class')) {
      queueMicrotask(syncAllCards);
    }
  });

  observer.observe(board, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  board.addEventListener('click', () => queueMicrotask(syncAllCards));
  syncAllCards();

  window.BongGame1KeyboardAccessibility = Object.freeze({ syncAllCards });
})();
