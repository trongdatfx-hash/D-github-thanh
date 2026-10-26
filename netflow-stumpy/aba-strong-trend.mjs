import {trendSessionAt} from './trend-session.mjs?v=20261025-dcommon-all1';
export const STRONG_A1_RULES=Object.freeze({window:5,minR2:.65,minEfficiency:.55,minMoveAtr:.55,minVolume:.15,maxOpposition:.15,exitBars:2,maxPullbackBars:8,invalidationAtr:2});
const STEP=900000;
function fit(rows){
 const n=rows.length,xm=(n-1)/2,ym=rows.reduce((s,r)=>s+r.c,0)/n;
 let xx=0,xy=0,total=0,error=0,path=0;
 for(let i=0;i<n;i++){xx+=(i-xm)**2;xy+=(i-xm)*(rows[i].c-ym);total+=(rows[i].c-ym)**2;if(i)path+=Math.abs(rows[i].c-rows[i-1].c);}
 const slope=xx?xy/xx:0;
 for(let i=0;i<n;i++)error+=(rows[i].c-ym-slope*(i-xm))**2;
 return {direction:Math.sign(slope),r2:total>1e-12?Math.max(0,1-error/total):0,efficiency:path?Math.abs(rows.at(-1).c-rows[0].c)/path:0,move:Math.abs(slope)*(n-1)};
}
// Research detector only. No V3 probabilities or historical quality gates are reused.
// Every phase is assigned at the close that establishes it; no origin backfill.
export function strongTrendAba({rows=[],volume=new Map(),composite=new Map(),age=new Map(),now=Date.now(),rules={}}={}){
 const cfg={...STRONG_A1_RULES,...rules},phases=new Map(),events=[],tracks=[],clean=[];
 let current=null,weak=0,previous=null,day=null,ageRunDirection=0,ageRunStart=null;
 for(const row of rows){
  if((row.end??row.t+STEP-1)>=now)continue;
  const session=trendSessionAt(row.t);
  if(!session.active||![row.t,row.o,row.h,row.l,row.c].every(Number.isFinite)||row.h<row.l){current=null;weak=0;clean.length=0;previous=null;ageRunDirection=0;ageRunStart=null;continue;}
  if(day!==session.day||previous===null||row.t-previous!==STEP){current=null;weak=0;clean.length=0;ageRunDirection=0;ageRunStart=null;}
  day=session.day;previous=row.t;clean.push(row);if(clean.length>20)clean.shift();
  const ageState=age.get(row.t),ageDirection=ageState?.label==='UP'?1:ageState?.label==='DOWN'?-1:0;
  if(ageDirection!==ageRunDirection){ageRunDirection=ageDirection;ageRunStart=ageDirection?row.t:null;}
  const sample=clean.slice(-cfg.window);if(sample.length<cfg.window)continue;
  const f=fit(sample),atr=clean.slice(-14).reduce((sum,r,i,arr)=>sum+Math.max(r.h-r.l,i?Math.abs(r.h-arr[i-1].c):0,i?Math.abs(r.l-arr[i-1].c):0),0)/Math.min(14,clean.length);
  const v=volume.get(row.t)?.adjusted,c=composite.get(row.t)?.adjusted,priorV=volume.get(row.t-STEP)?.adjusted;
  if(!Number.isFinite(v)||!Number.isFinite(c)){current=null;weak=0;continue;}
  const flow=f.direction&&Number.isFinite(v)&&v*f.direction>=cfg.minVolume&&Number.isFinite(c)&&c*f.direction>=-cfg.maxOpposition;
  const strong=atr>0&&flow&&f.r2>=cfg.minR2&&f.efficiency>=cfg.minEfficiency&&f.move/atr>=cfg.minMoveAtr&&Number.isFinite(priorV)&&priorV*f.direction>0;
  const aligned=ageDirection===f.direction&&flow&&atr>0&&f.r2>=.4&&f.move/atr>=.3;
  if(!current){
   if(!strong&&!aligned)continue;
   current={id:events.length,day,direction:f.direction,start:row.t,issuedAt:row.t+STEP,stage:'A1',anchor:row.c,atr,early:!ageDirection,ageMatch:null};tracks.push(current);weak=0;
   events.push({t:row.t,phase:'A1',direction:f.direction,issuedAt:row.t+STEP,early:!ageDirection,r2:f.r2,efficiency:f.efficiency,moveAtr:f.move/atr});
  }else{
   const adverse=Number.isFinite(v)&&v*current.direction< -cfg.minVolume||(row.c-clean.at(-2).c)*current.direction< -atr*.25;
   weak=adverse?weak+1:0;
   if(current.stage==='B'){
    current.pullbackBars++;
    if(current.pullbackBars>cfg.maxPullbackBars||(row.c-current.anchor)*current.direction< -cfg.invalidationAtr*current.atr){current=null;weak=0;continue;}
    if(strong&&f.direction===current.direction){current.stage='A2';weak=0;events.push({t:row.t,phase:'A2',direction:current.direction,issuedAt:row.t+STEP});}
   }else if(weak>=cfg.exitBars){
    if(current.stage==='A2'){current=null;weak=0;continue;}
    current.stage='B';current.pullbackBars=1;weak=0;events.push({t:row.t,phase:'B',direction:current.direction,issuedAt:row.t+STEP});
   }
  }
  if(current){
   if(current.ageMatch===null&&ageDirection===current.direction)current.ageMatch=ageRunStart??row.t;
   phases.set(row.t,current.stage);
  }
 }
 const matched=tracks.filter(x=>x.ageMatch!==null);
 return {phases,events,tracks,matched:matched.length,leading:matched.filter(x=>x.start<x.ageMatch).length,same:matched.filter(x=>x.start===x.ageMatch).length,late:matched.filter(x=>x.start>x.ageMatch).length,unconfirmed:tracks.length-matched.length,active:current?{...current}:null,status:'STRONG_A1_RESEARCH'};
}
