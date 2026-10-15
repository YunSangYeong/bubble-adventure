const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const results=[];let errors=[];
 async function setup(options={}){
 const context=await browser.newContext(options),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 // Test-only instrumentation. The actual shipped file has no debugging interface.
 await page.route('**/game.js',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace('loadStage();requestAnimationFrame(frame);',`window.testGame={snapshot:()=>({state,level,score,lives,best,player:{...player},enemies:enemies.map(e=>({...e})),bubbles:bubbles.map(b=>({...b,enemy:!!b.enemy})),muted,input:held('left')||held('right')}),scene:(fn)=>fn({player,enemies,bubbles,platforms}),stage:n=>{level=n;loadStage()},step:n=>{for(let i=0;i<n;i++)if(state==='playing')update(STEP)}};loadStage();requestAnimationFrame(frame);`);await route.fulfill({response,body});});
 await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8000/bubble-adventure/');return {context,page};
 }
 const {page,context}=await setup({viewport:{width:1100,height:1000}});
 const snap=()=>page.evaluate(()=>testGame.snapshot());
 await page.getByRole('button',{name:'모험 시작',exact:true}).click();assert.equal((await snap()).state,'playing');
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(220);await page.keyboard.up('ArrowRight');assert((await snap()).player.x>70);
 await page.keyboard.press('Space');await page.waitForTimeout(100);assert((await snap()).player.y<400);results.push('Actual start, movement and jump');
 // Controlled deterministic fixture places a real enemy in the firing lane; real input and collisions do the capture/pop.
 await page.evaluate(()=>testGame.scene(({player,enemies})=>{Object.assign(player,{x:100,y:418,vy:0,grounded:true,dir:1});enemies.forEach((e,i)=>Object.assign(e,{x:i?650:190,y:422,vy:0,speed:0,trapped:false}));}));
 await page.keyboard.press('KeyZ');await page.waitForTimeout(220);assert((await snap()).bubbles.some(b=>b.enemy));
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(330);await page.keyboard.up('ArrowRight');assert.equal((await snap()).score,100);assert.equal((await snap()).enemies.length,3);results.push('Keyboard fire → capture → contact pop and score');
 // Escape timer / non-damaging empty bubbles.
 await page.evaluate(()=>testGame.scene(({player,enemies,bubbles})=>{player.x=5;const e=enemies[0];e.trapped=true;bubbles.push({x:500,y:200,r:20,vx:0,age:0,enemy:e,trapTime:5.99});bubbles.push({x:18,y:430,r:14,vx:0,age:0,enemy:null,trapTime:0});}));
 await page.waitForTimeout(100);assert(!(await snap()).enemies[0].trapped);assert.equal((await snap()).lives,3);results.push('Timed escape and harmless empty bubble');
 await page.evaluate(()=>testGame.scene(({player,enemies,bubbles})=>{bubbles.length=0;player.invulnerable=0;Object.assign(enemies[0],{x:player.x,y:player.y,speed:0,vy:0});}));
 await page.waitForTimeout(80);assert.equal((await snap()).lives,2);
 await page.evaluate(()=>testGame.scene(({player,enemies})=>Object.assign(enemies[0],{x:player.x,y:player.y,vy:0})));await page.waitForTimeout(120);assert.equal((await snap()).lives,2);results.push('Damage and invulnerability');
 for(let i=0;i<2;i++){await page.evaluate(()=>testGame.scene(({player,enemies,bubbles})=>{bubbles.length=0;player.invulnerable=0;Object.assign(enemies[0],{x:player.x,y:player.y,speed:0,vy:0});}));await page.waitForTimeout(50);}
 assert.equal((await snap()).state,'gameover');await page.locator('#primary').click();assert.equal((await snap()).lives,3);assert.equal((await snap()).score,0);assert.equal((await snap()).bubbles.length,0);results.push('Game over and clean restart');
 await page.locator('#pause').click();const before=(await snap()).player.x;await page.keyboard.press('ArrowRight');await page.waitForTimeout(60);assert.equal((await snap()).player.x,before);await page.locator('#primary').click();assert.equal((await snap()).state,'playing');
 await page.locator('#mute').click();assert((await snap()).muted);await page.locator('#mute').click();assert(!(await snap()).muted);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await snap()).state,'paused');await page.locator('#primary').click();results.push('Pause/resume, mute and automatic blur pause');
 // Empty-bubble footing: actual held keyboard input and swept top collision.
 async function bubbleScene(y=280,vy=120,x=400){
  await page.evaluate(({y,vy,x})=>testGame.scene(({player,enemies,bubbles})=>{
   Object.assign(player,{x,y,vy,vx:0,grounded:false,invulnerable:2,bubbleFlash:0});
   enemies.forEach(e=>Object.assign(e,{x:700,y:422,speed:0,trapped:false}));
   bubbles.length=0;bubbles.push({x:413,y:350,r:14,vx:0,age:.6,enemy:null,trapTime:0});
  }),{y,vy,x});
 }
 await bubbleScene();await page.keyboard.down('Space');await page.evaluate(()=>testGame.step(20));
 let footing=await snap();assert(footing.player.vy<0);assert(footing.player.bubbleFlash>0);assert.equal(footing.bubbles.length,1);
 await page.keyboard.up('Space');
 await bubbleScene();await page.evaluate(()=>testGame.step(24));footing=await snap();assert(footing.player.y+30>footing.bubbles[0].y-14);assert.equal(footing.player.bubbleFlash,0);
 await bubbleScene(310,120,455);await page.keyboard.down('Space');await page.evaluate(()=>testGame.step(15));assert.equal((await snap()).player.bubbleFlash,0);await page.keyboard.up('Space');
 await bubbleScene(360,-150);await page.keyboard.down('Space');await page.evaluate(()=>testGame.step(8));assert.equal((await snap()).player.bubbleFlash,0);await page.keyboard.up('Space');
 results.push('Held-jump bubble bounce preserves bubble; release, side and underside do not bounce');
 // Validate platform reachability, enemy scaling and spawn containment for every map.
 const difficulty=[];
 for(let n=0;n<10;n++){
  await page.evaluate(n=>testGame.stage(n),n);
  difficulty.push(await page.evaluate(()=>{
   let result;testGame.scene(({platforms,enemies})=>{
    const reached=new Set([0]);let changed=true;
    while(changed){changed=false;for(let i=0;i<platforms.length;i++)for(const j of [...reached]){
     const from=platforms[j],to=platforms[i],dy=from.y-to.y;
     if(dy<0||dy>108)continue;
     const flight=(490+Math.sqrt(490*490-2*1100*dy))/1100;
     const gap=Math.max(0,to.x-(from.x+from.w),(from.x)-(to.x+to.w));
     if(gap<220*flight-10&&!reached.has(i)){reached.add(i);changed=true;}
    }}
    result={reachable:reached.size===platforms.length,count:enemies.length,maxSpeed:Math.max(...enemies.map(e=>e.speed)),contained:enemies.every(e=>e.x>=0&&e.x+e.w<=800&&e.y>=0)};
   });return result;
  }));
 }
 assert(difficulty.every(d=>d.reachable&&d.contained));
 for(let i=1;i<10;i++){assert(difficulty[i].count>difficulty[i-1].count);assert(difficulty[i].maxSpeed>difficulty[i-1].maxSpeed);}
 results.push('10 reachable maps, contained spawns, increasing enemy counts and speeds');
 // Late-stage shorter escape window and occupied bubbles retaining contact-pop semantics.
 await page.evaluate(()=>{testGame.stage(9);testGame.scene(({player,enemies,bubbles})=>{player.x=5;const e=enemies[0];e.trapped=true;bubbles.push({x:500,y:200,r:20,vx:0,age:0,enemy:e,trapTime:3.99});});testGame.step(1);});
 assert((await snap()).enemies[0].trapped);await page.evaluate(()=>testGame.step(5));assert(!(await snap()).enemies[0].trapped);
 await page.evaluate(()=>testGame.scene(({player,enemies,bubbles})=>{Object.assign(player,{x:380,y:418,vy:0,grounded:false});bubbles.length=0;const e=enemies[0];e.trapped=true;bubbles.push({x:393,y:430,r:20,vx:0,age:0,enemy:e,trapTime:0});}));
 const occupiedCount=(await snap()).enemies.length;await page.keyboard.down('Space');await page.evaluate(()=>testGame.step(1));await page.keyboard.up('Space');assert.equal((await snap()).enemies.length,occupiedCount-1);
 results.push('Late-stage ~4s escape and occupied bubble still pops while jump is held');
 // Exercise actual collision/pop and advancement for all ten maps via deterministic fixtures.
 for(let stage=0;stage<10;stage++){
 await page.evaluate(n=>testGame.stage(n),stage);
 await page.evaluate(()=>{const s=testGame.snapshot();for(let j=0;j<s.enemies.length;j++){testGame.scene(({player,enemies,bubbles})=>{const e=enemies[0];Object.assign(player,{x:380,y:418,vy:0});e.trapped=true;bubbles.push({x:393,y:430,r:20,vx:0,age:0,enemy:e,trapTime:0});});testGame.step(1);}testGame.step(130);});
 const s=await snap();assert.equal(s.state,stage===9?'won':'playing');if(stage<9)assert.equal(s.level,stage+1);
 }
 results.push('Collision-driven clear/transition for all 10 stages and victory');
 await page.screenshot({path:'/tmp/bubble-desktop-victory.png'});
 await context.close();
 const mobile=await setup({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const p=mobile.page;await p.locator('#primary').tap();
 const client=await mobile.context.newCDPSession(p);const left=await p.locator('[data-action=right]').boundingBox(),jump=await p.locator('[data-action=jump]').boundingBox(),fire=await p.locator('[data-action=fire]').boundingBox();
 const points=[left,jump,fire].map((b,i)=>({x:b.x+b.width/2,y:b.y+b.height/2,id:i+1}));
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await p.waitForTimeout(160);
 const m=await p.evaluate(()=>testGame.snapshot());assert(m.player.x>60);assert(m.player.y<418);assert(m.bubbles.length>0);
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(50);assert(!(await p.evaluate(()=>testGame.snapshot())).input);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert(!(await p.evaluate(()=>testGame.snapshot())).input);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...points[0],x:2,y:2}]});assert(!(await p.evaluate(()=>testGame.snapshot())).input);await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await p.evaluate(()=>testGame.scene(({player,enemies,bubbles})=>{Object.assign(player,{x:400,y:280,vy:120,grounded:false,bubbleFlash:0});enemies.forEach(e=>Object.assign(e,{x:700,y:422,speed:0}));bubbles.length=0;bubbles.push({x:413,y:350,r:14,vx:0,age:.6,enemy:null,trapTime:0});}));
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[1]]});await p.evaluate(()=>testGame.step(20));assert((await p.evaluate(()=>testGame.snapshot())).player.bubbleFlash>0);await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 results.push('Mobile held-jump touch also bounces on empty bubbles');
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const bottom=await p.locator('.touch-controls').boundingBox();assert(bottom.y+bottom.height<844);
 await p.screenshot({path:'/tmp/bubble-mobile.png',fullPage:true});results.push('390px mobile layout, simultaneous movement/jump/fire touch, release/cancel/drag outside');
 await mobile.context.close();
 const blocked=await browser.newContext();await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('storage blocked')}}));const bp=await blocked.newPage();bp.on('pageerror',e=>errors.push(e.message));await bp.goto(process.env.GAME_URL || 'http://127.0.0.1:8000/bubble-adventure/');await bp.locator('#primary').click();await bp.keyboard.press('KeyZ');results.push('Blocked localStorage still starts and fires');await blocked.close();
 assert.deepEqual(errors,[]);results.push('No browser console/page errors');console.log(JSON.stringify({passed:results},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
