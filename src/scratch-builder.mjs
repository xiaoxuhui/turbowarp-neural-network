// Small SB3 serialization helper. All calculations are emitted as visible Scratch blocks.
export const expr=(opcode,inputs={},fields={})=>({opcode,inputs,fields});
export const cmd=expr;
export const variableId=name=>`v_${name}`;
export const listId=name=>`l_${name}`;
export const V=name=>expr('data_variable',{}, {VARIABLE:[name,variableId(name)]});
export const L=(name,index)=>expr('data_itemoflist',{INDEX:index},{LIST:[name,listId(name)]});
export const length=name=>expr('data_lengthoflist',{}, {LIST:[name,listId(name)]});
export const arg=name=>expr('argument_reporter_string_number',{}, {VALUE:[name,null]});
export const set=(name,value)=>cmd('data_setvariableto',{VALUE:value},{VARIABLE:[name,variableId(name)]});
export const change=(name,value)=>cmd('data_changevariableby',{VALUE:value},{VARIABLE:[name,variableId(name)]});
export const clear=name=>cmd('data_deletealloflist',{}, {LIST:[name,listId(name)]});
export const push=(name,value)=>cmd('data_addtolist',{ITEM:value},{LIST:[name,listId(name)]});
export const replace=(name,index,value)=>cmd('data_replaceitemoflist',{INDEX:index,ITEM:value},{LIST:[name,listId(name)]});
export const add=(a,b)=>expr('operator_add',{NUM1:a,NUM2:b});
export const sub=(a,b)=>expr('operator_subtract',{NUM1:a,NUM2:b});
export const mul=(a,b)=>expr('operator_multiply',{NUM1:a,NUM2:b});
export const div=(a,b)=>expr('operator_divide',{NUM1:a,NUM2:b});
export const mod=(a,b)=>expr('operator_mod',{NUM1:a,NUM2:b});
export const eq=(a,b)=>expr('operator_equals',{OPERAND1:a,OPERAND2:b});
export const gt=(a,b)=>expr('operator_gt',{OPERAND1:a,OPERAND2:b});
export const and=(a,b)=>expr('operator_and',{OPERAND1:a,OPERAND2:b});
export const not=a=>expr('operator_not',{OPERAND:a});
export const math=(op,x)=>expr('operator_mathop',{NUM:x},{OPERATOR:[op,null]});
export const join=(a,b)=>expr('operator_join',{STRING1:a,STRING2:b});
export const repeat=(times,body)=>({...cmd('control_repeat',{TIMES:times}),substacks:{SUBSTACK:body}});
export const iff=(condition,yes,no)=>({...cmd(no?'control_if_else':'control_if',{CONDITION:condition}),substacks:{SUBSTACK:yes,...(no?{SUBSTACK2:no}:{})}});
export const wait=seconds=>cmd('control_wait',{DURATION:seconds});
export const forever=body=>({...cmd('control_forever'),substacks:{SUBSTACK:body}});
export const broadcast=name=>cmd('event_broadcastandwait',{BROADCAST_INPUT:{primitive:[11,name,`msg_${name}`]}});
export const stop=()=>({...cmd('control_stop',{}, {STOP_OPTION:['this script',null]}),mutation:{tagName:'mutation',children:[],hasnext:'false'}});

export class ScratchBuilder {
  constructor(prefix){this.prefix=prefix;this.blocks={};this.counter=0;this.procedures=new Map();}
  id(){return `${this.prefix}_${++this.counter}`;}
  input(value,parent){
    if(value&&typeof value==='object'&&value.primitive)return [1,value.primitive];
    if(value&&typeof value==='object'&&value.opcode)return [2,this.block(value,parent)];
    return [1,[typeof value==='number'?4:10,String(value??'')]];
  }
  block(node,parent=null,topLevel=false,position=null){
    const id=this.id();
    const b=this.blocks[id]={opcode:node.opcode,next:null,parent,inputs:{},fields:node.fields||{},shadow:false,topLevel};
    if(node.mutation)b.mutation=node.mutation;
    if(position){b.x=position[0];b.y=position[1];}
    for(const [key,value] of Object.entries(node.inputs||{}))b.inputs[key]=this.input(value,id);
    for(const [key,stack] of Object.entries(node.substacks||{})){const first=this.stack(stack,id);if(first)b.inputs[key]=[2,first];}
    return id;
  }
  stack(nodes,parent){let first=null,previous=null;for(const node of nodes){const id=this.block(node,previous||parent);if(previous)this.blocks[previous].next=id;else first=id;previous=id;}return first;}
  hat(opcode,fields,body,position){const id=this.block(cmd(opcode,{},fields),null,true,position);this.blocks[id].next=this.stack(body,id);return id;}
  define(name,argNames,body,position=[0,0],warp=true){
    const ids=argNames.map((_,i)=>`${this.prefix}_arg_${name}_${i}`);
    const signature={tagName:'mutation',children:[],proccode:name+(ids.length?' '+ids.map(()=>'%s').join(' '):''),argumentids:JSON.stringify(ids),warp:String(warp)};
    this.procedures.set(name,{ids,signature});
    const definition=this.block(cmd('procedures_definition'),null,true,position);
    const prototype=this.id();
    const p=this.blocks[prototype]={opcode:'procedures_prototype',next:null,parent:definition,inputs:{},fields:{},shadow:true,topLevel:false,mutation:{...signature,argumentnames:JSON.stringify(argNames),argumentdefaults:JSON.stringify(argNames.map(()=>''))}};
    this.blocks[definition].inputs.custom_block=[1,prototype];
    argNames.forEach((n,i)=>{const aid=this.block(arg(n),prototype);this.blocks[aid].shadow=true;p.inputs[ids[i]]=[1,aid];});
    this.blocks[definition].next=this.stack(body,definition);
  }
  call(name,...values){const p=this.procedures.get(name);if(!p)throw Error(`Undefined procedure ${name}`);return {...cmd('procedures_call',Object.fromEntries(p.ids.map((id,i)=>[id,values[i]]))),mutation:p.signature};}
}
