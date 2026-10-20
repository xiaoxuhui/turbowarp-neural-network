import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {build,project} from '../src/build-project.mjs';

test('valid SB3 contains every referenced block, variable, list and asset',async()=>{
  const bytes=await build(),zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
  assert.equal(project.targets.length,5);assert.equal(project.extensions.length,0);
  const vars=new Set(Object.keys(project.targets[0].variables)),lists=new Set(Object.keys(project.targets[0].lists));
  for(const t of project.targets){
    for(const c of t.costumes){const data=await zip.file(c.md5ext).async('nodebuffer');assert.equal(crypto.createHash('md5').update(data).digest('hex'),c.assetId);}
    for(const [id,b] of Object.entries(t.blocks)){
      for(const ref of [b.next,b.parent])if(ref)assert(t.blocks[ref],`${id}: ${ref}`);
      for(const v of Object.values(b.inputs))for(const ref of v.slice(1))if(typeof ref==='string')assert(t.blocks[ref],`${id} input ${ref}`);
      if(b.fields.VARIABLE)assert(vars.has(b.fields.VARIABLE[1]));
      if(b.fields.LIST)assert(lists.has(b.fields.LIST[1]));
    }
  }
});
test('three clickable buttons, keyboard shortcuts and real backprop procedure exist',()=>{
  for(const t of project.targets.slice(2)){assert(t.visible);assert(Object.values(t.blocks).some(b=>b.opcode==='event_whenthisspriteclicked'));assert(Object.values(t.blocks).some(b=>b.opcode==='event_whenkeypressed'));}
  const prototypes=Object.values(project.targets[1].blocks).filter(b=>b.opcode==='procedures_prototype');
  for(const name of ['前向计算 %s','训练一批 %s','检查数字 %s','清空并重置'])assert(prototypes.some(b=>b.mutation.proccode===name));
  assert(Object.values(project.targets[1].blocks).filter(b=>b.opcode==='data_replaceitemoflist').length>=5);
});
test('package, visible stage and changelog carry the same version',async()=>{
  const version=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8')).version;
  const zip=await JSZip.loadAsync(await build());
  const asset=project.targets[0].costumes[0].md5ext;
  assert((await zip.file(asset).async('string')).includes(`v${version}`));
  assert((await fs.readFile(new URL('../CHANGELOG.md',import.meta.url),'utf8')).includes(`## ${version}`));
});
