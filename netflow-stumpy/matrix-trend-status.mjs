// Current-state description. No duration/probability is inferred from 9 days of OI.
const H=3600000,M=900000,finite=Number.isFinite;
export const MATRIX_TREND_VERSION='matrix-trend-base-no-oi-v1';
const KEYS=['position','slope','randomWalk','deltaNF'];
export function baseH1Score(r,now=Date.now()){
  if(!r||r.status==='PREVIEW'||r.closedBars!==4||!finite(r.blockStart)||r.blockEnd!==r.blockStart+H-1||r.asOf!==r.blockEnd+1||r.asOf>now||!KEYS.every(k=>[-1,0,1].includes(r.parts?.[k])))return null;
  // Rebuild from the original components: no OI and no RW alignment bonus.
  return {t:r.blockStart,knownAt:r.asOf,score:KEYS.reduce((s,k)=>s+r.parts[k],0),parts:Object.fromEntries(KEYS.map(k=>[k,r.parts[k]])),oi:[-1,0,1].includes(r.parts.oi)?r.parts.oi:null};
}
const contiguous=a=>a.every((r,i)=>r&&(!i||r.t-a[i-1].t===H));
function groupEvidence(a){
  const need=Math.ceil(a.length*2/3),n=(k,d)=>a.filter(r=>r.parts[k]===d).length;
  const direction=[1,-1].find(d=>n('position',d)>=need&&n('slope',d)>=1&&n('slope',-d)===0)??0;
  return {direction,n,need};
}
export function matrixTrendStatus(records,{now=Date.now(),priceRows=[],size=3}={}){
  if(!finite(now)||![2,3,4].includes(size))throw Error('Invalid matrix trend options');
  const source=[...new Map(records.filter(r=>finite(r?.blockStart)&&r.closedBars!==3&&r.status!=='PREVIEW'&&r.blockStart+H<=now).map(r=>[r.blockStart,r])).values()].sort((a,b)=>a.blockStart-b.blockStart);
  const tail=source.slice(-2*size),columns=tail.map(r=>baseH1Score(r,now)),current=columns.slice(-size),previous=columns.slice(0,-size),last=source.at(-1);
  const result={version:MATRIX_TREND_VERSION,phase:'WAIT',direction:0,score:null,from:null,to:last?last.blockStart+H:null,asOf:last?.asOf??null,oiText:'OI thiếu',remainingH1:null,probability:null,forecastStatus:'CHUA_DU_MAU',columns,fallingBoxes:0,confirmation:null,stale:!!last&&now-(last.blockStart+H)>H+M};
  if(current.length<size||!contiguous(current))return {...result,reason:'Chưa đủ nhóm hộp H1 có đủ điểm nền liên tục'};
  const e=groupEvidence(current),d=e.direction,prior=previous.length===size&&contiguous(previous)&&previous.at(-1).t+H===current[0].t?groupEvidence(previous):null;
  const falling=current.slice(1).filter((r,i)=>d&&(r.score-current[i].score)*d<0).length;
  const weaker=d&&((falling>=Math.min(2,size-1)&&d*(current.at(-1).score-current[0].score)<=-2)||(prior?.direction===d&&e.n('deltaNF',d)<prior.n('deltaNF',d)));
  let phase=!d?'TRANSITION':e.n('deltaNF',-d)>=e.need?'CONFLICT':weaker?'WEAKENING':e.n('deltaNF',d)>=e.need?'SUPPORTED':'TRANSITION';
  const oi=current.map(r=>r.oi),knownOi=oi.filter(finite),oiText=knownOi.length<e.need?'OI thiếu':!d?'OI chưa rõ':oi.filter(x=>x===d).length>=e.need?'OI hỗ trợ':oi.filter(x=>x===-d).length>=e.need?'OI xung đột':'OI chưa đồng thuận';
  const bars=[...new Map(priceRows.filter(b=>finite(b.t)&&[b.c,b.h,b.l].every(finite)&&b.h>=b.l&&b.sourceComplete!==false&&(b.end??b.t+M-1)===b.t+M-1&&b.t+M<=now).map(b=>[b.t,b])).values()].sort((a,b)=>a.t-b.t),byTime=new Map(bars.map(b=>[b.t,b]));
  let confirmation=null;
  if(prior){
    const from=previous[0].t,knownAt=current[0].t,zoneBars=Array.from({length:size*4},(_,i)=>byTime.get(from+i*M));
    if(zoneBars.every(Boolean)){
      const zone={low:Math.min(...zoneBars.map(b=>b.l)),high:Math.max(...zoneBars.map(b=>b.h)),knownAt,from},recent=bars.filter(b=>b.t>=knownAt).slice(-2);
      const consecutive=recent.length===2&&recent[1].t-recent[0].t===M;
      const breakDirection=consecutive&&recent.every(b=>b.c>zone.high)?1:consecutive&&recent.every(b=>b.c<zone.low)?-1:0;
      confirmation={zone,confirmed:breakDirection!==0,direction:breakDirection,asOf:recent.at(-1)?recent.at(-1).t+M:null};
      if(breakDirection)phase='BREAKOUT';
    }
  }
  return {...result,phase,direction:confirmation?.direction||d,baseDirection:d,score:current.at(-1).score,from:current[0].t,oiText,fallingBoxes:falling,confirmation,stale:result.stale||!bars.length||now-(bars.at(-1).t+M)>2*M,reason:'Trạng thái mô tả từ điểm nền không OI; chưa kiểm định dự báo thời gian còn lại'};
}
export function matrixTrendText(s){
  if(!s)return 'Ma trận trend · Chờ dữ liệu';
  const names={WAIT:'Chờ đủ điểm nền',SUPPORTED:'Được ủng hộ',WEAKENING:'Lực suy yếu',CONFLICT:'Giá–C Taker xung đột',TRANSITION:'Chuyển tiếp',BREAKOUT:'Phá biên · xn 2 M15'};
  return `${s.stale?'DỮ LIỆU CŨ · ':''}${s.direction>0?'↑ ':s.direction<0?'↓ ':''}${names[s.phase]}${s.score===null?'':` · Nền ${s.score>0?'+':''}${s.score}/±4`}${s.phase==='WEAKENING'&&s.fallingBoxes?` · giảm lực ${s.fallingBoxes} hộp`:''} | ${s.oiText}`;
}
