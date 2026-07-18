(() => {
  'use strict';
  const assets = ['storage.js','audio.js','celebration.js','phase2-app.js'];
  const css = document.createElement('link'); css.rel='stylesheet'; css.href='./common.css'; document.head.appendChild(css);
  let chain = Promise.resolve();
  assets.forEach(src => { chain = chain.then(() => new Promise((resolve,reject)=>{ const s=document.createElement('script'); s.src=`./${src}`; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); })); });

  function updateDifficultyAria(root=document){
    root.querySelectorAll('.muc-do').forEach(group=>{
      group.setAttribute('role','group'); if(!group.hasAttribute('aria-label')) group.setAttribute('aria-label','Chọn mức độ');
      group.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',button.classList.contains('dang-chon')?'true':'false'));
    });
  }
  function improveDialogs(){
    document.querySelectorAll('.man-thang').forEach((dialog,index)=>{
      dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true');
      const heading=dialog.querySelector('h2'); if(heading){heading.id ||= `tieuDeThang${index||''}`; dialog.setAttribute('aria-labelledby',heading.id);}
      const desc=dialog.querySelector('.loi'); if(desc){desc.id ||= `loiKhen${index||''}`; dialog.setAttribute('aria-describedby',desc.id);}
    });
  }
  function addSoundButton(){
    if(document.getElementById('nutAmThanh'))return;
    const button=document.createElement('button'); button.id='nutAmThanh'; button.className='nut-am-thanh bh-button'; button.type='button';
    const render=()=>{const on=window.BongAudio?.isEnabled?.() ?? true; button.textContent=on?'🔊 Âm thanh':'🔇 Im lặng'; button.setAttribute('aria-pressed',on?'true':'false'); button.setAttribute('aria-label',on?'Tắt âm thanh':'Bật âm thanh');};
    button.addEventListener('click',()=>{window.BongAudio?.toggle?.();render();}); window.addEventListener('bonghome:soundchange',render); render(); document.body.appendChild(button);
  }
  navigator.serviceWorker?.addEventListener('message',event=>{
    const badge=document.getElementById('huyHieu'); if(!badge)return; const message=event.data||{};
    if(message.type==='CACHE_READY'){badge.textContent='✅ Đã sẵn sàng — chơi được cả khi không có mạng';badge.className='huy-hieu hien';}
    if(message.type==='CACHE_FAILED'){badge.textContent=`⚠️ Chưa tải đủ ${message.failed?.length||1} tệp — hãy mở lại khi có mạng`;badge.className='huy-hieu hien dang-tai';}
  });
  document.addEventListener('click',event=>{const button=event.target.closest('.muc-do button');if(button)queueMicrotask(()=>updateDifficultyAria(button.closest('.muc-do')));});
  document.addEventListener('DOMContentLoaded',()=>{chain.then(()=>{addSoundButton();updateDifficultyAria();improveDialogs();});});
})();