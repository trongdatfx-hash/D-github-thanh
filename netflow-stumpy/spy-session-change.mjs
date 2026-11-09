export function spyUsdtSessionChange(rows,{step=900000,threshold=0.95}={}){
 if(!Array.isArray(rows)||!Number.isFinite(step)||step<=0||!Number.isFinite(threshold)||threshold<0)return null;
 const last=rows.at(-1);
 if(!last||!Number.isFinite(last.t)||!Number.isFinite(last.c))return null;
 let start=rows.length-1;
 while(start>0){
  const previous=rows[start-1],current=rows[start];
  if(previous?.session!==last.session||!Number.isFinite(previous.t)||!Number.isFinite(current?.t)||current.t-previous.t!==step)break;
  start--;
 }
 const open=rows[start]?.o,current=last.c;
 if(!Number.isFinite(open)||open<=0||!Number.isFinite(current))return null;
 const changePct=100*(current/open-1);
 return {session:last.session,startTime:rows[start].t,lastTime:last.t,open,current,changePct,volatile:Math.abs(changePct)-threshold>1e-12,threshold};
}
