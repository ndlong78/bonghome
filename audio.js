(() => {
  'use strict';
  const KEY = 'bonghome_sound_enabled';
  let context = null;
  const enabled = () => localStorage.getItem(KEY) !== 'false';
  function setEnabled(value) {
    localStorage.setItem(KEY, value ? 'true' : 'false');
    if (!value && 'speechSynthesis' in window) speechSynthesis.cancel();
    window.dispatchEvent(new CustomEvent('bonghome:soundchange', { detail: { enabled: value } }));
  }
  function getContext() {
    if (!enabled()) return null;
    if (!context) { const A = window.AudioContext || window.webkitAudioContext; if (A) context = new A(); }
    if (context?.state === 'suspended') context.resume();
    return context;
  }
  function tone(freq = 440, duration = .2, delay = 0, volume = .12) {
    const ctx = getContext(); if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .02); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain).connect(ctx.destination); osc.start(start); osc.stop(start + duration + .05);
  }
  function success() { [523,659,784].forEach((f,i) => tone(f,.22,i*.1,.1)); }
  window.BongAudio = { isEnabled: enabled, setEnabled, toggle: () => setEnabled(!enabled()), getContext, tone, success };
  window.BongSound = window.BongAudio;
})();