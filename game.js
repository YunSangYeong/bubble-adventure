(() => {
'use strict';
const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const W = 800, H = 480, FLOOR = 448, GRAVITY = 1100, STEP = 1 / 120;
const palettes = [['#152e45','#214559','#67bc9a'],['#262e4b','#384c66','#81b9b0'],['#263449','#345a62','#b1c886'],['#382e4e','#514963','#d3a4bc'],['#243347','#3b5a65','#e2bf7f']];
// Platforms are one-way: every vertical rise is <= 90px (jump apex ~110px).
const maps = [
 [[110,362,210],[470,362,210],[290,276,220]],
 [[35,362,175],[300,362,180],[590,362,175],[165,276,175],[460,276,175],[315,190,170]],
 [[75,362,190],[535,362,190],[280,318,240],[95,232,180],[525,232,180],[300,146,200]],
 [[30,362,165],[245,362,145],[440,362,145],[630,362,140],[140,276,170],[490,276,170],[315,190,170]],
 [[20,362,180],[310,362,180],[600,362,180],[155,276,180],[465,276,180],[305,190,190],[30,190,150],[620,190,150]]
];
let state = 'title', level = 0, score = 0, lives = 3, best = 0, player, enemies = [], bubbles = [], particles = [], platforms = [], elapsed = 0, transition = 0, muted = false, audio;
try { best = Number(localStorage.getItem('donggulbari-best')) || 0; } catch (_) {}
const keyboard = new Set(), touches = new Map();
const keys = {ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump',KeyZ:'fire',KeyJ:'fire'};
let jumpQueued = false, fireQueued = false, fireCooldown = 0;
const held = action => [...keyboard].some(k => keys[k] === action) || [...touches.values()].includes(action);
function clearInput() { keyboard.clear(); touches.clear(); jumpQueued = false; fireQueued = false; document.querySelectorAll('[data-action]').forEach(b => b.classList.remove('active')); }
function sound(type) {
 if (muted || !audio) return;
 const tones = {fire:[540,880,.09],pop:[980,360,.13],hit:[170,65,.24],jump:[260,520,.1],win:[480,960,.32]};
 try { const [a,b,d] = tones[type], o = audio.createOscillator(), g = audio.createGain(); o.type = type === 'hit' ? 'sawtooth' : 'square'; o.frequency.setValueAtTime(a,audio.currentTime); o.frequency.exponentialRampToValueAtTime(b,audio.currentTime+d); g.gain.setValueAtTime(.045,audio.currentTime); g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d); o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime+d); } catch (_) {}
}
function activateAudio() { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(()=>{}); } catch (_) {} }
function saveBest() { if (score > best) { best = score; try { localStorage.setItem('donggulbari-best', String(best)); } catch (_) {} } }
function hud() { $('stage').textContent = `${level+1} / 5`; $('lives').textContent = '♥ '.repeat(lives).trim() || '—'; $('score').textContent = score.toLocaleString('ko-KR'); $('remaining').textContent = enemies.length; $('best').textContent = best.toLocaleString('ko-KR'); }
function loadStage() {
 platforms = [{x:0,y:FLOOR,w:W,h:32}, ...maps[level].map(([x,y,w])=>({x,y,w,h:16}))];
 player = {x:45,y:FLOOR-30,w:26,h:30,vx:0,vy:0,dir:1,grounded:true,invulnerable:1.6};
 enemies = []; bubbles = []; particles = []; transition = 0; fireCooldown = 0; clearInput();
 const count = 3 + level;
 for (let i=0;i<count;i++) {
 const p = platforms[1 + i % (platforms.length-1)];
 enemies.push({x:p.x+30+(i%2)*48,y:p.y-26,w:26,h:26,vx:0,vy:0,dir:i%2 ? -1:1,speed:42+level*10+(i%2)*8,grounded:true,kind:level>0 && i%3===1 ? 'hopper':'walker',jumpTimer:1.2+i*.37,trapped:false});
 }
 hud();
}
function overlay(title, description, button, tag) { $('modal-title').textContent=title; $('modal-description').textContent=description; $('primary').textContent=button; $('modal-tag').textContent=tag; $('overlay').hidden=false; }
function start() { activateAudio(); level=0;score=0;lives=3;elapsed=0;loadStage();state='playing';$('overlay').hidden=true;$('pause').disabled=false;$('pause').textContent='Ⅱ 일시정지';canvas.focus({preventScroll:true}); }
function pause() { if(state!=='playing')return;state='paused';clearInput();$('pause').textContent='▶ 재개';overlay('잠깐 쉬어 가요','동굴바리가 여기서 기다리고 있어요.','계속 모험하기','PAUSED'); }
function resume() { if(state!=='paused')return;state='playing';clearInput();$('overlay').hidden=true;$('pause').textContent='Ⅱ 일시정지';canvas.focus({preventScroll:true}); }
$('primary').addEventListener('click',()=> state==='paused' ? resume():start());
$('restart').addEventListener('click',start);
$('pause').addEventListener('click',()=>state==='paused'?resume():pause());
$('mute').addEventListener('click',()=>{muted=!muted;$('mute').textContent=muted?'♫ 음소거':'♪ 소리 켜짐';$('mute').setAttribute('aria-pressed',String(muted));});
window.addEventListener('keydown',e=>{ if(keys[e.code] && (e.target===canvas || state==='playing')) {e.preventDefault();if(!keyboard.has(e.code)&&keys[e.code]==='jump'&&state==='playing')jumpQueued=true;if(!keyboard.has(e.code)&&keys[e.code]==='fire'&&state==='playing')fireQueued=true;if(state==='playing')keyboard.add(e.code);}if(e.code==='Escape'){if(state==='playing')pause();else if(state==='paused')resume();} });
window.addEventListener('keyup',e=>{if(keyboard.has(e.code))e.preventDefault();keyboard.delete(e.code);});
function releasePointer(e) { touches.delete(e.pointerId);document.querySelectorAll('[data-action]').forEach(b=>b.classList.toggle('active',[...touches.values()].includes(b.dataset.action))); }
for(const button of document.querySelectorAll('[data-action]')) {
 button.addEventListener('pointerdown',e=>{e.preventDefault();if(state!=='playing')return;button.setPointerCapture(e.pointerId);touches.set(e.pointerId,button.dataset.action);button.classList.add('active');if(button.dataset.action==='jump')jumpQueued=true;if(button.dataset.action==='fire')fireQueued=true;});
 for(const name of ['pointerup','pointercancel','lostpointercapture','pointerleave'])button.addEventListener(name,releasePointer);
 button.addEventListener('contextmenu',e=>e.preventDefault());
}
window.addEventListener('pointerup',releasePointer);window.addEventListener('pointercancel',releasePointer);
window.addEventListener('blur',()=>{clearInput();pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}});
function overlap(a,b) {return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;}
function physics(body,dt) {
 const oldBottom=body.y+body.h;body.vy+=GRAVITY*dt;body.x+=body.vx*dt;body.y+=body.vy*dt;body.grounded=false;
 if(body.x<5){body.x=5;body.dir=1;}if(body.x+body.w>W-5){body.x=W-5-body.w;body.dir=-1;}
 if(body.vy>=0)for(const p of platforms){if(body.x+body.w>p.x && body.x<p.x+p.w && oldBottom<=p.y+.5 && body.y+body.h>=p.y){body.y=p.y-body.h;body.vy=0;body.grounded=true;break;}}
}
function burst(x,y,color,n=12){for(let i=0;i<n;i++){const angle=Math.PI*2*i/n;particles.push({x,y,vx:Math.cos(angle)*95,vy:Math.sin(angle)*95,life:.5,color});}}
function fire(){const x=player.x+player.w/2+player.dir*20;bubbles.push({x,y:player.y+12,r:14,vx:player.dir*270,age:0,enemy:null,trapTime:0});sound('fire');}
function pop(b){const e=b.enemy;if(!e)return;enemies=enemies.filter(a=>a!==e);bubbles=bubbles.filter(a=>a!==b);score+=100+level*25;burst(b.x,b.y,'#ffdb87',18);sound('pop');saveBest();hud();}
function hit(){if(player.invulnerable>0)return;lives--;sound('hit');burst(player.x+13,player.y+15,'#ff8f9f');clearInput();player.x=45;player.y=FLOOR-30;player.vx=0;player.vy=0;player.invulnerable=2;hud();if(lives===0){state='gameover';saveBest();$('pause').disabled=true;overlay('다음 모험을 기약해요!',`최종 점수 ${score.toLocaleString('ko-KR')}점 · 다시 도전해 볼까요?`,'다시 시작','GAME OVER');}}
function update(dt){
 elapsed+=dt;player.invulnerable=Math.max(0,player.invulnerable-dt);fireCooldown-=dt;
 player.vx=((held('right')?1:0)-(held('left')?1:0))*220;if(player.vx)player.dir=Math.sign(player.vx);
 if(jumpQueued&&player.grounded){player.vy=-490;player.grounded=false;sound('jump');}jumpQueued=false;
 physics(player,dt);
 if((held('fire')||fireQueued)&&fireCooldown<=0){fire();fireCooldown=.28;fireQueued=false;}
 for(const e of enemies){if(e.trapped)continue;e.jumpTimer-=dt;if(e.kind==='hopper'&&e.grounded&&e.jumpTimer<=0){e.vy=-360;e.jumpTimer=1.5+level*.05;}e.vx=e.speed*e.dir;physics(e,dt);}
 for(const b of [...bubbles]){
 b.age+=dt;
 if(b.enemy){b.trapTime+=dt;b.y-=29*dt;b.x+=Math.sin(elapsed*2+b.age)*9*dt;b.x=Math.max(b.r,Math.min(W-b.r,b.x));b.y=Math.max(30,b.y);b.enemy.x=b.x-13;b.enemy.y=b.y-13;
 if(overlap(player,{x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2})){pop(b);continue;}
 if(b.trapTime>=6){const e=b.enemy;e.trapped=false;e.y=Math.max(6,b.y-13);e.vy=0;e.dir=player.x<e.x?1:-1;bubbles=bubbles.filter(a=>a!==b);burst(b.x,b.y,'#99dcf5',8);}
 }else{b.vx*=Math.exp(-1.65*dt);b.x+=b.vx*dt;b.y-=(b.age<.45?5:34)*dt;
 if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx)*.3;}if(b.x>W-b.r){b.x=W-b.r;b.vx=-Math.abs(b.vx)*.3;}
 for(const e of enemies){if(!e.trapped&&overlap(e,{x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2})){e.trapped=true;b.enemy=e;b.trapTime=0;b.r=20;b.vx=0;burst(b.x,b.y,'#a3e7f0',6);break;}}
 if(!b.enemy&&(b.age>3.6||b.y<-20))bubbles=bubbles.filter(a=>a!==b);
 }
 }
 if(state==='playing')for(const e of enemies){if(!e.trapped&&overlap(player,e)){hit();break;}}
 for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=170*dt;}particles=particles.filter(p=>p.life>0);
 if(state==='playing'&&enemies.length===0){transition+=dt;if(transition>=1){score+=250;saveBest();sound('win');if(level===4){state='won';clearInput();hud();$('pause').disabled=true;overlay('동굴의 새로운 영웅!',`다섯 동굴을 모두 구했어요! 최종 점수 ${score.toLocaleString('ko-KR')}점`,'한 번 더 모험하기','ADVENTURE COMPLETE');}else{level++;loadStage();}}}
}
// Original pixel sprites: a mint cave explorer, coral pebble critters and lilac hoppers.
const hero=['  MMMM  ',' MMMMMM ','MMMLLMMM','MMMLLMMM',' MMMMMM ',' WWMMWW ',' WDKKDW ',' WWWWWW ','  TTTT  ',' TT  TT '];
const critter=['  CCCC  ',' CCCCCC ','CCWCCWCC','CCKCCKCC','CCCCCCCC',' CCCCCCC','  CCCC  ',' CC  CC '];
function sprite(pattern,x,y,scale,colors,flip=false){ctx.save();ctx.translate(Math.round(x),Math.round(y));if(flip){ctx.translate(pattern[0].length*scale,0);ctx.scale(-1,1);}pattern.forEach((row,iy)=>[...row].forEach((c,ix)=>{if(colors[c]){ctx.fillStyle=colors[c];ctx.fillRect(ix*scale,iy*scale,scale,scale);}}));ctx.restore();}
function draw(){
 const [bg,rock,moss]=palettes[level];ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 ctx.fillStyle=rock;for(let i=0;i<18;i++){const x=i*49;ctx.fillRect(x,0,22,14+(i*19)%65);ctx.fillRect(x+13,H-20-(i*11)%35,28,60);}ctx.globalAlpha=.25;for(let i=0;i<45;i++){ctx.fillStyle=i%3?'#a5d7c0':'#ffda96';ctx.fillRect((i*157+31)%W,(i*83+56)%390,2,2);}ctx.globalAlpha=1;
 // Distant cave arch and glowing pool.
 ctx.strokeStyle=rock;ctx.lineWidth=15;ctx.beginPath();ctx.arc(400,430,220,Math.PI,0);ctx.stroke();
 for(const p of platforms){ctx.fillStyle='#112937';ctx.fillRect(p.x,p.y+5,p.w,p.h);ctx.fillStyle=rock;ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle=moss;ctx.fillRect(p.x,p.y,p.w,5);ctx.fillStyle='#ffffff25';for(let x=p.x+8;x<p.x+p.w-5;x+=24)ctx.fillRect(x,p.y+8,7,3);}
 for(let i=0;i<7;i++){const x=40+i*119;ctx.fillStyle=i%2?'#bc9ed0':'#f8bf8b';ctx.fillRect(x,FLOOR-10,5,10);ctx.fillRect(x-4,FLOOR-13,13,5);}
 for(const e of enemies){const c=e.kind==='hopper'?'#c6a2ed':'#f19583';sprite(critter,e.x+1,e.y+2,3,{C:c,W:'#fff2db',K:'#253645'},e.dir<0);if(e.kind==='hopper'){ctx.fillStyle=c;ctx.fillRect(e.x+5,e.y-4,4,8);ctx.fillRect(e.x+17,e.y-4,4,8);}}
 for(const b of bubbles){ctx.save();ctx.strokeStyle=b.enemy?(b.trapTime>4.5?'#ffcd82':'#d6faff'):'#89d7ed';ctx.lineWidth=b.enemy?3:2;ctx.fillStyle=b.enemy?'#a4e4ff35':'#a4e4ff18';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#efffff';ctx.fillRect(b.x-b.r*.45,b.y-b.r*.55,4,4);if(b.enemy){ctx.strokeStyle='#ffe0a6';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,b.r+4,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-b.trapTime/6));ctx.stroke();}ctx.restore();}
 if(player && (player.invulnerable<=0||Math.floor(elapsed*12)%2===0))sprite(hero,player.x+1,player.y,3,{M:'#75dbbb',L:'#d5ffe0',W:'#f5dfb3',D:'#263b4a',K:'#263b4a',T:'#efb66d'},player.dir<0);
 for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;
 ctx.fillStyle='#bddbd9';ctx.font='12px sans-serif';ctx.fillText(['이끼빛 입구','반짝 버섯길','옥빛 계단','노을의 동굴','별빛 왕관'][level],18,26);
 if(transition>0){ctx.fillStyle='#fff0bf';ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.fillText('동굴을 구했어요!',W/2,140);ctx.textAlign='left';}
}
let last=0,accumulator=0;
function frame(now){if(!last)last=now;const dt=Math.min((now-last)/1000,.1);last=now;if(state==='playing'){accumulator+=dt;while(accumulator>=STEP){if(state==='playing')update(STEP);accumulator-=STEP;}}else accumulator=0;draw();requestAnimationFrame(frame);}
loadStage();requestAnimationFrame(frame);
})();
