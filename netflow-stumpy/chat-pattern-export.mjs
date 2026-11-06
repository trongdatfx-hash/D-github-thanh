import {pattern,closedBars,settle,similar,dayNY,STEP} from './gpt-pattern-core.mjs?v=20261106-gpt1';
export const CHAT_MEMORY_KEY='dvp:chat-pattern-memory:v1';
export function updateMemory(saved,bars,symbol,now=Date.now()){
  const memory=saved?.version===1&&Array.isArray(saved.samples)?saved:{version:1,samples:[]};
  return {version:1,samples:memory.samples.filter(s=>s?.version&&Number.isFinite(s.learnedAt)&&now-s.learnedAt<90*86400000).slice(-270).map(s=>s.symbol===symbol?settle(s,bars,now):s)};
}
export function exportChatSample({bars,symbol,live=false,visible,now=Date.now(),memory}){
  const closed=closedBars(bars,now),selected=closed.filter(b=>b.t>=visible.from*1000&&b.t<=visible.to*1000);
  const current=pattern(selected,{now,symbol});
  if(!current)throw Error('Vùng xem cần ít nhất 24 nến M15 liên tục và 4 pivot xác nhận. Hãy thu nhỏ chart để thấy đủ cấu trúc.');
  const day=dayNY(now),next=updateMemory(memory,closed,symbol,now),same=next.samples.find(s=>s.id===current.id);
  const count=next.samples.filter(s=>s.exportDay===day).length;
  if(!same&&count>=3)throw Error('Đã lấy đủ 3 mẫu M15 mới hôm nay (ngày New York, gộp SPY/QQQ trên trình duyệt này). Có thể mở lại mẫu đã lấy.');
  if(!same)next.samples.push({...current,learnedAt:now,exportDay:day,outcome:null});
  const stats=similar(current,next.samples),newCount=next.samples.filter(s=>s.exportDay===day).length;
  const payload={format:'DVP_CHAT_PATTERN_V1',exportedAt:now,sampleNumberToday:newCount,dailyLimit:3,quotaScope:'Trình duyệt này; ngày America/New_York. Không tự đồng bộ giữa thiết bị.',source:{url:'https://trongdatfx-hash.github.io/D-github-thanh/',symbol,interval:'15m',freshness:live&&now-current.asOf<2*STEP?'LIVE_CLOSED_BARS':'HISTORICAL_OR_DELAYED',visible,formingCandleExcluded:true},current,statistics:stats,memory:{retained:next.samples.length,completed:next.samples.filter(s=>s.outcome).length,samples:next.samples.filter(s=>s.lastTime<=current.lastTime&&(s.outcome?.closedAt<=current.asOf||s.id===current.id)).slice(-12).map(({id,symbol,sequence,lastTime,features,outcome})=>({id,symbol,sequence,lastTime,features,outcome:outcome?.closedAt<=current.asOf?outcome:null}))},candles:selected.filter(b=>b.t>=current.firstTime).slice(-128)};
  const prompt='Phân tích mẫu M15 này trong cuộc chat hiện tại. Đọc dữ liệu bên dưới: HH/HL/LH/LL, hình học thân/râu nến, độ dốc/ATR, R², dòng taker; so sánh các mẫu tôi đã gửi. Chỉ dùng dữ liệu có trong gói và các mẫu thực sự có trong chat; không tự suy ra WLR/SPY V/OI khi thiếu. Nêu cấu trúc, đặc trưng thống kê, mốc xác nhận/vô hiệu và kịch bản sau 8 nến. Nếu chưa đủ mẫu phải ghi CHƯA ĐỦ MẪU, không bịa xác suất. Tối đa 3 mẫu mới/ngày New York, gộp các mã; gói cùng id là cập nhật mẫu cũ. Bộ nhớ này không phải huấn luyện lại trọng số GPT.\n\n';
  return {memory:next,text:prompt+'```json\n'+JSON.stringify(payload)+'\n```',current,count:newCount};
}
