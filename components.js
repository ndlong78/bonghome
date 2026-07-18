(() => {
  'use strict';

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function button({ label, icon = '', href = '', variant = 'primary', attrs = '' }) {
    const className = `bh-button${variant === 'secondary' ? ' bh-button--secondary' : variant === 'quiet' ? ' bh-button--quiet' : ''}`;
    const body = `${icon ? `<span aria-hidden="true">${escapeHtml(icon)}</span>` : ''}<span>${escapeHtml(label)}</span>`;
    return href
      ? `<a class="${className}" href="${escapeHtml(href)}" ${attrs}>${body}</a>`
      : `<button class="${className}" type="button" ${attrs}>${body}</button>`;
  }

  function card({ title, description = '', icon = '', content = '' }) {
    return `<article class="bh-card">${icon ? `<div aria-hidden="true">${escapeHtml(icon)}</div>` : ''}<h3 class="bh-card__title">${escapeHtml(title)}</h3>${description ? `<p class="bh-card__description">${escapeHtml(description)}</p>` : ''}${content}</article>`;
  }

  function badge(text, icon = '') {
    return `<span class="bh-badge">${icon ? `<span aria-hidden="true">${escapeHtml(icon)}</span>` : ''}${escapeHtml(text)}</span>`;
  }

  function announce(message) {
    let region = document.getElementById('bhLiveRegion');
    if (!region) {
      region = document.createElement('div');
      region.id = 'bhLiveRegion';
      region.className = 'bh-visually-hidden';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      document.body.appendChild(region);
    }
    region.textContent = '';
    requestAnimationFrame(() => { region.textContent = message; });
  }

  window.BongComponents = Object.freeze({ button, card, badge, announce, escapeHtml });
})();
