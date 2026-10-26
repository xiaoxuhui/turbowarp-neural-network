import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const bridgeRequire=createRequire(new URL('../../turbowarp-codex-bridge/package.json',import.meta.url));
const {chromium}=createRequire(bridgeRequire.resolve('@playwright/mcp/package.json'))('playwright');
const config=JSON.parse(await fs.readFile(new URL('../../turbowarp-codex-bridge/config/playwright.json',import.meta.url),'utf8'));
const html=await fs.readFile(path.join(root,'web-dist/index.html'));
const server=http.createServer((req,res)=>{if(req.url==='/'||req.url==='/index.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}else{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
const report={checks:[],errors:[],externalRequests:[]};
try{
 browser=await chromium.launch({...config.browser.launchOptions,headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900},locale:'zh-CN'});
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.route('**/*',route=>{const u=route.request().url();if(u.startsWith(origin)||u.startsWith('data:')||u.startsWith('blob:'))return route.continue();report.externalRequests.push(u);return route.abort();});
 await page.goto(origin,{waitUntil:'load'});
 await page.waitForFunction(()=>window.vm?.runtime?.getTargetForStage()?.variables?.v_忙碌?.value===0&&vm.runtime.getTargetForStage().variables.l_W1.value.length===6);
 const state=()=>page.evaluate(()=>Object.fromEntries(Object.entries(vm.runtime.getTargetForStage().variables).map(([id,v])=>[id,v.value])));
 const point=async(x,y)=>{const r=await page.locator('canvas').first().boundingBox();await page.mouse.click(r.x+(x+240)/480*r.width,r.y+(180-y)/360*r.height);};
 await point(-154,-128); // Existing reset sprite.
 const answer=async value=>{const field=page.locator('input').filter({visible:true}).first();await field.waitFor({state:'visible'});await field.fill(String(value));await field.press('Enter');};
 for(const [x,y] of [[0,0],[1,2],[2,4]]){await point(0,-128);await answer(x);await answer(y);await page.waitForFunction(()=>vm.runtime.getTargetForStage().variables.v_忙碌.value===0);}
 const trained=await state();assert.equal(trained.v_样本数,3);assert.equal(trained.v_训练轮次,1800);
 await point(154,-128);await answer(1.5);await page.waitForFunction(()=>vm.runtime.getTargetForStage().variables.v_忙碌.value===0);
 const predicted=await state();assert(Math.abs(Number(predicted.v_预测输出)-3)<.35);assert.deepEqual(predicted.l_W1,trained.l_W1);assert.deepEqual(predicted.l_W2,trained.l_W2);
 report.checks.push({name:'original SB3 real mouse train/predict with all external requests blocked',prediction:predicted.v_预测输出});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);
 await page.screenshot({path:path.join(root,'evidence/web-desktop.png')});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(root,'evidence/web-mobile.png')});
 report.checks.push({name:'desktop and narrow viewport screenshots'});
 console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(root,'evidence/web-test.json'),JSON.stringify(report,null,2)+'\n');}
