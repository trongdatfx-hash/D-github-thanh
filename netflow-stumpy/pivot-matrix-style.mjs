const H=3600000,S=900000;
const neutral=reason=>({state:'unconfirmed',width:1,dashed:false,label:'Chưa đủ xác nhận',reason});
// Display-only assessment at the latest closed H1. Not an entry signal or
// historical probability; do not use the resulting style as a past feature.
export function pivotMatrixStyle(zone,matrix,bars=[],now=Date.now()){
  if(!zone||!['support','resistance'].includes(zone.kind)||![zone.low,zone.high,zone.level,zone.confirmedAt,now].every(Number.isFinite))return neutral('Thiếu vùng hoặc thời gian xác nhận');
  const cols=(matrix?.columns??[]).filter(c=>c.t>=zone.confirmedAt&&c.t+H<=now).slice(-3);
  if(cols.length<2||cols.some((c,i)=>i&&c.t-cols[i-1].t!==H)||now-cols.at(-1).t-H>H)return neutral('Chờ ít nhất 2 H1 liên tục sau xác nhận, còn mới');
  const price=new Map(bars.filter(b=>b.t+S<=now&&b.sourceComplete!==false).map(b=>[b.t,b]));
  const samples=cols.map(c=>Array.from({length:4},(_,i)=>price.get(c.t+i*S)));
  if(samples.some(a=>a.some(b=>!b||![b.o,b.h,b.l,b.c].every(Number.isFinite))))return neutral('Thiếu giá M15 đóng');
  const touching=samples.flat().filter(b=>b.l<=zone.high&&b.h>=zone.low);
  if(!touching.length)return neutral('Nhóm H1 chưa chạm vùng');
  if(cols.some(c=>!['position','slope','deltaNF','oi'].every(k=>Number.isFinite(c.values?.[k]))))return neutral('Thiếu ma trận giá, dòng tiền hoặc OI');
  const expected=zone.kind==='support'?1:-1,threshold=Math.ceil(cols.length*2/3);
  const agree=d=>cols.filter(c=>c.values.position===d&&c.values.slope*d>=0&&c.values.deltaNF===d&&c.values.oi===d).length;
  const wlrSupports=d=>cols.some(c=>c.values.slope===d);
  const closes=samples.flat().slice(-2).map(b=>b.c),last=samples.at(-1).at(-1);
  const holds=expected>0?closes.every(c=>c>=zone.low):closes.every(c=>c<=zone.high);
  const reaction=touching.some(b=>expected*(last.c-b.c)>0);
  if(wlrSupports(expected)&&agree(expected)>=threshold&&holds&&reaction)return {state:'reinforced',width:agree(expected)===cols.length?4:3,dashed:false,label:'Được củng cố',asOf:cols.at(-1).t+H,reason:`${agree(expected)}/${cols.length} H1 giá, dòng tiền, OI đồng thuận; giá giữ và phản ứng khỏi vùng`};
  const advancing=expected*(closes[1]-closes[0])<0;
  const near=expected>0?last.c<=zone.high:last.c>=zone.low;
  if(wlrSupports(-expected)&&agree(-expected)>=threshold&&advancing&&near)return {state:'pressure',width:2,dashed:true,label:'Chịu áp lực phá',asOf:cols.at(-1).t+H,reason:`${agree(-expected)}/${cols.length} H1 ngược hướng giữ vùng; giá đang tiến vào hoặc xuyên vùng`};
  return neutral('Giá hoặc ma trận chưa đồng thuận tại vùng');
}
