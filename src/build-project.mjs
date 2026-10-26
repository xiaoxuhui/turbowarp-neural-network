import JSZip from 'jszip';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ScratchBuilder,expr,cmd,V,L,length,arg,set,change,clear,push,replace,add,sub,mul,div,mod,eq,gt,and,not,math,join,repeat,iff,wait,forever,broadcast,stop,variableId,listId} from './scratch-builder.mjs';

export const ROOT=fileURLToPath(new URL('../',import.meta.url));
const variables={状态:'点击训练，给网络一组输入和输出',忙碌:0,样本数:0,训练轮次:0,均方误差:'—',测试输入:'—',预测输出:'—',最近样本:'—',j:0,k:0,valid:0,tmpX:0,tmpY:0,sampleIndex:0,scaleX:1,scaleY:1,normalizedX:0,normalizedY:0,z:0,exp2z:0,pred:0,dOut:0,dHidden:0,B2:0,lossSum:0};
const lists=['样本X','样本Y','W1','B1','W2','H'];
const globals=Object.fromEntries(Object.entries(variables).map(([name,value])=>[variableId(name),[name,value]]));
const listData=Object.fromEntries(lists.map(name=>[listId(name),[name,[]]]));
const broadcasts=Object.fromEntries(['重置','训练','测试'].map(n=>[`msg_${n}`,n]));
const ANSWER=()=>expr('sensing_answer');
const ask=q=>cmd('sensing_askandwait',{QUESTION:q});
const round=(v,precision=10000)=>div(expr('operator_round',{NUM:mul(v,precision)}),precision);
const abs=x=>math('abs',x);
const b=new ScratchBuilder('network');

