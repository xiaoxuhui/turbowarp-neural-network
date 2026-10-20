export const LIMIT=1000, HIDDEN=6, EPOCHS=600, RATE=.08;
export function parseNumber(value) {
  if(String(value).trim()==='')return null;
  const n=Number(value);return Number.isFinite(n)&&Math.abs(n)<=LIMIT?n:null;
}
export class NeuralNetwork {
  constructor({epochsPerTrain=EPOCHS}={}){this.epochsPerTrain=epochsPerTrain;this.reset();}
  initialize(){
    this.w1=Array.from({length:HIDDEN},(_,k)=>(((k+1)*37%101)-50)/50);
    this.b1=Array.from({length:HIDDEN},(_,k)=>(((k+1)*19%31)-15)/100);
    this.w2=Array.from({length:HIDDEN},(_,k)=>(((k+1)*17%47)-23)/100);
    this.b2=0;
  }
  reset(){this.samples=[];this.epochs=0;this.loss=null;this.sx=1;this.sy=1;this.initialize();}
  weights(){return {w1:[...this.w1],b1:[...this.b1],w2:[...this.w2],b2:this.b2};}
  activation(x){return this.w1.map((w,j)=>Math.tanh(Math.max(-10,Math.min(10,w*x+this.b1[j]))));}
  forward(x){const h=this.activation(x);return this.b2+h.reduce((sum,v,j)=>sum+v*this.w2[j],0);}
  gradients(x,y){
    const h=this.activation(x),d=2*(this.b2+h.reduce((sum,v,j)=>sum+v*this.w2[j],0)-y);
    const dh=h.map((v,j)=>d*this.w2[j]*(1-v*v));
    return {w1:dh.map(v=>v*x),b1:dh,w2:h.map(v=>d*v),b2:d};
  }
  train(x,y){
    if(parseNumber(x)===null||parseNumber(y)===null)throw RangeError('Please enter finite numbers from -1000 to 1000');
    x=Number(x);y=Number(y);
    const index=this.samples.findIndex(s=>s[0]===x);
    if(index<0&&this.samples.length>=32)throw RangeError('At most 32 distinct inputs');
    if(index<0)this.samples.push([x,y]);else this.samples[index]=[x,y];
    this.sx=Math.max(1,...this.samples.map(s=>Math.abs(s[0])));this.sy=Math.max(1,...this.samples.map(s=>Math.abs(s[1])));
    this.initialize();
    for(let epoch=0;epoch<this.epochsPerTrain;epoch++)for(const [rawX,rawY] of this.samples){
      const g=this.gradients(rawX/this.sx,rawY/this.sy);
      for(let j=0;j<HIDDEN;j++){this.w1[j]-=RATE*g.w1[j];this.b1[j]-=RATE*g.b1[j];this.w2[j]-=RATE*g.w2[j];}
      this.b2-=RATE*g.b2;
    }
    this.epochs+=this.epochsPerTrain;
    this.loss=this.samples.reduce((sum,[vx,vy])=>sum+(this.forward(vx/this.sx)*this.sy-vy)**2,0)/this.samples.length;
    return this.loss;
  }
  predict(x){if(!this.samples.length)throw Error('Train first');if(parseNumber(x)===null)throw RangeError('Invalid input');return this.forward(Number(x)/this.sx)*this.sy;}
}
