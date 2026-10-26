(() => {
 'use strict';
 const config=window.__hallConfig,codec=window.TurboHallState,scaffolding=window.scaffolding,vm=scaffolding.vm;
 const key=config.id+'.state.v1';
 const banner=document.createElement('div');banner.id='hall-banner';
 const status=document.createElement('span');status.role='status';status.textContent='正在恢复进度…';
 const restart=document.createElement('button');restart.type='button';restart.textContent='从原始作品重新开始';restart.hidden=true;
 banner.append(status,restart);document.body.append(banner);
 let ready=false,locked=false,last='',template,initial,booting=false,storageError=false;
 const stage=()=>vm.runtime.getTargetForStage();
 const values=()=>Object.fromEntries(Object.entries(stage().variables).map(([id,v])=>[id,codec.clone(v.value)]));
 const idle=()=>stage()&&Number(stage().variables.v_忙碌.value)===0&&(config.kind!=='logic'||Number(stage().variables.v_来源.value)===0);
 const normalized=()=>{const v=values();if(config.kind==='logic'){v.v_清空时刻=-10;v.v_动作=0;}return v;};
 function save(){
  if(!ready||locked||!idle())return false;
  const variables=normalized(),encoded=JSON.stringify(variables);
  if(encoded===last)return true;
  try{
   const data={schemaVersion:1,id:config.id,contract:config.id+'-dynamic-v1',variables};codec.validate(data,config,template);
   localStorage.setItem(key,JSON.stringify(data));last=encoded;status.textContent='进度已自动保存在本机';storageError=false;return true;
  }catch(error){status.textContent='暂时无法保存进度，请保留当前页面';storageError=true;return false;}
 }
 async function settle(){
  const deadline=performance.now()+10000;await new Promise(r=>setTimeout(r,120));
  while(!idle()||(config.kind==='logic'&&vm.runtime.targets.filter(t=>!t.isOriginal).length!==24)){
   if(performance.now()>deadline)throw Error('作品初始化超时');await new Promise(r=>setTimeout(r,30));
  }
 }
 async function apply(data){
  codec.validate(data,config,template);
  for(const [id,value] of Object.entries(data.variables))stage().variables[id].value=codec.clone(value);
  if(config.kind==='logic'){
   stage().variables.v_动作.value=Math.max(1,Math.min(6,Number(stage().variables.v_工具.value)||2));
   vm.runtime.startHats('event_whenbroadcastreceived',{BROADCAST_OPTION:'工具点击'});await settle();
  }
 }
 const originalStart=scaffolding.start.bind(scaffolding);
 scaffolding.start=()=>{
  if(booting)return;booting=true;
  initial={schemaVersion:1,id:config.id,contract:config.id+'-dynamic-v1',variables:values()};template=codec.clone(initial.variables);
  let restore=initial;
  try{const raw=localStorage.getItem(key);if(raw!==null)restore=codec.parse(raw,config,template);}
  catch(error){locked=true;status.textContent='存档无法恢复，原数据已保留；可选择重新开始';restart.hidden=false;}
  originalStart();
  (async()=>{await settle();if(config.kind==='neural'&&initial.variables.l_W1.length===0)initial.variables=values();if(!locked)await apply(restore);ready=true;window.hall.ready=true;
   if(!locked){last='';save();}
   setInterval(save,200);vm.runtime.on('AFTER_EXECUTE',save);
  })().catch(error=>{locked=true;status.textContent='作品恢复失败，原存档已保留';restart.hidden=false;window.hall.error=String(error);});
 };
 restart.addEventListener('click',async()=>{
  if(!window.confirm('保留原存档的恢复副本，并从作品初始状态重新开始？'))return;
  try{const raw=localStorage.getItem(key);if(raw!==null)localStorage.setItem(config.id+'.recovery.'+Date.now(),raw);await apply(initial);locked=false;restart.hidden=true;last='';save();}
  catch(error){status.textContent='无法安全恢复，请保留当前页面和存档';}
 });
 window.addEventListener('pagehide',save);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
 new MutationObserver(()=>{for(const input of document.querySelectorAll('.sc-question-input')){input.inputMode='decimal';input.autocomplete='off';input.setAttribute('aria-label','输入数字');}}).observe(document.body,{childList:true,subtree:true});
 window.hall={ready:false,save,storageKey:key,state:()=>values(),get storageError(){return storageError;}};
})();
