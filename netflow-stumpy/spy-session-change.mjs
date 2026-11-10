import {ny,postEnd,tradingDay} from './rth-structure.mjs?v=20261029-price-delta1';

export function spyUsdtSessionChange(rows,{step=900000,threshold=0.95,now=Date.now()}={}){
 if(!Array.isArray(rows)||!Number.isFinite(step)||step<=0||!Number.isFinite(threshold)||threshold<0||!Number.isFinite(now))return null;
 const last=rows.at(-1);
 if(!last||!Number.isFinite(last.t)||last.t>now||!Number.isFinite(last.c)||last.c<=0)return null;
 for(let i=rows.length-1;i>=0;i--){
  const bar=rows[i];
  if(bar?.session!=='POST'||!Number.isFinite(bar.t)||!Number.isFinite(bar.c)||bar.c<=0)continue;
  const closeTime=Number.isFinite(bar.end)?bar.end+1:bar.t+step;
  if(closeTime>now||closeTime!==bar.t+step)continue;
  const {day,minute}=ny(closeTime);
  if(minute!==postEnd(day)||!tradingDay(day))continue;
  const changePct=100*(last.c/bar.c-1);
  const postClock=String(Math.floor(minute/60)).padStart(2,'0')+':00';
  return {session:last.session,lastTime:last.t,reference:bar.c,postDay:day,postClock,current:last.c,changePct,volatile:Math.abs(changePct)-threshold>1e-12,threshold};
 }
 return null;
}
