// H1 score v2: descriptive evidence, never a probability or a trading signal.
export const H1_SCORE_VERSION='h1-score-rw64-p62-align-v2';
export const SCORE_STEP=900000,HOUR=3600000;
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const sum=a=>a.reduce((s,x)=>s+x,0);
const finite=Number.isFinite;
const bounded=x=>Math.max(-5,Math.min(5,x));
function quantile(a,p){const b=[...a].sort((x,y)=>x-y),i=(b.length-1)*p;return b[Math.floor(i)]+(b[Math.ceil(i)]-b[Math.floor(i)])*(i-Math.floor(i));}
function random(seed){let state=seed>>>0;return ()=>{state+=0x6d2b79f5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export function lockedH1Blocks(states,now=Date.now(),visibleTo=Infinity){
  const groups=new Map();
  for(const s of states?.values?.()||[]){
    if(s?.preview!==false||!finite(s.blockStart)||s.blockEnd!==s.blockStart+HOUR-1||s.blockEnd>=now||s.blockEnd>visibleTo||![-1,0,1].includes(s.direction))continue;
    const old=groups.get(s.blockStart);if(!old||s.t>old.t)groups.set(s.blockStart,s);
  }
  return [...groups.values()].sort((a,b)=>a.blockStart-b.blockStart).slice(-8);
}
// Signed symmetric bootstrap: 64 PRIOR M15 log-change magnitudes, 3 or 4 steps,
// 512 deterministic paths. Starts at H1 open; no conditioning on the H1 close.
export function randomWalkBounds(prior,startPrice,seed,steps=4){
  const history=prior.slice(-65);
  if(![3,4].includes(steps)||history.length!==65||history.some((b,i)=>!finite(b.c)||b.c<=0||(i&&b.t-history[i-1].t!==SCORE_STEP))||!(startPrice>0))return null;
  const magnitudes=history.slice(1).map((b,i)=>Math.abs(Math.log(b.c/history[i].c))),rng=random(Math.floor(seed/HOUR)^0x48a5137),ends=[];
  for(let path=0;path<512;path++){let move=0;for(let step=0;step<steps;step++){const size=magnitudes[Math.floor(rng()*magnitudes.length)];move+=(rng()<.5?-1:1)*size;}ends.push(startPrice*Math.exp(move));}
  return {p20:quantile(ends,.2),p80:quantile(ends,.8),paths:512,priorReturns:64};
}
export function scoreH1Box(block,{bars=[],bands=new Map(),deltas=new Map(),flows=new Map(),oi=new Map(),oiPoints=new Map(),now=Date.now()}={}){
  const start=block.blockStart,end=start+HOUR;
  const preview=block.preview===true;
  if(!finite(start)||![false,true].includes(block.preview)||block.blockEnd<start+3*SCORE_STEP-1||block.blockEnd>end-1||(!preview&&(block.blockEnd!==end-1||end>now))||(preview&&end<=now))return null;
  const map=new Map(bars.filter(b=>b.t>=start&&b.t<end&&b.t+SCORE_STEP<=now&&b.sourceComplete!==false).map(b=>[b.t,b]));
  const count=preview?3:4,sample=Array.from({length:count},(_,i)=>map.get(start+i*SCORE_STEP));
  const missing=[],parts={position:null,slope:null,randomWalk:null,deltaNF:null,oi:null},details={};
  if(sample.some(b=>!b||![b.o,b.h,b.l,b.c].every(finite)))return preview?null:{version:H1_SCORE_VERSION,blockStart:start,blockEnd:end-1,boxDirection:block.direction,score:null,parts,missing:['M15'],status:'WAIT_DATA'};
  const prior=bars.filter(b=>b.t<start&&b.t+SCORE_STEP<=start).sort((a,b)=>a.t-b.t);
  const mids=sample.map(b=>bands.get(b.t)?.mid);
  if(mids.every(finite)){
    const above=sample.filter((b,i)=>b.c>mids[i]).length,below=sample.filter((b,i)=>b.c<mids[i]).length;
    parts.position=above>=3?1:below>=3?-1:0;details.position={above,below,total:count};
    const atrBars=prior.slice(-15);
    if(atrBars.length===15&&atrBars.every((b,i)=>!i||b.t-atrBars[i-1].t===SCORE_STEP)){
      const atr=mean(atrBars.slice(1).map((b,i)=>Math.max(b.h-b.l,Math.abs(b.h-atrBars[i].c),Math.abs(b.l-atrBars[i].c))));
      if(atr>0){const change=(mids.at(-1)-mids[0])/atr;parts.slope=change>.15?1:change<-.15?-1:0;details.slope={changeATR:change,thresholdATR:.15,priorATR:atr};}
    }
    if(parts.slope===null)missing.push('ATR');
  }else missing.push('WLR');
  const rw=randomWalkBounds(prior,sample[0].o,start,count);
  if(rw){parts.randomWalk=sample.at(-1).c>rw.p80?1:sample.at(-1).c<rw.p20?-1:0;details.randomWalk=rw;}else missing.push('RW64');
  const dv=sample.map(b=>deltas.get(b.t)?.value),nf=sample.map(b=>flows.get(b.t)?.net);
  let flowDirection=0;
  if(dv.every(finite)&&nf.every(finite)){
    const volumeDelta=sum(dv),takerNF=sum(nf);flowDirection=Math.sign(volumeDelta)===Math.sign(takerNF)?Math.sign(volumeDelta):0;
    parts.deltaNF=flowDirection;details.deltaNF={volumeDelta,takerNF,source:'SPY ΔV × C Taker NF (SPY+QQQ)'};
  }else missing.push('DELTA_NF');
  const oiPairs=sample.map(b=>[oi.get(b.t-SCORE_STEP)?.oi,oi.get(b.t)?.oi]),points=sample.map(b=>oiPoints.get(b.t));
  if(oiPairs.every(pair=>pair.every(x=>finite(x)&&x>0))&&points.every(p=>p?.gateReady===true)){
    const changes=oiPairs.map(([before,after])=>after-before),net=sum(changes),gross=sum(changes.map(Math.abs));
    const direction=Math.sign(sample.at(-1).c-sample[0].o),kind=direction>0?'up-oi-increase':'down-oi-increase';
    const support=points.filter(p=>p.matched&&p.kind===kind&&p.delta>0),weight=sum(support.map(p=>Math.abs(p.delta))),share=gross?weight/gross:0;
    parts.oi=direction!==0&&direction===flowDirection&&net>0&&support.length>=2&&share>=.6?direction:0;
    details.oi={netDelta:net,grossDelta:gross,support:support.length,share,requiredCount:2,requiredShare:.6,percentile:.62,meaning:net<0?'Thu hẹp vị thế; không cộng điểm hướng':'OI không tự xác định Long/Short'};
  }else missing.push('OI_P62');
  // Keep the RW tail direction separate from an alignment weight. Correlated
  // WLR and H1 color can qualify ONE bonus, never two independent confirmations.
  // Preview H1 color may contain the forming fourth candle: use only closed WLR.
  const rwDirection=parts.randomWalk??0,wlrDirection=parts.slope??0,boxDirection=preview?0:([-1,0,1].includes(block.direction)?block.direction:0);
  const matchedWLR=rwDirection!==0&&rwDirection===wlrDirection,matchedBox=rwDirection!==0&&rwDirection===boxDirection;
  const bonus={randomWalkAlignment:matchedWLR||matchedBox?rwDirection:0};
  if(details.randomWalk)details.randomWalk.alignment={direction:rwDirection,wlrDirection,boxDirection,matchedWLR,matchedBox,boxEligible:!preview,bonus:bonus.randomWalkAlignment};
  const known=Object.values(parts).filter(finite),rawScore=known.length?sum(known)+bonus.randomWalkAlignment:null,score=rawScore===null?null:bounded(rawScore);
  return {version:H1_SCORE_VERSION,blockStart:start,blockEnd:end-1,boxDirection:block.direction,score,rawScore,bonus,parts,details,missing,available:known.length,closedBars:count,asOf:sample.at(-1).t+SCORE_STEP,status:preview?'PREVIEW':missing.length?'PARTIAL':'LOCKED',lockedAt:preview||missing.length?null:end};
}
// Latest eight scored slots include the running hour only after three closed M15.
export function scoreableH1Blocks(states,bars,now=Date.now(),visibleTo=Infinity){
  const groups=new Map(lockedH1Blocks(states,now,visibleTo).map(b=>[b.blockStart,b]));
  const closed=new Set(bars.filter(b=>b.t+SCORE_STEP<=now&&b.sourceComplete!==false&&[b.o,b.h,b.l,b.c].every(finite)).map(b=>b.t));
  for(const b of states?.values?.()||[]){
    if(b?.preview!==true||!finite(b.blockStart)||![-1,0,1].includes(b.direction)||now>=b.blockStart+HOUR||b.blockEnd<b.blockStart+3*SCORE_STEP-1||b.blockEnd>=b.blockStart+HOUR||b.blockStart+3*SCORE_STEP-1>visibleTo)continue;
    if(![0,1,2].every(i=>closed.has(b.blockStart+i*SCORE_STEP)))continue;
    const old=groups.get(b.blockStart);if(!old||b.t>old.t)groups.set(b.blockStart,b);
  }
  return [...groups.values()].sort((a,b)=>a.blockStart-b.blockStart).slice(-8);
}
const MEMORY_KEY='dvp:h1-box-score:rw64-p62-align-v2';
export class H1ScoreLedger {
  constructor(storage){this.storage=storage;this.records=new Map();try{const saved=JSON.parse(storage?.getItem(MEMORY_KEY)||'null');if(saved?.version===H1_SCORE_VERSION)for(const r of (saved.records||[]).slice(-512))if(r?.version===H1_SCORE_VERSION&&r.status==='LOCKED'&&r.missing?.length===0&&Number.isInteger(r.score)&&Math.abs(r.score)<=5&&r.blockEnd===r.blockStart+HOUR-1&&Object.values(r.parts||{}).length===5&&Object.values(r.parts).every(x=>[-1,0,1].includes(x))&&[-1,0,1].includes(r.bonus?.randomWalkAlignment)&&(!r.bonus.randomWalkAlignment||r.bonus.randomWalkAlignment===r.parts.randomWalk&&(r.parts.slope===r.parts.randomWalk||r.boxDirection===r.parts.randomWalk))&&sum(Object.values(r.parts))+r.bonus.randomWalkAlignment===r.rawScore&&bounded(r.rawScore)===r.score)this.records.set(r.blockStart,r);}catch{}}
  get(block,input){
    // Preview uses closed data and never reads or writes the locked ledger.
    if(block.preview===true)return scoreH1Box(block,input);
    if(block.preview!==false||block.blockEnd>=input.now)return null;
    const cached=this.records.get(block.blockStart);if(cached)return cached;
    const score=scoreH1Box(block,input);if(score?.status==='LOCKED'){
      this.records.set(block.blockStart,score);const records=[...this.records.values()].sort((a,b)=>a.blockStart-b.blockStart).slice(-512);this.records=new Map(records.map(r=>[r.blockStart,r]));
      try{this.storage?.setItem(MEMORY_KEY,JSON.stringify({version:H1_SCORE_VERSION,records}));}catch{/* Deterministic score still works without browser storage. */}
    }
    return score;
  }
}
export function scoreTitle(r){
  if(!r)return 'Chờ tối thiểu 3 nến M15 đã đóng trong cùng H1.';
  const val=x=>x===null||x===undefined?'thiếu':x>0?'+'+x:String(x),time=t=>new Date(t).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),n=r.closedBars??4;
  const phase=r.status==='PREVIEW'?'ĐIỂM TẠM · 3/4 M15 ĐÓNG':r.status==='LOCKED'?'ĐIỂM ĐÃ KHÓA':'HỘP ĐÃ KHÓA, ĐIỂM CHƯA ĐỦ DỮ LIỆU';
  return [`H1 ${time(r.blockStart)} → ${time(r.blockEnd+1)} · ${phase}`,`Điểm ${r.score===null?'—':val(r.score)} / ±5${r.missing.length?' · thiếu '+r.missing.join(', '):''}`,`WLR vị trí ${val(r.parts.position)} · dốc ${val(r.parts.slope)} | RW ${val(r.parts.randomWalk)} · thưởng ${val(r.bonus?.randomWalkAlignment??0)} | ΔV×NF ${val(r.parts.deltaNF)} | OI ${val(r.parts.oi)}`,`WLR: ≥3/${n} close cùng phía; dốc WLR qua ${n} nến đóng vượt ±0,15 ATR14 trước hộp.`,`RW: P20/P80 của 512 đường ${n} bước, độ lớn log-return lấy từ 64 M15 trước hộp, dấu ± cân bằng; không ép giá đích.`,`ΔV×NF: dấu tổng ${n} M15 SPY ΔV và C Taker NF (SPY+QQQ). OI: cùng hướng giá, ΔV, NF; tổng ΔOI>0; ≥2 nến OI tăng đồng thuận vượt P62, chiếm ≥60% |ΔOI|.`,r.details?.randomWalk?`RW P20 ${r.details.randomWalk.p20.toFixed(2)} · P80 ${r.details.randomWalk.p80.toFixed(2)} · thưởng ${val(r.bonus?.randomWalkAlignment??0)} (${r.details.randomWalk.alignment?.matchedWLR?'cùng dốc WLR':r.details.randomWalk.alignment?.matchedBox?'cùng màu H1':'chưa thuận chiều'})`:'RW thiếu nến.',r.details?.oi?`ΔOI ${n} M15 ${r.details.oi.netDelta.toFixed(2)} · ${r.details.oi.support}/${n} nến ủng hộ · ${(100*r.details.oi.share).toFixed(0)}% |ΔOI|`:'OI thiếu hoặc chưa đủ nền P62.',`RW: close > P80 là +1, close < P20 là −1, ở giữa là 0. Thưởng thêm +1/−1 cùng hướng nếu khớp dốc WLR (vượt ±0,15 ATR) hoặc màu H1 đã khóa; khớp cả hai vẫn chỉ thưởng một lần. Điểm tạm chỉ xét WLR. Tổng thô ${val(r.rawScore)} → hiển thị ${val(r.score)} trong ±5. Đây là trọng số đồng thuận, không phải bằng chứng độc lập.`, '~: điểm tạm sau 3 M15 đóng, tính lại khi M15 thứ tư đóng; không lưu thành điểm khóa. *: thiếu dữ liệu, chỉ cộng thành phần có sẵn. Điểm mô tả lực, không phải xác suất.'].join('\n');
}



