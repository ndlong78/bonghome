(() => {
  'use strict';
  const KEY = 'bonghome_phase2';
  const defaults = () => ({
    activeProfileId: 'bong',
    profiles: [{ id: 'bong', name: 'Bông', avatar: '🌸', createdAt: Date.now() }],
    progress: { bong: {} },
    sessions: []
  });
  const read = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
      return parsed && Array.isArray(parsed.profiles) ? parsed : defaults();
    } catch { return defaults(); }
  };
  const write = (data) => localStorage.setItem(KEY, JSON.stringify(data));
  const mutate = (fn) => { const data = read(); fn(data); write(data); return data; };
  const api = {
    getState: read,
    getProfiles: () => read().profiles,
    getActiveProfile: () => { const s = read(); return s.profiles.find(p => p.id === s.activeProfileId) || s.profiles[0]; },
    addProfile(name, avatar = '⭐') {
      const clean = String(name || '').trim().slice(0, 24);
      if (!clean) throw new Error('Tên hồ sơ không hợp lệ');
      return mutate(s => { const id = `p-${Date.now()}`; s.profiles.push({ id, name: clean, avatar, createdAt: Date.now() }); s.progress[id] = {}; s.activeProfileId = id; });
    },
    setActiveProfile(id) { return mutate(s => { if (s.profiles.some(p => p.id === id)) s.activeProfileId = id; }); },
    markClass(game, detail = {}) {
      return mutate(s => {
        const id = s.activeProfileId;
        s.progress[id] ||= {};
        const key = String(game);
        const prev = s.progress[id][key] || { plays: 0 };
        s.progress[id][key] = { ...prev, ...detail, plays: prev.plays + 1, lastPlayedAt: Date.now(), completed: detail.completed ?? true };
      });
    },
    getProgress(profileId) { const s = read(); return s.progress[profileId || s.activeProfileId] || {}; },
    saveSession(session) { return mutate(s => { s.sessions.unshift({ ...session, profileId: s.activeProfileId, endedAt: Date.now() }); s.sessions = s.sessions.slice(0, 100); }); },
    getSessions(profileId) { const s = read(); return s.sessions.filter(x => !profileId || x.profileId === profileId); }
  };
  write(read());
  window.BongStorage = api;
})();