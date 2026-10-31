const STEP=900000,DAY_START=240,DAY_END=960,SLOTS=48;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const clampSigned=x=>Math.max(-1,Math.min(1,x));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const clockFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function nyClock(t){const p=Object.fromEntries(clockFormat.formatToParts(t).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return {day:`${p.year}-${p.month}-${p.day}`,weekday:p.weekday,minute:Number(p.hour)*60+Number(p.minute)};}
function mondayOf(day){const d=new Date(day+'T12:00:00Z'),w=d.getUTCDay(),offset=w===0?6:w-1;d.setUTCDate(d.getUTCDate()-offset);return d.toISOString().slice(0,10);}
function weightedQuantile(values,weights,p){const a=values.map((value,i)=>({value,weight:Math.max(0,weights[i]??0)})).filter(x=>Number.isFinite(x.value)&&x.weight>0).sort((x,y)=>x.value-y.value),total=a.reduce((s,x)=>s+x.weight,0);if(!a.length||!total)return null;let sum=0;for(const x of a){sum+=x.weight;if(sum>=clamp(p)*total)return x.value;}return a.at(-1).value;}
function qset(values,weights){return {p10:weightedQuantile(values,weights,.1),p50:weightedQuantile(values,weights,.5),p90:weightedQuantile(values,weights,.9)};}
function latest(map,rows,predicate=()=>true){for(let i=rows.length-1;i>=0;i--){const value=map.get(rows[i].t);if(value&&predicate(value))return value;}return null;}

export function h1CandleColorStates({priceRows=[],boxSnapshots=new Map(),trendStates=[],volumeRows=[],now=Date.now()}={}){
  const groups=new Map(),trend=new Map(trendStates.map(x=>[x.t,x])),volume=new Map(volumeRows.map(x=>[x.t,x]));
  for(const row of priceRows){
    const clock=nyClock(row.t);
    const hourStart=Math.floor(clock.minute/60)*60,key=`${clock.day}:${hourStart}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push({...row,minute:clock.minute,hourStart});
  }
  const states=[];
  for(const source of groups.values()){
    const rows=source.sort((a,b)=>a.t-b.t),hourStart=rows[0]?.hourStart;
    if(rows[0]?.minute!==hourStart)continue;
    let usable=0;for(let i=0;i<Math.min(4,rows.length);i++){if(rows[i].minute!==hourStart+15*i||(i&&rows[i].t-rows[i-1].t!==STEP))break;usable=i+1;}
    const sample=rows.slice(0,usable);if(!sample.length)continue;
    const complete=sample.length===4&&sample.every(row=>(row.end??row.t+STEP-1)<now);
    const preview=!complete&&sample.some(row=>row.t<=now&&(row.end??row.t+STEP-1)>=now);
    if(!complete&&!preview)continue;
    const o=sample[0].o,c=sample.at(-1).c,h=Math.max(...sample.map(x=>x.h)),l=Math.min(...sample.map(x=>x.l)),range=Math.max(1e-12,h-l);
    const box=latest(boxSnapshots,sample),age=latest(trend,sample,x=>x.active===true),priceDirection=Math.abs(c-o)>=.10*range?Math.sign(c-o):0,boxDirection=[-1,1].includes(box?.direction)?box.direction:0,trendDirection=[-1,1].includes(age?.direction)?age.direction:0;
    const vote=.45*priceDirection+.30*boxDirection+.25*trendDirection,direction=Math.abs(vote)>=.25?Math.sign(vote):0,quality=clamp(Math.abs(vote)),path=sample.slice(1).reduce((sum,row,i)=>sum+Math.abs(row.c-sample[i].c),Math.abs(sample[0].c-o)),priceVector=path?clampSigned((c-o)/path):0,vValues=sample.map(row=>volume.get(row.t)?.adjusted).filter(Number.isFinite),spyV=vValues.length?clampSigned(mean(vValues)):null,boxVector=boxDirection*(Number.isFinite(box?.encoding?.ruleScore)?clamp(box.encoding.ruleScore/100):.5),trendVector=trendDirection*(Number.isFinite(age?.continuation)?clamp(age.continuation):.5),vectors=[[.30,priceVector],[.25,boxVector],[.35,spyV],[.10,trendVector]].filter(([,value])=>Number.isFinite(value)),vectorWeight=vectors.reduce((sum,[weight])=>sum+weight,0),trendVectorScore=direction&&Number.isFinite(spyV)&&vectorWeight?vectors.reduce((sum,[weight,value])=>sum+weight*value,0)/vectorWeight*direction:null,score=Number.isFinite(trendVectorScore)?Math.round(100*clamp(.5+.5*trendVectorScore)):null,dayKey=clock.day;
    for(const row of sample)states.push({t:row.t,direction,quality,score,spyV,priceVector,preview,dayKey,blockStart:sample[0].t,blockEnd:sample.at(-1).end??sample.at(-1).t+STEP-1});
  }
  return states.sort((a,b)=>a.t-b.t);
}

export function buildWeeklyDailyPackets({priceRows=[],strengthRows=[],volumeRows=[],boxSnapshots=new Map(),trendStates=[]}={}){
  const groups=new Map(),strength=new Map(strengthRows.map(x=>[x.t,x])),volume=new Map(volumeRows.map(x=>[x.t,x])),trend=new Map(trendStates.map(x=>[x.t,x]));
  for(const row of priceRows){const c=nyClock(row.t);if(['Sat','Sun'].includes(c.weekday)||c.minute<DAY_START||c.minute>=DAY_END)continue;if(!groups.has(c.day))groups.set(c.day,[]);groups.get(c.day).push({...row,minute:c.minute});}
  const packets=[];
  for(const [day,source] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
    const rows=source.sort((a,b)=>a.t-b.t);if(rows[0]?.minute!==DAY_START)continue;let usable=0;for(let i=0;i<rows.length;i++){if(rows[i].minute!==DAY_START+15*i||(i&&rows[i].t-rows[i-1].t!==STEP))break;usable=i+1;}usable=Math.floor(usable/4)*4;if(usable<4)continue;
    const sample=rows.slice(0,Math.min(SLOTS,usable)),complete=sample.length===SLOTS&&sample.at(-1).minute===DAY_END-15,o=sample[0].o,c=sample.at(-1).c,h=Math.max(...sample.map(x=>x.h)),l=Math.min(...sample.map(x=>x.l)),range=Math.max(1e-12,h-l),path=sample.slice(1).reduce((s,x,i)=>s+Math.abs(x.c-sample[i].c),Math.abs(sample[0].c-o));
    const box=latest(boxSnapshots,sample),age=latest(trend,sample,x=>x.active===true),priceDirection=Math.abs(c-o)>=.10*range?Math.sign(c-o):0,boxDirection=[-1,1].includes(box?.direction)?box.direction:0,trendDirection=[-1,1].includes(age?.direction)?age.direction:0;
    const vote=.45*priceDirection+.30*boxDirection+.25*trendDirection,direction=Math.abs(vote)>=.25?Math.sign(vote):0,components=[],priceEfficiency=path>0?clamp(Math.abs(c-o)/path):0;
    components.push([.25,priceEfficiency]);if(Number.isFinite(box?.encoding?.ruleScore))components.push([.25,clamp(box.encoding.ruleScore/100)]);if(Number.isFinite(age?.continuation))components.push([.25,clamp(age.continuation)]);
    const tail=sample.slice(-4),sValues=tail.map(x=>strength.get(x.t)?.adjusted).filter(Number.isFinite),vValues=tail.map(x=>volume.get(x.t)?.adjusted).filter(Number.isFinite),sMean=mean(sValues),vMean=mean(vValues);
    if(direction&&sValues.length)components.push([.15,clamp(.5+.5*direction*sMean)]);if(direction&&vValues.length)components.push([.10,clamp(.5+.5*direction*vMean)]);
    const den=components.reduce((s,[w])=>s+w,0),quality=den?components.reduce((s,[w,v])=>s+w*v,0)/den:0,progress=sample.length/SLOTS;
    packets.push({day,weekday:nyClock(sample[0].t).weekday,week:mondayOf(day),complete,preview:!complete,progress,blocks:sample.length/4,o,h,l,c,direction,quality,score:direction*quality,priceEfficiency,boxDirection,trendDirection,boxScore:box?.encoding?.ruleScore??null,trendAgeBars:age?.currentBars??0,trendContinuation:age?.continuation??null,strength:sMean,volume:vMean,lastTime:sample.at(-1).t});
  }
  return packets;
}

function weekState(days,{includePreview=true}={}){
  const used=days.filter(x=>x.complete||(includePreview&&x.blocks>=1)),weighted=used.map(x=>x.complete?1:x.progress),evidence=used.reduce((s,x,i)=>s+x.score*weighted[i],0),mass=weighted.reduce((a,b)=>a+b,0),normalized=mass?evidence/mass:0,direction=Math.abs(normalized)>=.18?Math.sign(normalized):0;
  const coherent=direction?used.reduce((s,x,i)=>s+weighted[i]*(x.direction===direction?1:x.direction===0?.5:0),0)/Math.max(1e-9,mass):0;
  let ageDays=0,bridge=0,ageH1=0;for(let i=used.length-1;i>=0;i--){const x=used[i];if(x.direction===direction&&direction){ageDays++;ageH1+=x.blocks;bridge=0;}else if(direction&&x.direction===0&&bridge<1){bridge++;}else break;}
  const anchor=used[0]?.o,high=Math.max(...used.map(x=>x.h)),low=Math.min(...used.map(x=>x.l)),close=used.at(-1)?.c;
  return {days:used,direction,evidence,normalized,coherence:coherent,ageDays,ageH1,anchor,high,low,close,widthPct:anchor>0?100*(high-low)/anchor:null,confirmedDays:used.filter(x=>x.complete).length,preview:used.at(-1)?.preview===true};
}
function standardize(rows,target){const d=rows[0]?.features.length??0,mu=Array(d).fill(0),sd=Array(d).fill(0);for(const row of rows)for(let j=0;j<d;j++)mu[j]+=row.features[j]/rows.length;for(const row of rows)for(let j=0;j<d;j++)sd[j]+=(row.features[j]-mu[j])**2;for(let j=0;j<d;j++){sd[j]=Math.sqrt(sd[j]/Math.max(1,rows.length-1));if(!(sd[j]>1e-9))sd[j]=1;}const z=a=>a.map((x,j)=>(x-mu[j])/sd[j]),t=z(target);return rows.map(row=>({...row,distance:Math.sqrt(z(row.features).reduce((s,x,j)=>s+(x-t[j])**2,0)/Math.max(1,d))}));}
function features(state){return [state.normalized,state.coherence,state.ageDays,state.ageH1/12,state.widthPct??0,mean(state.days.map(x=>x.quality)),mean(state.days.map(x=>x.priceEfficiency)),mean(state.days.map(x=>x.trendContinuation).filter(Number.isFinite))||.5];}

export function weeklyTrendForecast({priceRows=[],strengthRows=[],volumeRows=[],boxSnapshots=new Map(),trendStates=[],now=Date.now(),k=32}={}){
  const packets=buildWeeklyDailyPackets({priceRows,strengthRows,volumeRows,boxSnapshots,trendStates});
  const weeks=new Map();for(const packet of packets){if(!weeks.has(packet.week))weeks.set(packet.week,[]);weeks.get(packet.week).push(packet);}const ordered=[...weeks.entries()].sort(([a],[b])=>a.localeCompare(b));if(!ordered.length)return {ready:false,label:'WAIT',reason:'Chưa có Daily packet'};
  const [week,currentDays]=ordered.at(-1),current=weekState(currentDays),prefix=Math.max(1,current.days.length),historical=[];
  for(const [key,days] of ordered.slice(0,-1)){const complete=days.filter(x=>x.complete);if(complete.length<4||complete.length<prefix)continue;const snapshot=weekState(complete.slice(0,prefix),{includePreview:false}),final=weekState(complete,{includePreview:false});if(!snapshot.direction||snapshot.direction!==current.direction)continue;const anchor=snapshot.anchor;historical.push({key,snapshot,features:features(snapshot),outcome:{continued:final.direction===snapshot.direction&&Math.sign(final.close/final.anchor-1)===snapshot.direction,finalHighPct:100*(final.high/anchor-1),finalLowPct:100*(final.low/anchor-1),finalAgeDays:final.ageDays,finalAgeH1:final.ageH1,growthPct:100*((final.high-final.low)-(snapshot.high-snapshot.low))/anchor,closePct:100*(final.close/anchor-1)}});}
  const cells=['Mon','Tue','Wed','Thu','Fri'].map(name=>({name,packet:current.days.find(x=>x.weekday===name)??null}));
  if(!current.direction||historical.length<8)return {ready:false,label:'WAIT',week,current,cells,sampleN:historical.length,reason:!current.direction?'Bằng chứng tuần chưa đồng thuận':'Chưa đủ tuần lịch sử cùng trạng thái'};
  const ranked=standardize(historical,features(current)).sort((a,b)=>a.distance-b.distance).slice(0,Math.min(k,historical.length)),bandwidth=ranked[Math.floor(ranked.length/2)]?.distance||1,raw=ranked.map(x=>Math.exp(-.5*(x.distance/Math.max(.05,bandwidth))**2)),sum=raw.reduce((a,b)=>a+b,0)||1,weights=raw.map(x=>x/sum),neff=1/weights.reduce((s,w)=>s+w*w,0),rawContinue=ranked.reduce((s,x,i)=>s+weights[i]*Number(x.outcome.continued),0),prior=12,continuation=(rawContinue*neff+prior*.5)/(neff+prior),growth=qset(ranked.map(x=>x.outcome.growthPct),weights),referenceOnly=neff<20;
  const label=!referenceOnly&&current.confirmedDays>=2&&current.coherence>=.60&&continuation>=.60&&growth.p10>=-.10?(current.direction>0?'UP':'DOWN'):'WAIT',confidence=Math.round(100*Math.min(1,neff/30)*Math.min(1,Math.max(0,continuation-.5)/.15)*current.coherence),phase=label==='WAIT'?'WAIT':current.ageDays<=2?'HÌNH THÀNH':current.ageDays<=4?'ĐANG CHẠY':'TRƯỞNG THÀNH';
  return {ready:true,label,phase,week,current,cells,continuation,confidence,wait:100-confidence,n:ranked.length,neff,referenceOnly,ranked:ranked.map((x,i)=>({...x,weight:weights[i]})),box:{low:qset(ranked.map(x=>x.outcome.finalLowPct),weights),high:qset(ranked.map(x=>x.outcome.finalHighPct),weights),growth},age:{days:{current:current.ageDays,final:qset(ranked.map(x=>x.outcome.finalAgeDays),weights)},h1:{current:current.ageH1,final:qset(ranked.map(x=>x.outcome.finalAgeH1),weights)}},reason:label==='WAIT'?'Đủ dữ liệu mô tả nhưng lợi thế giữ hướng chưa qua toàn bộ ngưỡng':'Cohort tuần quá khứ giữ cùng hướng và envelope còn dư địa'};
}

