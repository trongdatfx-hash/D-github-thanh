import test from 'node:test';
import assert from 'node:assert/strict';
import {regionFlow,regionFlowLabel,drawRegionFlow} from '../region-flow.mjs';
const step=900000;
function fixture({sell=false,fall=false,dropOi=false,flat=false}={}){
 const prices=[],flow=[],oi=new Map();let interest=10000;oi.set(-step,{oi:interest});
 for(let i=0;i<20;i++){
  const t=i*step,o=100,c=flat?100:(fall?99.95:100.05),change=i<18?1:100;
  interest+=(dropOi?-1:1)*change;oi.set(t,{oi:interest});
  prices.push({t,end:t+step-1,o,c,h:100.2,l:99.8});flow.push({t,net:sell?-40:40,q:100});
 }
 return {prices,flow,oi,now:21*step};
}
function run(f,opts={}){return regionFlow(f.prices,f.flow,f.oi,step,f.now,{window:2,...opts});}
for(const [name,options,expected] of [
 ['mua và mở rộng',{},{pct:40,oiState:'increase'}],
 ['mua và thu hẹp',{dropOi:true},{pct:40,oiState:'decrease'}],
 ['bán và mở rộng',{sell:true,fall:true},{pct:-40,oiState:'increase'}],
 ['bán và thu hẹp',{sell:true,fall:true,dropOi:true},{pct:-40,oiState:'decrease'}]
])test(name,()=>{const b=run(fixture(options)).latest;assert.equal(b.pct,expected.pct);assert.equal(b.oiState,expected.oiState);assert.equal(b.paired,2);});
test('thiếu OI vẫn giữ đúng lực CVD, không gán dấu vị thế',()=>{
 const f=fixture();f.oi.delete(19*step);const b=run(f).latest;
 assert.equal(b.pct,40);assert.equal(b.oiState,'missing');assert.equal(b.paired,1);assert.match(regionFlowLabel(b),/OI THIẾU 1\/2/);
});
test('OI không nối qua khoảng trống và không ghép nến đang mở',()=>{
 const f=fixture();f.now=19.5*step;const b=run(f).latest;
 assert.equal(b.oiState,'missing');assert.equal(b.provisional,true);assert.equal(b.paired,1);assert.match(regionFlowLabel(b),/XEM TRƯỚC/);
});
test('nền P62 thiếu chưa được tô OI tăng rõ',()=>{
 const f=fixture();f.prices=f.prices.slice(0,2);f.flow=f.flow.slice(0,2);f.oi=new Map([...f.oi].filter(([t])=>t<2*step));
 assert.equal(run(f).latest.oiState,'warmup');
});
test('nghi hấp thụ khi lực mạnh và thân nến không tiến triển',()=>{
 assert.equal(run(fixture({flat:true})).latest.absorption,true);
 assert.equal(run(fixture()).latest.absorption,false);
 const f=fixture({flat:true});f.flow=f.flow.map(r=>({...r,net:5}));assert.equal(run(f).latest.absorption,false);
});
test('chỉ cộng nến cùng vùng và giữ tỷ lệ volume thực',()=>{
 const f=fixture();f.prices[18]={...f.prices[18],o:110,c:110,h:111,l:109};
 const b=run(f).latest;assert.equal(b.count,1);assert.equal(b.pct,40);assert.equal(b.absorption,false);
 f.prices[18]={...f.prices[19],t:18*step,end:19*step-1};f.flow[18]={...f.flow[18],net:-900,q:1000};
 assert.equal(run(f).latest.pct,100*(-900+40)/(1000+100));
});
test('các cột lịch sử bất biến khi thêm nến và OI tương lai',()=>{
 const f=fixture(),old=run(f);f.prices.push({...f.prices.at(-1),t:20*step,end:21*step-1});f.flow.push({t:20*step,net:-90,q:100});f.oi.set(20*step,{oi:99999});
 const next=run(f,{columns:6});assert.deepEqual(next.bins.slice(0,5),old.bins);
});
test('OI giảm không đảo dấu lực mua, có thể triệt tiêu ròng',()=>{
 const f=fixture();f.oi.set(19*step,{oi:f.oi.get(17*step).oi});const b=run(f).latest;
 assert.equal(b.pct,40);assert.equal(b.netOi,0);assert.equal(b.oiState,'normal');
});
test('nguồn thị trường rỗng không dùng OI cũ; tỷ lệ CVD thiếu có nhãn',()=>{
 const f=fixture();f.oi=new Map();f.flow.pop();const b=run(f).latest;
 assert.equal(b.oiState,'missing');assert.equal(b.flowReady,false);assert.match(regionFlowLabel(b),/CVD THIẾU/);
});
test('mức giá EUR chia đúng vùng riêng',()=>{
 const f=fixture();f.prices=f.prices.map(r=>({...r,o:r.o/100,c:r.c/100,h:r.h/100,l:r.l/100}));const b=run(f,{binStep:.0005}).latest;
 assert(b.high-b.low<.002);assert(b.low<=f.prices.at(-1).c&&b.high>f.prices.at(-1).c);
});
test('đầu vào không hợp lệ và q bằng 0 không tạo lực giả',()=>{
 const f=fixture();f.flow=f.flow.map(r=>({...r,q:0}));assert.equal(run(f).latest.pct,null);
 assert.deepEqual(regionFlow([],[],new Map(),0,0).bins,[]);
});
test('renderer có cột rỗng, chấm hấp thụ và đọc trạng thái',()=>{
 const calls=[],context=new Proxy({},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>(o[k]=v,true)});
 const f=fixture({dropOi:true,flat:true}),state=run(f),canvas={dataset:{},setAttribute:(k,v)=>canvas[k]=v};
 drawRegionFlow({context,canvas,state,layout:{panelWidth:172,barWidth:12,gap:2,shownCount:5,barSpacing:6},right:250,zero:80,halfHeight:26,live:false,source:'TEST'});
 assert.equal(canvas.dataset.oiState,'decrease');assert.equal(canvas.dataset.absorption,'true');assert.match(canvas['aria-label'],/OI GIẢM/);
 assert(calls.some(x=>x[0]==='arc'));assert(calls.filter(x=>x[0]==='strokeRect').length>1);
});
