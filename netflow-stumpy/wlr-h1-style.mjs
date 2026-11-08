// Display only. H1 evidence becomes available at its close, never at its open.
const H=3600000,M=900000,finite=Number.isFinite;
export const WLR_H1_PALETTE=Object.freeze({positive:'#1ae0a3',negative:'#ff4d70',positiveWeak:'#83b8aa',negativeWeak:'#c28e9b',conflict:'#f6b94f',neutral:'#8794a5'});
const complete=r=>Number.isInteger(r?.score)&&Math.abs(r.score)<=5&&[-1,0,1].includes(r.boxDirection)&&Array.isArray(r.missing)&&r.missing.length===0;
const locked=r=>complete(r)&&r.status==='LOCKED'&&r.closedBars===4&&r.blockEnd===r.blockStart+H-1&&r.lockedAt===r.blockEnd+1&&r.asOf===r.lockedAt;
function style(record,{preview=false,direction=record?.boxDirection??0}={}){
  const base={model:'h1-box-score',ready:!!record,preview,score:record?.score??null,boxDirection:direction,referenceTime:record?.asOf??null,blockStart:record?.blockStart??null,missing:record?.missing??[],maxWidth:7};
  if(!record)return {...base,direction:0,tone:'missing',width:2,color:WLR_H1_PALETTE.neutral};
  const score=record.score,sign=Math.sign(score),conflict=direction!==0&&sign!==0&&sign!==direction;
  const tone=conflict?'conflict':direction===0?'neutral':Math.abs(score)>=2?'confirmed':'weak';
  const width=conflict||direction===0?2:Math.min(preview?3:7,2+Math.abs(score));
  let color=conflict?WLR_H1_PALETTE.conflict:direction===0?WLR_H1_PALETTE.neutral:direction>0?(tone==='confirmed'?WLR_H1_PALETTE.positive:WLR_H1_PALETTE.positiveWeak):(tone==='confirmed'?WLR_H1_PALETTE.negative:WLR_H1_PALETTE.negativeWeak);
  if(preview)color=`rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},.55)`;
  return {...base,direction:conflict?0:direction,tone,width,color};
}
export function wlrH1Styles(bands,records,{step=M,now=Date.now()}={}){
  if(step!==M||!Array.isArray(bands)||!Array.isArray(records)||!finite(now))throw Error('WLR H1 style requires M15 rows and a finite clock');
  const byStart=new Map();
  for(const r of records){
    if(!finite(r?.blockStart)||r.blockEnd!==r.blockStart+H-1||r.status==='PREVIEW'||r.blockEnd+1>now)continue;
    const old=byStart.get(r.blockStart);if(!old||locked(r))byStart.set(r.blockStart,r);
  }
  const official=[...byStart.values()].sort((a,b)=>a.blockStart-b.blockStart);
  const provisional=records.filter(r=>complete(r)&&r.status==='PREVIEW'&&r.closedBars===3&&r.blockEnd===r.blockStart+H-1&&r.asOf===r.blockStart+3*M&&r.asOf<=now&&now<r.blockEnd+1).sort((a,b)=>a.blockStart-b.blockStart).at(-1);
  let index=-1,previous=null;
  return bands.map(row=>{
    if(!finite(row?.t)||(previous!==null&&row.t<=previous))throw Error('WLR H1 timestamps must increase');previous=row.t;
    while(index+1<official.length&&official[index+1].blockEnd+1<=row.t)index++;
    const candidate=official[index],fresh=candidate&&row.t<candidate.blockEnd+1+H,record=fresh&&locked(candidate)?candidate:null;
    let result=style(record),reason=!candidate?'waiting_h1':!fresh?'stale_h1':!record?'incomplete_h1':'locked_h1';
    // Only the still-forming tail may use a 3/4 score. Its box color can contain
    // candle four, so retain the previous LOCKED box color, never that preview.
    if(provisional&&record&&record.blockEnd+1===provisional.blockStart&&row.t>=provisional.asOf&&row.t<=now&&now<row.t+step){
      result=style(provisional,{preview:true,direction:record.boxDirection});reason='preview_closed_three';
    }
    if(!finite(row.mid)){result=style(null);reason='missing_wlr';}
    return {...result,t:row.t,closed:row.t+step<=now,reason};
  });
}
