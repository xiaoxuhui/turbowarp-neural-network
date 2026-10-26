(function(root){
 'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 function validate(data,config,template){
  if(!data||data.schemaVersion!==1||data.id!==config.id||data.contract!==config.id+'-dynamic-v1'||!data.variables||Array.isArray(data.variables))throw Error('存档版本或项目不匹配');
  const keys=Object.keys(template).sort();
  if(JSON.stringify(Object.keys(data.variables).sort())!==JSON.stringify(keys))throw Error('存档字段不完整');
  const scalar=v=>typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.length<=256;
  for(const id of keys){const value=data.variables[id];if(Array.isArray(template[id])){if(!Array.isArray(value)||value.length>512||!value.every(scalar))throw Error('存档列表无效');}else if(!scalar(value)||Array.isArray(value))throw Error('存档数值无效');}
  const v=data.variables;
  if(Number(v.v_忙碌)!==0)throw Error('存档来自未完成操作');
  if(config.kind==='neural'){
   const xs=v.l_样本X,ys=v.l_样本Y;
   if(xs.length!==ys.length||xs.length>32||xs.some(x=>!Number.isFinite(Number(x))||Math.abs(Number(x))>1000)||ys.some(x=>!Number.isFinite(Number(x))||Math.abs(Number(x))>1000))throw Error('训练样本无效');
   if(Number(v.v_样本数)!==xs.length||!Number.isSafeInteger(Number(v.v_训练轮次))||Number(v.v_训练轮次)<0)throw Error('训练记录不一致');
   for(const n of ['l_W1','l_B1','l_W2','l_H'])if(v[n].length!==6||v[n].some(x=>!Number.isFinite(Number(x))))throw Error('模型权重无效');
   if(!Number.isFinite(Number(v.v_B2))||!Number.isFinite(Number(v.v_scaleX))||!Number.isFinite(Number(v.v_scaleY))||!(Number(v.v_scaleX)>0)||!(Number(v.v_scaleY)>0))throw Error('模型缩放无效');
  }else{
   for(const [n,max] of [['T',6],['A',24],['B',24],['Q',1]])if(v['l_'+n].length!==24||v['l_'+n].some(x=>!Number.isInteger(Number(x))||Number(x)<0||Number(x)>max))throw Error('电路数据无效');
   if(Number(v.v_来源)!==0)throw Error('存档含未完成连线');
   for(const n of ['U_T','U_A','U_B','U_Q'])if(v['l_'+n].length!==(Number(v.v_可撤销)===1?24:0)&&v['l_'+n].length!==24)throw Error('撤销快照无效');
   const marks=Array(24).fill(0);
   const visit=i=>{if(marks[i]===1)throw Error('电路含反馈');if(marks[i]===2)return;marks[i]=1;const type=Number(v.l_T[i]);if(type>=2){const ports=[v.l_A[i]];if([2,4,5].includes(type))ports.push(v.l_B[i]);for(const p of ports)if(Number(p)){if(!Number(v.l_T[Number(p)-1]))throw Error('电路来源为空');visit(Number(p)-1);}}marks[i]=2;};
   for(let i=0;i<24;i++)visit(i);
  }
  return data;
 }
 function parse(raw,config,template){if(typeof raw!=='string'||raw.length>100000)throw Error('存档大小无效');return validate(JSON.parse(raw),config,template);}
 const api={clone,validate,parse};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TurboHallState=api;
})(typeof window==='undefined'?globalThis:window);
