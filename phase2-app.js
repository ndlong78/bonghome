(() => {
  'use strict';
  const isHome = /(^|\/)index\.html$/.test(location.pathname) || location.pathname.endsWith('/');
  const gameMatch = location.pathname.match(/game(10|[1-9])\.html$/);
  const params = new URLSearchParams(location.search);
  const SESSION_KEY = 'bonghome_active_session';

  function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); } catch { return null; } }
  function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function startSession(minutes) {
    const profile = window.BongStorage.getActiveProfile();
    const session = { id:`s-${Date.now()}`, profileId:profile.id, startedAt:Date.now(), durationMinutes:minutes, visited:[], completed:[] };
    saveSession(session);
    location.href=`./game1.html?session=${session.id}`;
  }

  function renderHomeControls() {
    const host = document.querySelector('.khung') || document.body;
    const panel = document.createElement('section');
    panel.className='bh-panel'; panel.style.margin='0 auto 28px'; panel.style.maxWidth='760px';
    panel.innerHTML=`<h2 style="margin-top:0">🌸 Hồ sơ chơi</h2><div id="bhProfiles" class="bh-profile-list"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="bh-button" id="bhAddProfile">Thêm hồ sơ</button><a class="bh-button" href="./parent.html">Trang phụ huynh</a></div><hr style="border:0;border-top:2px dashed #ffd6e0;margin:18px 0"><h2>⏱ Chọn buổi chơi</h2><p>Chơi thong thả, nghỉ khi mỏi mắt hoặc mất tập trung.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="bh-button" data-min="15">Chơi 15 phút</button><button class="bh-button" data-min="20">Chơi 20 phút</button></div><h2>🗺 Bản đồ 10 lớp</h2><div class="bh-progress" id="bhProgress"></div>`;
    const firstGrid = document.querySelector('.san-truong');
    firstGrid?.parentNode.insertBefore(panel, firstGrid);
    if (!firstGrid) host.appendChild(panel);

    function draw() {
      const state=window.BongStorage.getState(); const active=state.activeProfileId;
      panel.querySelector('#bhProfiles').innerHTML=state.profiles.map(p=>`<button class="bh-profile ${p.id===active?'active':''}" data-profile="${p.id}">${p.avatar} ${p.name}</button>`).join('');
      const progress=window.BongStorage.getProgress(active);
      panel.querySelector('#bhProgress').innerHTML=Array.from({length:10},(_,i)=>{const n=i+1,d=progress[n];return `<div class="bh-step ${d?.completed?'done':''}"><strong>Lớp ${n}</strong><br><span>${d?.completed?'✅ Đã chơi':'○ Chưa chơi'}</span></div>`}).join('');
    }
    panel.addEventListener('click',e=>{
      const p=e.target.closest('[data-profile]'); if(p){window.BongStorage.setActiveProfile(p.dataset.profile);draw();return;}
      const m=e.target.closest('[data-min]'); if(m){startSession(Number(m.dataset.min));return;}
      if(e.target.id==='bhAddProfile'){const name=prompt('Tên hồ sơ mới');if(name){try{window.BongStorage.addProfile(name,'⭐');draw();}catch(err){alert(err.message);}}}
    });
    draw();
  }

  function renderGameSession() {
    const game=Number(gameMatch[1]);
    window.BongStorage.markClass(game,{completed:true});
    let session=loadSession();
    if(!session) return;
    if(!session.visited.includes(game)) session.visited.push(game);
    if(!session.completed.includes(game)) session.completed.push(game);
    saveSession(session);

    const badge=document.createElement('div'); badge.className='bh-session bh-panel';
    const timer=document.createElement('span'); const end=document.createElement('button'); end.className='bh-button'; end.textContent='Kết thúc buổi chơi';
    badge.append('🌷 ',timer,end); document.body.appendChild(badge);
    const tick=()=>{
      session=loadSession(); if(!session)return;
      const elapsed=Date.now()-session.startedAt; const remaining=Math.max(0,session.durationMinutes*60000-elapsed);
      const mm=Math.floor(remaining/60000);const ss=Math.floor((remaining%60000)/1000);timer.textContent=`${mm}:${String(ss).padStart(2,'0')}`;
      if(remaining<=0) finish('Đã đủ thời gian rồi. Bông có thể nghỉ ngơi nhé.');
    };
    function finish(message){
      const current=loadSession(); if(!current)return;
      const minutes=(Date.now()-current.startedAt)/60000;
      window.BongStorage.saveSession({...current,minutes,classes:current.completed.length}); clearSession();
      window.BongCelebration.showSummary({minutes,classes:current.completed.length,message});
    }
    end.onclick=()=>finish('Bông đã dừng đúng lúc và hoàn thành một buổi chơi thật tốt.');
    tick(); setInterval(tick,1000);
  }

  document.addEventListener('DOMContentLoaded',()=>{ if(isHome)renderHomeControls(); if(gameMatch)renderGameSession(); });
})();