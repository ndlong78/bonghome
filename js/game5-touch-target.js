(() => {
  'use strict';

  const DOT_SELECTOR = '#lopDiem .diem';
  const HIT_CLASS = 'bh-game5-hit-target';
  const HIT_RADIUS = 26;

  function addHitTarget(dot) {
    if (!(dot instanceof SVGGElement) || dot.querySelector(`.${HIT_CLASS}`)) return;
    const visibleCircle = dot.querySelector('circle');
    if (!(visibleCircle instanceof SVGCircleElement)) return;

    const hitTarget = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hitTarget.classList.add(HIT_CLASS);
    hitTarget.setAttribute('cx', visibleCircle.getAttribute('cx') || '0');
    hitTarget.setAttribute('cy', visibleCircle.getAttribute('cy') || '0');
    hitTarget.setAttribute('r', String(HIT_RADIUS));
    hitTarget.setAttribute('aria-hidden', 'true');
    hitTarget.style.fill = 'transparent';
    hitTarget.style.stroke = 'none';
    hitTarget.style.transition = 'none';
    hitTarget.style.animation = 'none';
    hitTarget.style.pointerEvents = 'all';
    dot.insertBefore(hitTarget, visibleCircle);
  }

  function syncTouchTargets() {
    document.querySelectorAll(DOT_SELECTOR).forEach(addHitTarget);
  }

  function init() {
    const layer = document.getElementById('lopDiem');
    if (!layer) return;
    syncTouchTargets();
    const observer = new MutationObserver(syncTouchTargets);
    observer.observe(layer, { childList: true });
    window.BongGame5TouchTarget = Object.freeze({
      hitRadius: HIT_RADIUS,
      syncTouchTargets
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
