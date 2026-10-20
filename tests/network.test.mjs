import test from 'node:test';
import assert from 'node:assert/strict';
import { NeuralNetwork, parseNumber } from '../src/network.mjs';

test('initial state and reset clear samples, epochs and predictions',()=>{
  const n=new NeuralNetwork(),initial=n.weights();
  assert.equal(n.samples.length,0);assert.equal(n.epochs,0);
  n.train(1,2);n.reset();assert.deepEqual(n.weights(),initial);assert.equal(n.samples.length,0);assert.equal(n.epochs,0);
});
test('finite numeric input, decimals, negative and range boundaries',()=>{
  for(const [text,value] of [['0',0],['-0.25',-.25],[' 1.5 ',1.5],['1000',1000],['-1000',-1000]])assert.equal(parseNumber(text),value);
  for(const text of ['', ' ', 'abc', 'Infinity','1e309','1001','-1001'])assert.equal(parseNumber(text),null,text);
});
test('backpropagation agrees with independent finite differences',()=>{
  const n=new NeuralNetwork(),x=.3,y=-.2,g=n.gradients(x,y),eps=1e-6;
  for(const key of ['w1','b1','w2'])for(let j=0;j<6;j++){
    const old=n[key][j];n[key][j]=old+eps;const plus=(n.forward(x)-y)**2;
    n[key][j]=old-eps;const minus=(n.forward(x)-y)**2;n[key][j]=old;
    assert(Math.abs((plus-minus)/(2*eps)-g[key][j])<1e-6,`${key}[${j}]`);
  }
});
test('learns retained examples and predicts held-out interpolation',()=>{
  const n=new NeuralNetwork();for(const [x,y] of [[0,0],[1,2],[2,4]])n.train(x,y);
  assert.equal(n.samples.length,3);assert.equal(n.epochs,1800);
  assert(n.loss<.02,`MSE ${n.loss}`);
  for(const [x,y] of [[0,0],[1,2],[2,4],[1.5,3]])assert(Math.abs(n.predict(x)-y)<.35,`${x}: ${n.predict(x)}`);
});
test('prediction is read-only and repeats identically',()=>{
  const n=new NeuralNetwork();n.train(1,2);const before=JSON.stringify(n);const a=n.predict(.5),b=n.predict(.5);
  assert.equal(a,b);assert.equal(JSON.stringify(n),before);
});
test('invalid or untrained requests cannot silently mutate a model',()=>{
  const n=new NeuralNetwork();assert.throws(()=>n.predict(0));const before=JSON.stringify(n);
  for(const [x,y] of [[NaN,1],[1,Infinity],[1001,1]])assert.throws(()=>n.train(x,y));
  assert.equal(JSON.stringify(n),before);
});
test('duplicate input replaces its target without forgetting other inputs',()=>{
  const n=new NeuralNetwork();n.train(0,0);n.train(1,2);n.train(1,-2);
  assert.deepEqual(n.samples,[[0,0],[1,-2]]);assert(Math.abs(n.predict(1)+2)<.15);
});
test('reset allows learning a different rule',()=>{
  const n=new NeuralNetwork();n.train(1,2);n.reset();n.train(1,-2);assert(n.predict(1)<-1.9);
});
test('sample limit is transactional but existing inputs can be updated',()=>{
  const n=new NeuralNetwork({epochsPerTrain:1});for(let i=0;i<32;i++)n.train(i,i);
  const before=JSON.stringify(n);assert.throws(()=>n.train(33,33));assert.equal(JSON.stringify(n),before);
  n.train(0,-1);assert.equal(n.samples.length,32);assert.equal(n.samples[0][1],-1);
});
