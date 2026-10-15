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
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(330);await page.keyboard.up('ArrowRight');assert.equal((await snap()).score,100);assert.equal((await snap()).enemies.length,2);results.push('Keyboard fire → capture → contact pop and score');
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
 // Exercise actual collision/pop and advancement for all five maps via deterministic fixtures.
 for(let stage=0;stage<5;stage++){
 await page.evaluate(n=>testGame.stage(n),stage);
 await page.evaluate(()=>{const s=testGame.snapshot();for(let j=0;j<s.enemies.length;j++){testGame.scene(({player,enemies,bubbles})=>{const e=enemies[0];Object.assign(player,{x:380,y:418,vy:0});e.trapped=true;bubbles.push({x:393,y:430,r:20,vx:0,age:0,enemy:e,trapTime:0});});testGame.step(1);}testGame.step(130);});
 const s=await snap();assert.equal(s.state,stage===4?'won':'playing');if(stage<4)assert.equal(s.level,stage+1);
 }
 results.push('Collision-driven clear/transition for all 5 stages and victory');
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
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const bottom=await p.locator('.touch-controls').boundingBox();assert(bottom.y+bottom.height<844);
 await p.screenshot({path:'/tmp/bubble-mobile.png',fullPage:true});results.push('390px mobile layout, simultaneous movement/jump/fire touch, release/cancel');
 await mobile.context.close();
 const blocked=await browser.newContext();await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('storage blocked')}}));const bp=await blocked.newPage();bp.on('pageerror',e=>errors.push(e.message));await bp.goto(process.env.GAME_URL || 'http://127.0.0.1:8000/bubble-adventure/');await bp.locator('#primary').click();await bp.keyboard.press('KeyZ');results.push('Blocked localStorage still starts and fires');await blocked.close();
 assert.deepEqual(errors,[]);results.push('No browser console/page errors');console.log(JSON.stringify({passed:results},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
