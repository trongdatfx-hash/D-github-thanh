import {sessionAt} from './engine.mjs?v=20261025-dcommon-all1';
// Port of DVP_v2924_clean.pine, Strength and Strength Zone Box sections.
// Input adapter: Binance taker QUOTE delta / SMA20 quote volume, not TV delta.
export const BOX_VERSION='dvp-strength-box-v1';
export const BOX_DEFAULTS=Object.freeze({threshold:.95,back:8,keep:6,exitAtr:.5,extend:60,narrow:.85,wide:1.35,reference:15,mode:'efficiency',sigma:1.5,minT:2});
export function normalCDF(z){z=Math.max(-8,Math.min(8,z));const a=Math.abs(z),t=1/(1+.2316419*a),d=.3989422804014327*Math.exp(-a*a/2),p=d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return z>=0?1-p:p;}
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function rolling(a,v,n){a.push(v);if(a.length>n)a.shift();}
export function strengthBoxLabel(b){return `${Number.isFinite(b.percentile)?'p'+Math.round(100*b.percentile):Number.isFinite(b.ratio)?b.ratio.toFixed(2)+'×':'—'}${b.type==='COMPRESSED'?' NÉN':b.type==='PAID'?' ĐÃ TRẢ':''} · ${b.phase}${b.freeze==='breakout'?' ⤬':b.freeze==='timeout'?' ⌛':''}${b.compositeMode&&b.compositeMode!=='off'?' · C '+({aligned:'thuận',opposed:'nghịch',neutral:'0',missing:'—'})[b.compositeAlignment]:''}`;}
export function summarizeStrengthBox(b,atr,reference,cfg){
 const width=b.top-b.bottom,efficiency=b.tr2>0?width/Math.sqrt(b.tr2):null,magnitude=atr>0?width/atr/Math.sqrt(b.n):null,legacy=atr>0&&reference>0?width/atr/reference:null;
 const ratio=cfg.mode==='efficiency'?efficiency:cfg.mode==='magnitude'?magnitude:legacy;
 const percentile=ratio>0&&cfg.mode!=='legacy'?normalCDF((Math.log(ratio)-(cfg.mode==='efficiency'?.0093:.057))/(cfg.mode==='efficiency'?.2727:.281)):null;
 const type=Number.isFinite(ratio)?ratio<=cfg.narrow?'COMPRESSED':ratio>=cfg.wide?'PAID':'NEUTRAL':'UNKNOWN';
 const color=type==='COMPRESSED'?'#F59E0B':type==='PAID'?'#64748B':b.direction>0?'#1ae0a3':'#ff4d70';
 const den=b.n*b.sxx-b.sx*b.sx,slope=den?(b.n*b.sxy-b.sx*b.sy)/den:0,intercept=(b.sy-slope*b.sx)/b.n,total=b.syy-b.sy*b.sy/b.n,sse=Math.max(0,b.syy-intercept*b.sy-slope*b.sxy),r2=total>0?Math.max(0,Math.min(.999999,1-sse/total)):0,t=b.n>2?Math.sqrt(r2*(b.n-2)/(1-r2)):0;
 return {...b,width,atr,efficiency,magnitude,ratio,percentile,type,color,activity:atr>0?Math.sqrt(b.tr2/b.n)/atr:null,ols:b.n>=5&&t>=cfg.minT?{intercept:intercept+b.y0,slope,offset:cfg.sigma*Math.sqrt(sse/(b.n-2)),t}:null};
}
export function strengthBoxes(rows,{now=Infinity,step=900000,strengthRows=null,compositeRows=new Map(),compositeMode='off',compositeThreshold=.15,...options}={}){
 const cfg={...BOX_DEFAULTS,...options};
 if(!['off','annotate','filter'].includes(compositeMode)||!Number.isFinite(compositeThreshold)||compositeThreshold<=0||compositeThreshold>=1)throw Error('Invalid composite box settings');
 if(!(cfg.threshold>0&&cfg.threshold<1)||!Number.isInteger(cfg.back)||cfg.back<0||cfg.back>60||!Number.isInteger(cfg.extend)||cfg.extend<0||!Number.isInteger(cfg.keep)||cfg.keep<1||cfg.keep>20||!(cfg.narrow>0&&cfg.wide>cfg.narrow)||!['efficiency','magnitude','legacy'].includes(cfg.mode))throw Error('Invalid strength box settings');
 const volumes=[],deltas=[],magnitudes=[],trs=[],refRanges=[],history=[],retired=[],snapshots=new Map(),strength=new Map();let ew=null,rma=null,previous=null,active=null,rendered=null,index=-1;
 for(const row of rows){
  if((row.end??row.t+step-1)>=now)continue;
  if(![row.t,row.o,row.h,row.l,row.c,row.q,row.buy].every(Number.isFinite)||row.q<0||row.buy<0||row.buy>row.q)continue;
  index++;
  if(previous&&row.t-previous.t!==step){if(rendered)retired.push(rendered);active=null;rendered=null;volumes.length=deltas.length=magnitudes.length=trs.length=refRanges.length=history.length=0;ew=null;rma=null;}
  const tr=Math.max(row.h-row.l,previous?Math.abs(row.h-previous.c):0,previous?Math.abs(row.l-previous.c):0);rolling(trs,tr,14);rma=rma===null?(trs.length===14?mean(trs):null):(13*rma+tr)/14;
  rolling(volumes,row.q,20);const net=2*row.buy-row.q,volumeMean=volumes.length===20?mean(volumes):0;rolling(deltas,volumeMean>0?net/volumeMean:net,8);
  let s=null;if(deltas.length===8){const r=deltas.reduce((a,b)=>a+b,0);ew=ew===null?r:ew+(1-2**(-.5))*(r-ew);rolling(magnitudes,Math.abs(ew),500);if(magnitudes.length===500){const sigma=mean(magnitudes)*1.2533141373155003;s=sigma>0?2*normalCDF(ew/sigma)-1:null;}}
  if(strengthRows)s=strengthRows.get(row.t)??null;
  strength.set(row.t,s);history.push({...row,tr,index});if(history.length>Math.max(61,cfg.back+1,cfg.reference))history.shift();
  const ref=history.slice(-cfg.reference);if(ref.length===cfg.reference&&rma>0)rolling(refRanges,(Math.max(...ref.map(r=>r.h))-Math.min(...ref.map(r=>r.l)))/rma,500);
  const reference=refRanges.length===500?mean(refRanges):null,c=compositeRows.get(row.t)?.adjusted,compAligned=Number.isFinite(c)&&c*(s>=0?1:-1)>=compositeThreshold;
  const inZone=Number.isFinite(s)&&Math.abs(s)>=cfg.threshold&&index>cfg.back+5&&history.length>=cfg.back+1&&(active?.live||compositeMode!=='filter'||compAligned);
  function add(b,r){const x=r.index-b.startIndex,y=r.c-b.y0;b.n++;b.tr2+=r.tr*r.tr;b.sx+=x;b.sy+=y;b.sxy+=x*y;b.sxx+=x*x;b.syy+=y*y;}
  if(inZone&&!active?.live){
   if(rendered)retired.push({...rendered,replaced:active?.open===true});
   const seed=history.slice(-cfg.back-1),first=seed[0];active={id:row.t,start:first.t,startIndex:first.index,issuedAt:row.t+step,entryTime:row.t,right:row.t,rightIndex:index,top:Math.max(...seed.map(r=>r.h)),bottom:Math.min(...seed.map(r=>r.l)),y0:first.c,direction:s>=0?1:-1,phase:row.session??sessionAt(row.t).session,maxStrength:Math.abs(s),live:true,open:true,extension:0,freeze:null,n:0,tr2:0,sx:0,sy:0,sxy:0,sxx:0,syy:0};for(const r of seed)add(active,r);
  }else if(inZone&&active?.live){active.top=Math.max(active.top,row.h);active.bottom=Math.min(active.bottom,row.l);active.maxStrength=Math.max(active.maxStrength,Math.abs(s));add(active,history.at(-1));}
  else if(active?.live)active.live=false;
  let froze=false;if(active?.open&&!active.live&&!inZone){active.extension++;const off=(rma??0)*cfg.exitAtr,out=row.c>active.top+off||row.c<active.bottom-off;if(out||active.extension>=cfg.extend){active.open=false;active.freeze=out?'breakout':'timeout';froze=true;}}
  if(active&&(active.live||active.open||froze)){
   active.compositeMode=compositeMode;active.compositeStrength=Number.isFinite(c)?c:null;active.compositeAlignment=!Number.isFinite(c)?'missing':c*active.direction>=compositeThreshold?'aligned':c*active.direction<=-compositeThreshold?'opposed':'neutral';
   if(active.live||active.open){active.right=row.t;active.rightIndex=index;}
   rendered=summarizeStrengthBox(active,rma,reference,cfg);rendered.asOf=row.t;rendered.label=strengthBoxLabel(rendered);
   // This is the box AS KNOWN on this close, never the eventual final box.
   if(active.live||active.open)snapshots.set(row.t,{...rendered});
  }
  while(retired.length>cfg.keep)retired.shift();previous=row;
 }
 return {version:BOX_VERSION,boxes:[...retired,...(rendered?[rendered]:[])],snapshots,strength,latest:rendered,settings:{...cfg,compositeMode,compositeThreshold}};
}