// Core math procedures, each emitted as ordinary editable Scratch blocks.
b.define('初始化权重',[],[
  ...['W1','B1','W2','H'].map(clear),set('B2',0),set('j',1),
  repeat(6,[push('W1',div(sub(mod(mul(V('j'),37),101),50),50)),push('B1',div(sub(mod(mul(V('j'),19),31),15),100)),push('W2',div(sub(mod(mul(V('j'),17),47),23),100)),push('H',0),change('j',1)])
],[40,40]);
b.define('前向计算',['x'],[
  set('pred',V('B2')),set('j',1),repeat(6,[
    set('z',add(mul(L('W1',V('j')),arg('x')),L('B1',V('j')))),
    iff(gt(V('z'),10),[set('z',10)]),iff(gt(-10,V('z')),[set('z',-10)]),
    set('exp2z',math('e ^',mul(2,V('z')))),
    replace('H',V('j'),div(sub(V('exp2z'),1),add(V('exp2z'),1))),
    change('pred',mul(L('H',V('j')),L('W2',V('j')))),change('j',1)
  ])
],[420,40]);
b.define('训练一批',['轮数'],[
  repeat(arg('轮数'),[set('k',1),repeat(length('样本X'),[
    set('normalizedX',div(L('样本X',V('k')),V('scaleX'))),set('normalizedY',div(L('样本Y',V('k')),V('scaleY'))),
    b.call('前向计算',V('normalizedX')),set('dOut',mul(2,sub(V('pred'),V('normalizedY')))),set('j',1),
    repeat(6,[
      set('dHidden',mul(mul(V('dOut'),L('W2',V('j'))),sub(1,mul(L('H',V('j')),L('H',V('j')))))),
      replace('W1',V('j'),sub(L('W1',V('j')),mul(mul(.08,V('dHidden')),V('normalizedX')))),
      replace('B1',V('j'),sub(L('B1',V('j')),mul(.08,V('dHidden')))),
      replace('W2',V('j'),sub(L('W2',V('j')),mul(mul(.08,V('dOut')),L('H',V('j'))))),change('j',1)
    ]),change('B2',mul(-.08,V('dOut'))),change('k',1)
  ])])
],[820,40]);
b.define('计算误差',[],[
  set('lossSum',0),set('k',1),repeat(length('样本X'),[
    b.call('前向计算',div(L('样本X',V('k')),V('scaleX'))),
    set('z',sub(mul(V('pred'),V('scaleY')),L('样本Y',V('k')))),change('lossSum',mul(V('z'),V('z'))),change('k',1)
  ]),set('均方误差',round(div(V('lossSum'),length('样本X')),1000000))
],[1240,40]);
b.define('检查数字',['数值'],[
  set('valid',0),iff(and(gt(expr('operator_length',{STRING:arg('数值')}),0),and(eq(add(arg('数值'),0),arg('数值')),not(gt(abs(add(arg('数值'),0)),1000)))),[set('valid',1)])
],[40,700]);
b.define('清空并重置',[],[
  clear('样本X'),clear('样本Y'),b.call('初始化权重'),set('样本数',0),set('训练轮次',0),set('均方误差','—'),set('测试输入','—'),set('预测输出','—'),set('最近样本','—'),set('scaleX',1),set('scaleY',1),set('状态','已重置，请点击训练添加样本')
],[420,700]);
b.hat('event_whenflagclicked',{},[set('忙碌',0),b.call('清空并重置')],[40,1250]);
b.hat('event_whenbroadcastreceived',{BROADCAST_OPTION:['重置','msg_重置']},[
  iff(eq(V('忙碌'),0),[set('忙碌',1),b.call('清空并重置'),set('忙碌',0)])
],[420,1250]);
const abort=message=>[set('状态',message),set('忙碌',0),stop()];
b.hat('event_whenbroadcastreceived',{BROADCAST_OPTION:['训练','msg_训练']},[
  iff(eq(V('忙碌'),0),[
    set('忙碌',1),set('状态','训练：请输入样本的输入值'),ask('训练输入 x 是多少？（-1000 到 1000）'),b.call('检查数字',ANSWER()),
    iff(eq(V('valid'),0),abort('输入无效，请使用 -1000 到 1000 的数字')),
    set('tmpX',add(ANSWER(),0)),set('状态','训练：请输入你希望得到的输出值'),ask('对应的目标输出 y 是多少？（-1000 到 1000）'),b.call('检查数字',ANSWER()),
    iff(eq(V('valid'),0),abort('目标无效，本次样本未添加')),
    set('tmpY',add(ANSWER(),0)),set('sampleIndex',expr('data_itemnumoflist',{ITEM:V('tmpX')},{LIST:['样本X',listId('样本X')]})),
    iff(and(eq(V('sampleIndex'),0),gt(length('样本X'),31)),abort('已有 32 个样本，请重置或更新相同输入')),
    iff(gt(V('sampleIndex'),0),[replace('样本Y',V('sampleIndex'),V('tmpY'))],[push('样本X',V('tmpX')),push('样本Y',V('tmpY'))]),
    set('样本数',length('样本X')),set('最近样本',join(V('tmpX'),join(' → ',V('tmpY')))),set('测试输入','—'),set('预测输出','—'),
    set('忙碌',3),set('状态','正在学习全部样本，请稍候…'),set('均方误差','…'),set('scaleX',1),set('scaleY',1),set('k',1),
    repeat(length('样本X'),[
      iff(gt(abs(L('样本X',V('k'))),V('scaleX')),[set('scaleX',abs(L('样本X',V('k'))))]),
      iff(gt(abs(L('样本Y',V('k'))),V('scaleY')),[set('scaleY',abs(L('样本Y',V('k'))))]),change('k',1)
    ]),b.call('初始化权重'),
    repeat(24,[b.call('训练一批',25),change('训练轮次',25),wait(0)]),b.call('计算误差'),
    set('状态','训练完成：继续添加样本，或点击测试'),set('忙碌',0)
  ])
],[820,1250]);
b.hat('event_whenbroadcastreceived',{BROADCAST_OPTION:['测试','msg_测试']},[
  iff(eq(V('忙碌'),0),[
    iff(eq(V('样本数'),0),[...abort('还没有样本，请先点击训练')]),
    set('忙碌',2),set('状态','测试：请输入一个数字'),ask('要测试的输入 x 是多少？（-1000 到 1000）'),b.call('检查数字',ANSWER()),
    iff(eq(V('valid'),0),abort('测试输入无效，模型没有改变')),
    set('测试输入',add(ANSWER(),0)),b.call('前向计算',div(V('测试输入'),V('scaleX'))),set('预测输出',round(mul(V('pred'),V('scaleY')))),
    set('状态','预测完成；测试不会修改训练结果'),set('忙碌',0)
  ])
],[1240,1250]);

