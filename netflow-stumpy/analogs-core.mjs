// Weighted, per-channel z-normalized Euclidean distance; parity-tested against STUMPY MASS.
export const WEIGHTS=[.4,.25,.25,.1], PV_WEIGHTS=[.30,.15,.15,.05,.15,.10,.05,.05], PV_SCALES=[1,1,.5,1,.5,.5,1,1], STEP=900000;
export function normalized(values){
  const mean=values.reduce((s,x)=>s+x,0)/values.length;
  const sd=Math.sqrt(values.reduce((s,x)=>s+(x-mean)**2,0)/values.length);
  return {flat:sd<1e-8,z:values.map(x=>sd<1e-8?0:(x-mean)/sd)};
}
export function shapeDistance(a,b,{technique='flow'}={}){
  let total=0;
  if(technique==='price-volume'){
    for(let k=0;k<PV_WEIGHTS.length;k++){
      let d;
      if(k===0){const x=normalized(a.map(r=>r.pv[k])),y=normalized(b.map(r=>r.pv[k]));d=x.flat&&y.flat?0:x.flat||y.flat?1:x.z.reduce((s,v,j)=>s+(v-y.z[j])**2,0)/a.length;}
      else d=a.reduce((sum,r,j)=>sum+((r.pv[k]-b[j].pv[k])*PV_SCALES[k])**2,0)/a.length;
      total+=PV_WEIGHTS[k]*d;
    }
    return Math.sqrt(total);
  }
  for(let k=0;k<4;k++){
    const x=normalized(a.map(r=>r.x[k])),y=normalized(b.map(r=>r.x[k]));
    // STUMPY: both constant -> 0; one constant -> sqrt(m).
    const d=x.flat&&y.flat?0:x.flat||y.flat?1:x.z.reduce((s,v,j)=>s+(v-y.z[j])**2,0)/a.length;
    total+=WEIGHTS[k]*d;
  }
  return Math.sqrt(total);
}
export function validWindow(rows,start,end,{technique='flow'}={}){
  if(start<0||end>=rows.length)return false;
  for(let i=start;i<=end;i++){
    if(!(technique==='price-volume'?rows[i]?.pv:rows[i]?.x)?.every(Number.isFinite)||!Number.isFinite(rows[i].c)||rows[i].c<=0)return false;
    if(i>start&&rows[i].t-rows[i-1].t!==STEP)return false;
  }
  return true;
}
export function candidateIndices(rows,m,h,{technique='flow'}={}){
  const q=rows.length-m,last=rows.at(-1),out=[];
  if(!last?.eligible||!validWindow(rows,q,rows.length-1,{technique}))return out;
  for(let i=0;i+m+h<=q;i++){
    const end=i+m-1,future=end+h;
    if(rows[end].session!==last.session||!rows[end].eligible||rows[future].day!==rows[end].day||rows[future].session!==rows[end].session)continue;
    if(!validWindow(rows,i,future,{technique}))continue;
    out.push(i);
  }
  return out;
}
export function percentile(values,p){
  if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),i=(a.length-1)*p,j=Math.floor(i);
  return a[j]+(a[Math.ceil(i)]-a[j])*(i-j);
}
export function wilson(k,n){
  if(!n)return null;const z=1.95996398454,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,r=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
  return [c-r,c+r];
}
export function summarize(rows,m,h,ranked,limit=20,{technique='flow'}={}){
  const chosen=[],days=new Set();
  for(const r of ranked){
    const end=r.index+m-1,day=rows[end].day;
    if(days.has(day)||chosen.some(x=>!(r.index>x.index+m+h-1||x.index>r.index+m+h-1)))continue;
    days.add(day);chosen.push(r);if(chosen.length>=limit)break;
  }
  const query=rows.slice(-m),anchor=query.at(-1),outcomes=chosen.map(({index,distance})=>{
    const end=index+m-1,base=rows[end].c,future=rows.slice(end+1,end+h+1);
    return {index,distance,start:rows[index].t,end:rows[end].t,day:rows[end].day,returnPct:100*(future.at(-1).c/base-1),mfePct:100*(Math.max(...future.map(r=>r.high??r.c))/base-1),maePct:100*(Math.min(...future.map(r=>r.low??r.c))/base-1),path:rows.slice(index,end+h+1).map(r=>100*(r.c/base-1))};
  });
  const values=outcomes.map(x=>x.returnPct),n=values.length,up=values.filter(x=>x>0).length,down=values.filter(x=>x<0).length;
  // Show descriptive frequencies, never treat pattern distance as a probability.
  return {version:2,technique,method:technique==='price-volume'?'price-z-and-chart-state-distance':'weighted-z-distance',m,h,queryTime:anchor?.t??null,queryStart:query[0]?.t??null,session:anchor?.session??null,rows:rows.length,candidates:ranked.length,n,up,down,flat:n-up-down,pUp:n?up/n:null,interval:wilson(up,n),q25:percentile(values,.25),median:percentile(values,.5),q75:percentile(values,.75),status:n>=12?'EXPLORATORY':'WAIT',matches:outcomes,queryPath:query.map(r=>100*(r.c/anchor.c-1))};
}
export function searchAnalogs(rows,{m=16,h=3,technique='flow'}={}){
  if(![8,16,32].includes(m)||![3,6,12].includes(h))throw Error('Unsupported window/horizon');
  const query=rows.slice(-m),indices=candidateIndices(rows,m,h,{technique});
  const ranked=indices.map(index=>({index,distance:shapeDistance(query,rows.slice(index,index+m),{technique})})).sort((a,b)=>a.distance-b.distance||a.index-b.index);
  return summarize(rows,m,h,ranked,20,{technique});
}
