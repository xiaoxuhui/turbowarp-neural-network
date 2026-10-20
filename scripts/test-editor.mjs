import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {NeuralNetwork} from '../src/network.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const bridgeRequire=createRequire(new URL('../../turbowarp-codex-bridge/package.json',import.meta.url));
const toolRequire=createRequire(bridgeRequire.resolve('@playwright/mcp/package.json'));
const {chromium}=toolRequire('playwright');
const browserConfig=JSON.parse(await fs.readFile(new URL('../../turbowarp-codex-bridge/config/playwright.json',import.meta.url),'utf8'));
const report={startedAt:new Date().toISOString(),checks:[],states:[],errors:[],console:[]};
const browser=await chromium.launch({...browserConfig.browser.launchOptions,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'zh-CN'});
page.on('pageerror',e=>report.errors.push(String(e)));
page.on('console',m=>{if(['warning','error'].includes(m.type()))report.console.push({level:m.type(),text:m.text()});});
const check=(name,detail)=>{report.checks.push({name,status:'PASS',detail});console.log(`PASS ${name}`);};
async function state(label){
  const s=await page.evaluate(()=>{const t=vm.runtime.getTargetForStage();return {variables:Object.fromEntries(Object.values(t.variables).filter(v=>v.type!=='list').map(v=>[v.name,v.value])),lists:Object.fromEntries(Object.values(t.variables).filter(v=>v.type==='list').map(l=>[l.name,[...l.value]])),b2:t.variables.v_B2.value,compileErrors:window.__nnErrors||[]};});
  if(label)report.states.push({label,...s});return s;
}
const model=s=>({W1:s.lists.W1,B1:s.lists.B1,W2:s.lists.W2,B2:s.b2,X:s.lists.样本X,Y:s.lists.样本Y,epochs:s.variables.训练轮次,scaleX:s.variables.scaleX,scaleY:s.variables.scaleY});
async function clickButton(name){
  const p=await page.evaluate(n=>{const t=vm.runtime.targets.find(t=>t.getName()===n);return {x:t.x,y:t.y};},name);
  const box=await page.locator('canvas').first().boundingBox();assert(box);
  await page.mouse.click(box.x+(p.x+240)/480*box.width,box.y+(180-p.y)/360*box.height);
  // UI input dispatch is asynchronous; allow it to enter the VM before checking idle.
  await page.waitForTimeout(100);
}
async function idle(){await page.waitForFunction(()=>vm.runtime.getTargetForStage().variables.v_忙碌.value===0,{},{timeout:30000});}
async function answer(value){
  const input=page.locator('[class*="question_question-input"] input');
  await input.waitFor({state:'visible',timeout:10000});
  const label=await page.locator('[class*="question_question-label"]').innerText();
  await input.fill(String(value));await input.press('Enter');
  await page.waitForFunction(previous=>{const e=document.querySelector('[class*="question_question-label"]');return !e||e.textContent!==previous;},label);
}
async function train(x,y){await clickButton('训练按钮');await answer(x);await page.waitForFunction(()=>vm.runtime.getTargetForStage().variables.v_状态.value.includes('输出值'));await answer(y);await idle();}
async function predict(x){await clickButton('测试按钮');await answer(x);await idle();return (await state()).variables.预测输出;}
async function reset(){await clickButton('重置按钮');await idle();}
try{
  await page.goto('https://turbowarp.org/editor',{waitUntil:'domcontentloaded',timeout:90000});
  // Wait for the GUI's initial project transaction, otherwise it can overwrite our load.
  await page.waitForFunction(()=>window.vm?.runtime?.targets.some(t=>!t.isStage&&t.getCostumes().length>0));
  await page.locator('img[class*="sprite-selector-item_sprite-image"]').first().waitFor({state:'visible'});
  const base64=(await fs.readFile(path.join(root,'dist/neural-network.sb3'))).toString('base64');
  await page.evaluate(async bytes=>{await vm.loadProject(Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)).buffer);const t=vm.runtime.targets.find(t=>t.getName()==='神经网络');vm.setEditingTarget(t.id);window.__nnErrors=[];vm.on('COMPILE_ERROR',(_t,e)=>window.__nnErrors.push(String(e)));},base64);
  await page.locator('img[class*="green-flag_green-flag"]').click();
  await page.waitForFunction(()=>vm.runtime.getTargetForStage().variables.l_W1.value.length===6);await idle();
  const initial=await state('initial');assert.equal(initial.variables.样本数,0);assert.equal(initial.lists.W1.length,6);assert.equal(initial.variables.预测输出,'—');
  check('U01 初始化及三个可见按钮','Loaded real SB3; 6 hidden neurons; no samples');
  await page.screenshot({path:path.join(root,'evidence/editor-initial.png')});
  await clickButton('测试按钮');await idle();assert((await state()).variables.状态.includes('先点击训练'));check('U05 无样本测试提示');
  const initialModel=model(initial);
  await clickButton('训练按钮');await answer('abc');await idle();assert.deepEqual(model(await state()),initialModel);check('U07 非数字输入拒绝且模型不变');
  await clickButton('训练按钮');await answer(1);await answer('Infinity');await idle();assert.deepEqual(model(await state()),initialModel);check('U07 非法目标不提交半条样本');
  await clickButton('训练按钮');await answer(' ');await idle();assert.deepEqual(model(await state()),initialModel);check('U07 空白输入拒绝');
  await clickButton('训练按钮');await answer('');await idle();assert.deepEqual(model(await state()),initialModel);check('U07 空输入拒绝');
  await clickButton('训练按钮');await answer(1001);await idle();assert.deepEqual(model(await state()),initialModel);check('U07 超范围输入拒绝');
  const reference=new NeuralNetwork();
  for(const [x,y] of [[0,0],[1,2],[2,4]]){
    await train(x,y);reference.train(x,y);const s=await state(`train ${x}→${y}`);
    assert.equal(s.variables.样本数,reference.samples.length);
    for(const [list,key] of [['W1','w1'],['B1','b1'],['W2','w2']])s.lists[list].forEach((w,j)=>assert(Math.abs(Number(w)-reference[key][j])<1e-8,`${list}[${j}] parity`));
    assert(Math.abs(s.b2-reference.b2)<1e-8);assert.equal(s.variables.训练轮次,reference.epochs);
  }
  const trained=await state('trained');assert(Number(trained.variables.均方误差)<.02);assert.notDeepEqual(model(trained),initialModel);check('U02/U04 真正训练并与参考模型逐权重一致',`MSE ${trained.variables.均方误差}`);
  const beforePrediction=model(trained),prediction=await predict(1.5);assert(Math.abs(prediction-3)<.35);assert(Math.abs(prediction-reference.predict(1.5))<.0001);assert.deepEqual(model(await state()),beforePrediction);
  assert.equal(await predict(1.5),prediction);assert.deepEqual(model(await state()),beforePrediction);check('U03/U05 未见样本预测、重复测试和只读性',prediction);
  await page.screenshot({path:path.join(root,'evidence/editor-trained.png')});
  await train(1,1.8);const duplicate=await state('duplicate');assert.equal(duplicate.variables.样本数,3);assert.deepEqual(duplicate.lists.样本Y,[0,1.8,4]);check('U08 相同输入更新目标并保留其他样本');
  await reset();const resetState=await state('reset');assert.deepEqual(model(resetState),initialModel);assert.equal(resetState.variables.预测输出,'—');check('U06 重置清除样本和旧模型');
  await clickButton('训练按钮');await page.locator('[class*="question_question-input"] input').waitFor({state:'visible'});await clickButton('测试按钮');await clickButton('重置按钮');assert.equal((await state()).variables.忙碌,1);await answer(-1);await answer(2);await idle();assert.equal((await state()).variables.样本数,1);check('U09 忙碌时重复点击不叠加问答');
  await reset();await train(1,-2);assert(Number(await predict(1))< -1.9);check('U06 新一轮学习不同规则');
  await page.evaluate(()=>{const s=vm.runtime.getTargetForStage();s.variables.l_样本X.value=Array.from({length:32},(_,i)=>i);s.variables.l_样本Y.value=Array.from({length:32},(_,i)=>i);s.variables.v_样本数.value=32;});
  const full=model(await state());await train(33,33);assert.deepEqual(model(await state()),full);check('U10 样本上限拒绝且原模型保持（32 样本 fixture）');
  await train(0,-1);const fullUpdated=await state('full sample update');assert.equal(fullUpdated.variables.样本数,32);assert.equal(fullUpdated.lists.样本Y[0],-1);check('U10 样本满额仍可更新已有输入');
  await reset();await train(0,0);await train(1,2);await train(2,4);await predict(1.5);
  const saved=await page.evaluate(async()=>{const bytes=new Uint8Array(await (await vm.saveProjectSb3()).arrayBuffer());let s='';for(const x of bytes)s+=String.fromCharCode(x);return btoa(s);});
  await fs.writeFile(path.join(root,'dist/neural-network-trained-example.sb3'),Buffer.from(saved,'base64'));
  await page.evaluate(async b64=>{await vm.loadProject(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer);vm.setEditingTarget(vm.runtime.targets.find(t=>t.getName()==='神经网络').id);},saved);
  const savedPrediction=await predict(1.5);assert(Math.abs(savedPrediction-prediction)<.0001);check('U11 保存重载保留模型并可继续测试');
  // Full-stage mode scales the fixed Scratch stage to desktop and narrow viewports.
  await page.locator('img[title="全屏模式"]').click();
  await page.screenshot({path:path.join(root,'evidence/desktop-stage.png')});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
  await page.screenshot({path:path.join(root,'evidence/mobile-stage.png')});
  for(const name of ['重置按钮','训练按钮','测试按钮']){const t=await page.evaluate(n=>{const x=vm.runtime.targets.find(t=>t.getName()===n);return {visible:x.visible,x:x.x,y:x.y};},name);assert(t.visible&&Math.abs(t.x)<180&&Math.abs(t.y)<160);}
  await reset();assert.equal((await state()).variables.样本数,0);check('U12 窄屏下真实按钮可点击并重置');
  assert.equal(report.errors.length,0);assert.equal((await state()).compileErrors.length,0);check('无页面或 VM 编译异常');
  report.status='PASS';
}catch(error){report.status='FAIL';report.error={message:error.message,stack:error.stack};console.error(error);await page.screenshot({path:path.join(root,'evidence/failure.png')});await fs.writeFile(path.join(root,'evidence/failure-dom.html'),await page.content());process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();const data=JSON.stringify(report,null,2);await fs.writeFile(path.join(root,'evidence',`editor-test-${report.startedAt.replace(/[:.]/g,'-')}.json`),data);await fs.writeFile(path.join(root,'evidence/editor-test.json'),data);await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error?.message}));}
