(() => {
'use strict';
const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const W = 800, H = 480, FLOOR = 448, GRAVITY = 1100, STEP = 1 / 120;
const palettes = [
 ['#294c59','#577d83','#9ee1b5','#ffd3d8'], ['#3b4668','#777ca1','#d4c0f3','#ffdfa8'],
 ['#2e5665','#619297','#a2e8dc','#ffc8d8'], ['#574363','#977d9c','#f6c7df','#ffe4ac'],
 ['#374e70','#6b87ad','#b5dcfa','#edd0ff'], ['#4c5262','#929b96','#d7e9a6','#ffcead'],
 ['#56425b','#9e738b','#ffbfcf','#ffdf9b'], ['#354e65','#6f8fa7','#b5e2ef','#e2c3ff'],
 ['#4d426f','#877dab','#d6c3ff','#ffc8dd'], ['#3a5367','#7a949e','#ffe2a0','#ffd1e1']
];
const stageNames = ['새싹 마을 입구','솜사탕 버섯숲','민트 수정 샘','복숭아 꽃동굴','구름 사다리',
 '꿀빛 이끼 정원','딸기별 쉼터','달방울 계곡','보랏빛 꿈길','별사탕 왕관'];
// One-way platforms: all routes can be climbed without relying on bubble jumps.
const maps = [
 [[110,362,210],[470,362,210],[290,276,220]],
 [[35,362,175],[300,362,180],[590,362,175],[165,276,175],[460,276,175],[315,190,170]],
 [[75,362,190],[535,362,190],[280,318,240],[95,232,180],[525,232,180],[300,146,200]],
 [[30,362,165],[245,362,145],[440,362,145],[630,362,140],[140,276,170],[490,276,170],[315,190,170]],
 [[20,362,180],[310,362,180],[600,362,180],[155,276,180],[465,276,180],[305,190,190],[30,190,150],[620,190,150]],
 [[40,362,150],[260,362,135],[460,362,135],[650,362,120],[135,276,140],[355,276,135],[570,276,130],[245,190,125],[455,190,125],[350,104,110]],
 [[65,362,140],[330,362,140],[595,362,140],[185,276,135],[480,276,135],[50,190,125],[340,190,120],[625,190,125],[190,104,120],[490,104,120]],
 [[25,362,135],[225,362,125],[450,362,125],[650,362,125],[120,276,120],[340,276,120],[560,276,120],[225,190,120],[450,190,120],[340,104,120]],
 [[50,362,125],[270,362,120],[500,362,120],[680,362,95],[160,276,115],[390,276,115],[600,276,115],[50,190,110],[275,190,110],[505,190,110],[165,104,110],[395,104,110],[625,104,110]],
 [[20,362,125],[210,362,115],[430,362,115],[650,362,125],[115,276,110],[320,276,110],[535,276,110],[30,190,105],[225,190,105],[435,190,105],[650,190,105],[125,104,105],[330,104,140],[565,104,105]]
];
const STAGE_COUNT = maps.length;
const trapDuration = () => 6 - level * .22;
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
function hud() { $('stage').textContent = `${level+1} / ${STAGE_COUNT}`; $('lives').textContent = '♥ '.repeat(lives).trim() || '—'; $('score').textContent = score.toLocaleString('ko-KR'); $('remaining').textContent = enemies.length; $('best').textContent = best.toLocaleString('ko-KR'); }
function loadStage() {
 platforms = [{x:0,y:FLOOR,w:W,h:32}, ...maps[level].map(([x,y,w])=>({x,y,w,h:16}))];
 player = {x:45,y:FLOOR-30,w:26,h:30,vx:0,vy:0,dir:1,grounded:true,invulnerable:1.6,bubbleFlash:0};
 enemies = []; bubbles = []; particles = []; transition = 0; fireCooldown = 0; clearInput();
 const count = 4 + level;
 for (let i=0;i<count;i++) {
 const p = platforms[1 + i % (platforms.length-1)];
 const kind = level >= 4 && i % 4 === 0 ? 'dasher' : level >= 1 && i % (level >= 5 ? 2 : 3) === 1 ? 'hopper' : 'walker';
 enemies.push({x:p.x+24+(i%2)*Math.min(45,p.w-60),y:p.y-26,w:26,h:26,vx:0,vy:0,dir:i%2 ? -1:1,
 speed:64+level*9+(i%2)*14,grounded:true,kind,jumpTimer:1.1+i*.17,brain:.8+i*.13,dashTime:0,enraged:0,trapped:false});
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
 button.addEventListener('pointermove',e=>{if(!touches.has(e.pointerId))return;const r=button.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)releasePointer(e);});
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
// A held jump makes empty bubbles springy one-way stepping stones.
// Swept top crossing prevents side/underside contact from granting an air jump.
function bounceOnBubble(oldBottom) {
 if(!held('jump') || player.vy < 0) return;
 let landing = null;
 for(const b of bubbles) {
  if(b.enemy) continue;
  const top = b.y-b.r, oldTop = (b.previousY ?? b.y)-b.r;
  if(oldBottom<=oldTop+.5 && player.y+player.h>=top && player.x+player.w>b.x-b.r+3 && player.x<b.x+b.r-3) {
   if(!landing || top<landing.y-landing.r) landing=b;
  }
 }
 if(landing) {
  player.y=landing.y-landing.r-player.h;player.vy=-410;player.grounded=false;player.bubbleFlash=.18;
  burst(landing.x,landing.y-landing.r,'#e0faff',5);sound('jump');
 }
}
function update(dt){
 elapsed+=dt;player.bubbleFlash=Math.max(0,player.bubbleFlash-dt);player.invulnerable=Math.max(0,player.invulnerable-dt);fireCooldown-=dt;
 player.vx=((held('right')?1:0)-(held('left')?1:0))*220;if(player.vx)player.dir=Math.sign(player.vx);
 if(jumpQueued&&player.grounded){player.vy=-490;player.grounded=false;sound('jump');}jumpQueued=false;
 const oldBottom=player.y+player.h;
 physics(player,dt);
 if(player.y<0){player.y=0;player.vy=Math.max(0,player.vy);}
 if((held('fire')||fireQueued)&&fireCooldown<=0){fire();fireCooldown=.28;fireQueued=false;}
 for(const e of enemies){
  if(e.trapped)continue;
  e.jumpTimer-=dt;e.brain-=dt;e.dashTime=Math.max(0,e.dashTime-dt);e.enraged=Math.max(0,e.enraged-dt);
  if(e.kind==='dasher' && e.brain<=0){
   if(Math.abs(player.y-e.y)<75){e.dir=player.x<e.x?-1:1;e.dashTime=.32;}
   e.brain=Math.max(.75,1.5-level*.065);
  }
  if(e.kind==='hopper'&&e.grounded&&e.jumpTimer<=0){e.vy=-330-level*6;e.jumpTimer=Math.max(.65,1.5-level*.075);}
  // Walkers guard their platforms; hoppers can leap between floors.
  if(e.grounded&&e.kind!=='hopper'){
   const support=platforms.find(p=>Math.abs(e.y+e.h-p.y)<1&&e.x+e.w>p.x&&e.x<p.x+p.w);
   if(support){if(e.dir>0&&e.x+e.w>=support.x+support.w-3)e.dir=-1;else if(e.dir<0&&e.x<=support.x+3)e.dir=1;}
  }
  e.vx=e.speed*e.dir*(e.dashTime>0?1.45:1)*(e.enraged>0?1.22:1);physics(e,dt);
 }
 for(const b of [...bubbles]){
 b.previousY=b.y;b.age+=dt;
 if(b.enemy){b.trapTime+=dt;b.y-=29*dt;b.x+=Math.sin(elapsed*2+b.age)*9*dt;b.x=Math.max(b.r,Math.min(W-b.r,b.x));b.y=Math.max(30,b.y);b.enemy.x=b.x-13;b.enemy.y=b.y-13;
 if(overlap(player,{x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2})){pop(b);continue;}
 if(b.trapTime>=trapDuration()){const e=b.enemy;e.trapped=false;e.enraged=2;e.y=Math.max(6,b.y-13);e.vy=0;e.dir=player.x<e.x?1:-1;bubbles=bubbles.filter(a=>a!==b);burst(b.x,b.y,'#99dcf5',8);}
 }else{b.vx*=Math.exp(-1.65*dt);b.x+=b.vx*dt;b.y-=(b.age<.45?5:34)*dt;
 if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx)*.3;}if(b.x>W-b.r){b.x=W-b.r;b.vx=-Math.abs(b.vx)*.3;}
 for(const e of enemies){if(!e.trapped&&overlap(e,{x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2})){e.trapped=true;b.enemy=e;b.trapTime=0;b.r=20;b.vx=0;burst(b.x,b.y,'#a3e7f0',6);break;}}
 if(!b.enemy&&(b.age>4.8||b.y<-20))bubbles=bubbles.filter(a=>a!==b);
 }
 }
 bounceOnBubble(oldBottom);
 if(state==='playing')for(const e of enemies){if(!e.trapped&&overlap(player,e)){hit();break;}}
 for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=170*dt;}particles=particles.filter(p=>p.life>0);
 if(state==='playing'&&enemies.length===0){transition+=dt;if(transition>=1){score+=250;saveBest();sound('win');if(level===STAGE_COUNT-1){state='won';clearInput();hud();$('pause').disabled=true;overlay('동굴의 새로운 영웅!',`열 동굴을 모두 구했어요! 최종 점수 ${score.toLocaleString('ko-KR')}점`,'한 번 더 모험하기','ADVENTURE COMPLETE');}else{level++;loadStage();}}}
}
// Original cave-sprite designs: a sprout-tufted explorer and round pebble sprites.
// Two-pixel details keep eyes, cheeks and the cream tummy readable on small screens.
const heroHead = [
 '     OO         ',
 '    OLL OOO     ',
 '    OLMOLLO     ',
 '   OMMMMMMMO    ',
 '  OMLMMMMMMMO   ',
 ' OMLLMMWWMWWMO  ',
 ' OMLMMMWWMWWMO  ',
 ' OMMMMMWKMWKMO  ',
 ' OMMPPMMMMMMMO  ',
 '  OMMMMMKMMMO   ',
 ' OMMMWWWWWMMMO  ',
 ' OMMWWWWWWWMMO  ',
 '  OSWWWWWWWSSO  ',
 '   OSSWWWSSO    '
].map(row=>row.padEnd(16,' '));
const heroFeet = [
 ['   OTT  TTTO    ','    OO  OOO     '],
 ['  OTTT   TTO    ','   OOO   OO     '],
 ['   OTTTTTTO     ','    OOOOOO      ']
];
const critter = [
 '    OOOOO    ',
 '  OOCCCCCOO  ',
 ' OCLLCCCCCCO ',
 ' OCLCCWWCWWO ',
 'OCCCCCWKCWKCO',
 'OCCPPCCCCCCCO',
 'OCCCCCCKCCCCO',
 ' OCCTTTTTCCO ',
 ' OCCCTTTCCCO ',
 '  OCCCCCCCO  ',
 '   OOCCOOO   ',
 '  OTT  TTO   ',
 '   OO  OO    '
];
function drawHero(target,x,y,scale=2,dir=1,pose=0) {
 const colors={O:'#183c45',M:'#79dfbc',L:'#c4ffcf',S:'#45af9a',W:'#fff2cc',K:'#243443',P:'#ffa5b0',T:'#f8c77e'};
 sprite([...heroHead,...heroFeet[pose]],x,y,scale,colors,dir<0,target);
}
function sprite(pattern,x,y,scale,colors,flip=false,target=ctx){target.save();target.translate(Math.round(x),Math.round(y));if(flip){target.translate(pattern[0].length*scale,0);target.scale(-1,1);}pattern.forEach((row,iy)=>[...row].forEach((c,ix)=>{if(colors[c]){target.fillStyle=colors[c];target.fillRect(ix*scale,iy*scale,scale,scale);}}));target.restore();}
function draw(){
 const [bg,rock,moss,petal]=palettes[level];ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 // Soft scalloped cave walls, distant clouds and tiny drifting fireflies.
 ctx.fillStyle=rock;ctx.globalAlpha=.32;
 for(let i=0;i<10;i++){ctx.beginPath();ctx.arc(i*92+12,-8,40+(i%3)*12,0,Math.PI*2);ctx.fill();}
 for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(90+i*210,175+(i%2)*85,85,125,0,Math.PI,0);ctx.fill();}
 ctx.globalAlpha=.12;ctx.fillStyle=petal;
 for(let i=0;i<5;i++){const x=75+i*170,y=85+(i%3)*60;ctx.beginPath();ctx.ellipse(x,y,36,11,0,0,Math.PI*2);ctx.fill();}
 ctx.globalAlpha=1;
 for(let i=0;i<30;i++){const x=(i*157+31)%W,y=(i*83+56)%390;ctx.globalAlpha=.25+Math.sin(elapsed*1.5+i)*.15;ctx.fillStyle=i%2?moss:'#fff0b9';ctx.fillRect(x,y,3,3);}ctx.globalAlpha=1;
 for(const p of platforms){
  ctx.fillStyle='#17334655';ctx.fillRect(p.x+3,p.y+5,p.w,p.h);
  ctx.fillStyle=rock;ctx.fillRect(p.x,p.y,p.w,p.h);
  ctx.fillStyle=moss;ctx.fillRect(p.x,p.y,p.w,5);
  for(let x=p.x+3;x<p.x+p.w-4;x+=13)ctx.fillRect(x,p.y+4,7,3);
  ctx.fillStyle='#fff5e64a';for(let x=p.x+10;x<p.x+p.w-5;x+=24)ctx.fillRect(x,p.y+10,5,3);
  // Decorations never participate in collision or hide the platform's top edge.
  if(p.w>80){
   const x=p.x+p.w-27,y=p.y;
   ctx.fillStyle='#fff0d2';ctx.fillRect(x-2,y-9,4,8);
   ctx.fillStyle=petal;ctx.fillRect(x-8,y-14,16,5);ctx.fillRect(x-5,y-17,10,4);
   ctx.fillStyle='#fff8e3';ctx.fillRect(x-4,y-13,3,2);ctx.fillRect(x+3,y-12,2,2);
   ctx.fillStyle='#476175';ctx.fillRect(x-2,y-6,1,1);ctx.fillRect(x+1,y-6,1,1);
   const cx=p.x+15;ctx.fillStyle=moss;ctx.fillRect(cx,y-11,5,10);ctx.fillRect(cx+5,y-7,4,6);
   ctx.fillStyle='#f7fff0';ctx.fillRect(cx+1,y-10,2,5);
  }
 }
 for(const e of enemies){
 const hopper=e.kind==='hopper',bounce=!e.trapped&&e.grounded&&Math.abs(e.vx)>0?Math.sin(elapsed*12)*1:0;
 const colors={O:'#34354c',C:e.kind==='dasher'?'#ffe29a':hopper?'#c3aff5':'#ffa692',L:hopper?'#eee0ff':'#ffe3b0',W:'#fff9e9',K:'#34354c',P:'#ef829e',T:hopper?'#a38add':'#e77f83'};
 if(hopper){ctx.fillStyle=colors.O;ctx.fillRect(e.x+5,e.y-5,5,8);ctx.fillRect(e.x+17,e.y-5,5,8);ctx.fillStyle=colors.L;ctx.fillRect(e.x+6,e.y-4,2,6);ctx.fillRect(e.x+18,e.y-4,2,6);}
 if(e.kind==='dasher'){ctx.fillStyle='#ffcf73';ctx.fillRect(e.x+9,e.y-5,8,4);ctx.fillRect(e.x+12,e.y-8,3,3);}
 sprite(critter,e.x,e.y+bounce,2,colors,e.dir<0);
 }
 for(const b of bubbles){ctx.save();ctx.strokeStyle=b.enemy?(b.trapTime>trapDuration()-1.5?'#ffcd82':'#d6faff'):'#89d7ed';ctx.lineWidth=b.enemy?3:2;ctx.fillStyle=b.enemy?'#a4e4ff35':'#a4e4ff18';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.stroke();if(!b.enemy){ctx.strokeStyle='#ffd6ef';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,b.r-3,.3,1.8);ctx.stroke();}ctx.fillStyle='#efffff';ctx.fillRect(b.x-b.r*.45,b.y-b.r*.55,4,4);if(b.enemy){ctx.strokeStyle='#ffe0a6';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,b.r+4,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-b.trapTime/trapDuration()));ctx.stroke();}ctx.restore();}
 if(player && (player.invulnerable<=0||Math.floor(elapsed*12)%2===0)){
 const walking=player.grounded&&Math.abs(player.vx)>0;
 const pose=!player.grounded?2:walking?Math.floor(elapsed*10)%2:0;
 drawHero(ctx,player.x-3,player.y-2-(walking?pose:0),2,player.dir,pose);
 }
 for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;
 ctx.fillStyle='#fff1d7';ctx.font='bold 12px sans-serif';ctx.fillText(`${level+1}. ${stageNames[level]}`,18,26);
 if(player.bubbleFlash>0){ctx.fillStyle='#fff1d7';ctx.font='bold 13px sans-serif';ctx.fillText('퐁!',player.x+25,Math.max(16,player.y-8));}
 if(transition>0){ctx.fillStyle='#fff0bf';ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.fillText('동굴을 구했어요!',W/2,140);ctx.textAlign='left';}
}
let last=0,accumulator=0;
function frame(now){if(!last)last=now;const dt=Math.min((now-last)/1000,.1);last=now;if(state==='playing'){accumulator+=dt;while(accumulator>=STEP){if(state==='playing')update(STEP);accumulator-=STEP;}}else accumulator=0;draw();requestAnimationFrame(frame);}
const portrait=document.getElementById('hero-portrait');
if(portrait)drawHero(portrait.getContext('2d'),12,0,5);
loadStage();requestAnimationFrame(frame);
})();
