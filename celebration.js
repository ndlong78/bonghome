(() => {
  'use strict';
  function confetti(count = 14) {
    const icons = ['✨','⭐','🌸','💛'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.textContent = icons[i % icons.length];
      Object.assign(el.style,{position:'fixed',zIndex:310,left:`${20+Math.random()*60}%`,top:'45%',fontSize:`${18+Math.random()*18}px`,pointerEvents:'none',transition:'transform 1s ease-out,opacity 1s ease-out'});
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.transform=`translate(${Math.random()*240-120}px,${Math.random()*-220-40}px) rotate(${Math.random()*300}deg)`; el.style.opacity='0'; });
      setTimeout(() => el.remove(),1100);
    }
  }
  function showSummary({minutes=0,classes=0,message='Bông đã hoàn thành một buổi chơi thật tốt.'}={}) {
    let root = document.getElementById('bhSummary');
    if (!root) { root=document.createElement('div'); root.id='bhSummary'; root.className='bh-summary'; root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true'); document.body.appendChild(root); }
    root.innerHTML=`<div class="bh-summary-card"><div style="font-size:52px">🌷</div><h2>Buổi chơi đã hoàn thành</h2><p>${message}</p><p><strong>${Math.max(1,Math.round(minutes))} phút</strong> · ${classes} lớp đã ghé</p><p style="color:#8d7595">Điều quan trọng là con đã tập trung và vui vẻ, không cần chạy theo tốc độ.</p><button class="bh-button" id="bhSummaryClose">Về trường nhỏ</button></div>`;
    root.hidden=false; confetti(); window.BongAudio?.success?.();
    root.querySelector('#bhSummaryClose').onclick=()=>{ root.hidden=true; location.href='./index.html'; };
  }
  window.BongCelebration={confetti,showSummary};
})();