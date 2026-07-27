(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  root.BongStatisticsFactory = factory;
})(typeof window !== 'undefined' ? window : globalThis, function createBongStatistics(progress) {
  'use strict';

  if (!progress?.listCompletions) throw new Error('BongStatistics requires BongProgress');

  const DAY_MS = 24 * 60 * 60 * 1000;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function readCompletions() {
    return progress.listCompletions()
      .filter((item) => item && typeof item === 'object');
  }

  function summarize(referenceDate = new Date()) {
    const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    if (Number.isNaN(now.getTime())) throw new TypeError('referenceDate must be valid');

    const completions = readCompletions();
    const validDates = completions
      .map((item) => ({ item, date: new Date(item.completedAt) }))
      .filter(({ date }) => !Number.isNaN(date.getTime()));
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - (6 * DAY_MS);
    const recent = validDates.filter(({ date }) => date.getTime() >= start && date.getTime() <= now.getTime());
    const durations = completions.map((item) => item.durationSeconds).filter(Number.isFinite);
    const moves = completions.map((item) => item.moves).filter(Number.isFinite);
    const latest = validDates.sort((a, b) => b.date - a.date)[0]?.date || null;

    return {
      schemaVersion: 1,
      last7DaysCompleted: recent.length,
      latestCompletedAt: latest ? latest.toISOString() : null,
      averageDurationSeconds: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
      averageMoves: moves.length ? Math.round(moves.reduce((sum, value) => sum + value, 0) / moves.length) : null,
      totalCompleted: completions.length,
      completions: clone(completions)
    };
  }

  return Object.freeze({ schemaVersion: 1, summarize });
});