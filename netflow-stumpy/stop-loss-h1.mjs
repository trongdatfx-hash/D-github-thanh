// H1 accumulation is evidence from closed score boxes, not resting stop orders.
const H=3600000,M=900000;
export function h1AccumulatedStops({price=[],records=[],now=Date.now()}={}){
  const bars=price.filter(b=>b.t+M<=now&&b.sourceComplete!==false);
  const empty={support:null,resistance:null,zones:[]};
  if(bars.length<20)return empty;
  const last=bars.at(-1),byTime=new Map(bars.map(b=>[b.t,b]));
  const tr=bars.slice(-96).map((b,i,a)=>Math.max(b.h-b.l,Math.abs(b.h-(a[i-1]?.c??b.o)),Math.abs(b.l-(a[i-1]?.c??b.o))));
  const atr=tr.slice(-14).reduce((a,b)=>a+b,0)/14;
  if(!(atr>0))return empty;
  const unique=new Map();
  for(const r of records){
    const partialOi=r.status==='PARTIAL'&&r.missing?.length===1&&r.missing[0]==='OI_P62'&&r.available===4;
    if((r.status!=='LOCKED'&&!partialOi)||r.closedBars!==4||r.blockEnd!==r.blockStart+H-1||(!partialOi&&r.lockedAt!==r.blockEnd+1)||r.blockEnd>=now||r.blockEnd>=last.t+M||!Number.isInteger(r.score)||Math.abs(r.score)>5||r.score===0)continue;
    unique.set(r.blockStart,{...r,weight:partialOi?.75:1});
  }
  const candidates=[];
  for(const r of [...unique.values()].sort((a,b)=>a.blockStart-b.blockStart).slice(-120)){
    const rows=Array.from({length:4},(_,i)=>byTime.get(r.blockStart+i*M));
    if(rows.some(b=>!b))continue;
    const direction=Math.sign(r.score),o=rows[0].o,c=rows[3].c;
    // Same score sign is the type; reject price moving against that sign.
    if(direction*(c-o)<=0)continue;
    const low=direction>0?Math.min(...rows.map(b=>b.l)):Math.max(o,c);
    const high=direction>0?Math.min(o,c):Math.max(...rows.map(b=>b.h));
    if(!(high>low)|| (direction>0?high>=last.c:low<=last.c))continue;
    if(bars.some(b=>b.t>=r.blockEnd+1&&(direction>0?b.c<low:b.c>high)))continue;
    candidates.push({kind:direction>0?'support':'resistance',low,high,start:r.blockEnd+1,points:Math.abs(r.score)*r.weight,boxes:1,missing:r.missing?.length??0});
  }
  const groups=[];
  for(const z of candidates){
    const g=groups.find(g=>g.kind===z.kind&&z.low<=g.high&&z.high>=g.low&&Math.max(g.high,z.high)-Math.min(g.low,z.low)<=1.5*atr);
    if(g){g.low=Math.min(g.low,z.low);g.high=Math.max(g.high,z.high);g.points+=z.points;g.boxes++;g.missing+=z.missing;g.start=Math.max(g.start,z.start);}
    else groups.push({...z});
  }
  const zones=groups.filter(g=>g.boxes>=2).map(g=>{
    const direction=g.kind==='support'?1:-1;
    const wicks=bars.slice(-96).map(b=>direction>0?Math.min(b.o,b.c)-b.l:b.h-Math.max(b.o,b.c)).sort((a,b)=>a-b);
    const buffer=Math.max(.15*atr,wicks[Math.floor((wicks.length-1)*.75)]??0);
    const level=direction>0?g.low-buffer:g.high+buffer,mass=g.points/5;
    return {...g,level,end:last.t+M,atr,mass,opacity:.12+.34*(1-Math.exp(-mass/3)),borderWidth:1+3*(1-Math.exp(-mass/3)),distanceAtr:Math.abs(last.c-level)/atr,distancePct:100*Math.abs(last.c-level)/last.c,source:'H1'};
  });
  const selected=[];
  for(const kind of ['support','resistance']){
    const side=zones.filter(z=>z.kind===kind).sort((a,b)=>a.distanceAtr-b.distanceAtr);
    selected.push(...side.slice(0,3));empty[kind]=side[0]??null;
  }
  return {...empty,zones:selected};
}
