import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import JSZip from 'jszip';
const codec=createRequire(import.meta.url)('../web/state.cjs');
const config=JSON.parse(await fs.readFile(new URL('../web/config.json',import.meta.url),'utf8'));
const zip=await JSZip.loadAsync(await fs.readFile(new URL('../'+config.project,import.meta.url)));
const stage=JSON.parse(await zip.file('project.json').async('string')).targets.find(t=>t.isStage);
const template=Object.fromEntries([...Object.entries(stage.variables),...Object.entries(stage.lists)].map(([id,v])=>[id,v[1]]));
const valid=()=>({schemaVersion:1,id:config.id,contract:config.id+'-dynamic-v1',variables:codec.clone(template)});
test('saved native model retains exact samples, weights and training epochs',()=>{
 const data=valid();assert.deepEqual(codec.parse(JSON.stringify(data),config,template),data);
 assert.equal(data.variables.v_训练轮次,2400);assert.deepEqual(data.variables.l_样本X,[2,3,1]);
});
test('malformed and foreign saves are rejected without changing input',()=>{
 for(const raw of ['{broken','null',JSON.stringify({...valid(),id:'another-game'}),JSON.stringify({...valid(),schemaVersion:2})])assert.throws(()=>codec.parse(raw,config,template));
 const d=valid(),before=JSON.stringify(d);codec.validate(d,config,template);assert.equal(JSON.stringify(d),before);
});
test('missing and unknown variable identities cannot be restored',()=>{
 const d=valid();delete d.variables.v_B2;assert.throws(()=>codec.validate(d,config,template));
 const extra=valid();extra.variables.unknown=1;assert.throws(()=>codec.validate(extra,config,template));
});
test('partial training, bad model shape and invalid scaling are rejected',()=>{
 for(const change of [v=>v.v_忙碌=3,v=>v.l_W1.pop(),v=>v.l_样本Y.pop(),v=>v.v_scaleX='Infinity',v=>v.v_样本数=32,v=>v.l_样本X[0]=1001]){
  const d=valid();change(d.variables);assert.throws(()=>codec.validate(d,config,template));
 }
});
test('oversized state is rejected before parsing',()=>assert.throws(()=>codec.parse(' '.repeat(100001),config,template)));