const svg=(body,w=480,h=360)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>text{font-family:'Microsoft YaHei','Noto Sans SC',sans-serif}</style>${body}</svg>`;
const hiddenYs=[123,144,165,186,207,228];
const backdrop=svg(`<rect width="480" height="360" fill="#f4f5fb"/><rect x="12" y="12" width="456" height="44" rx="14" fill="#17253f"/><text x="26" y="40" font-size="20" fill="white" font-weight="bold">神经网络实验室</text><text x="341" y="39" font-size="12" fill="#c7d2ef">1 → 6 → 1 · v0.1.0</text><rect x="12" y="62" width="456" height="34" rx="10" fill="white"/><rect x="12" y="103" width="270" height="139" rx="13" fill="white"/><rect x="290" y="103" width="178" height="139" rx="13" fill="white"/><text x="29" y="123" font-size="11" fill="#7b86a4">输入</text><text x="117" y="123" font-size="11" fill="#7b86a4">隐藏层</text><text x="228" y="123" font-size="11" fill="#7b86a4">输出</text>${hiddenYs.map(y=>`<path d="M54 177L144 ${y+7}L244 177" fill="none" stroke="#cbd4f1" stroke-width="1.4"/>`).join('')}<circle cx="54" cy="177" r="16" fill="#4c70d9"/><text x="54" y="182" font-size="14" text-anchor="middle" fill="white">x</text>${hiddenYs.map((y,i)=>`<circle cx="144" cy="${y+7}" r="7.5" fill="${i%2?'#9b8cdd':'#758cdf'}"/>`).join('')}<circle cx="244" cy="177" r="16" fill="#f49c64"/><text x="244" y="182" font-size="14" text-anchor="middle" fill="white">ŷ</text><text x="307" y="125" font-size="12" fill="#677494">测试输入</text><text x="307" y="171" font-size="12" fill="#677494">近似预测</text><rect x="12" y="249" width="456" height="28" rx="9" fill="#e8edf8"/><text x="240" y="349" font-size="10" text-anchor="middle" fill="#74809e">先训练，再测试。数字范围 −1000 ~ 1000；快捷键 1 / 2 / 3</text>`);
const zip=new JSZip();
function costume(name,source,cx,cy){const assetId=crypto.createHash('md5').update(source).digest('hex'),md5ext=`${assetId}.svg`;zip.file(md5ext,source,{date:new Date('2026-01-01T00:00:00Z')});return {assetId,name,dataFormat:'svg',md5ext,bitmapResolution:1,rotationCenterX:cx,rotationCenterY:cy};}
const base={variables:{},lists:{},broadcasts:{},blocks:{},comments:{},currentCostume:0,costumes:[],sounds:[],volume:100};
const stage={...base,isStage:true,name:'舞台',variables:globals,lists:listData,broadcasts,costumes:[costume('神经网络面板',backdrop,240,180)],layerOrder:0,tempo:60,videoTransparency:50,videoState:'on',textToSpeechLanguage:null};
const sprite=(name,blocks,costumes,x,y,layerOrder,visible=true)=>({...base,isStage:false,name,blocks,costumes,x,y,layerOrder,visible,size:100,direction:90,draggable:false,rotationStyle:'don\'t rotate'});
const controller=sprite('神经网络',b.blocks,[costume('隐藏控制器',svg('<circle cx="1" cy="1" r="1" fill="white"/>',2,2),1,1)],0,0,1,false);
const buttons=['重置','训练','测试'].map((name,i)=>{
  const s=new ScratchBuilder(`button${i}`),colors=['#dfe5f3','#6554bf','#267b80'],ink=i?'white':'#455570';
  s.hat('event_whenthisspriteclicked',{},[broadcast(name)],[40,40]);
  s.hat('event_whenkeypressed',{KEY_OPTION:[String(i+1),null]},[broadcast(name)],[320,40]);
  s.hat('event_whenflagclicked',{},[forever([iff(gt(V('忙碌'),0),[cmd('looks_seteffectto',{VALUE:-25},{EFFECT:['BRIGHTNESS',null]})],[cmd('looks_cleargraphiceffects')]),wait(.1)])],[40,230]);
  const art=svg(`<rect x="1" y="3" width="134" height="40" rx="12" fill="#15243f" opacity=".10"/><rect x="1" y="0" width="134" height="40" rx="12" fill="${colors[i]}"/><text x="68" y="26" text-anchor="middle" font-weight="bold" font-size="18" fill="${ink}">${name}</text>`,136,44);
  return sprite(`${name}按钮`,s.blocks,[costume(name,art,68,22)],(i-1)*154,-128,i+2);
});
const monitor=(name,x,y,mode='default')=>({id:variableId(name),mode,opcode:'data_variable',params:{VARIABLE:name},spriteName:null,value:variables[name],width:0,height:0,x,y,visible:true,sliderMin:0,sliderMax:100,isDiscrete:true});
export const project={targets:[stage,controller,...buttons],monitors:[monitor('样本数',21,69),monitor('训练轮次',132,69),monitor('均方误差',285,69),monitor('测试输入',307,132,'large'),monitor('预测输出',307,179,'large'),monitor('最近样本',295,215),monitor('状态',18,253)],extensions:[],meta:{semver:'3.0.0',vm:'0.2.0',agent:'TurboWarp Neural Network Lab 0.1.0'}};
export async function build({write=true}={}){
  zip.file('project.json',JSON.stringify(project),{date:new Date('2026-01-01T00:00:00Z')});
  const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  if(write)await fs.writeFile(path.join(ROOT,'dist/neural-network.sb3'),bytes);
  if(write)await fs.writeFile(path.join(ROOT,'dist/project.json'),JSON.stringify(project,null,2));
  const summary={path:'dist/neural-network.sb3',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),targets:project.targets.map(t=>t.name),blocks:project.targets.reduce((n,t)=>n+Object.keys(t.blocks).length,0)};
  if(write)await fs.writeFile(path.join(ROOT,'dist/manifest.json'),JSON.stringify(summary,null,2));if(write)console.log(JSON.stringify(summary,null,2));return bytes;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
