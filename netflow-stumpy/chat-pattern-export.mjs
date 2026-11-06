import {pattern,closedBars,settle,similar,dayNY,STEP} from './gpt-pattern-core.mjs?v=20261106-gpt1';
import {chatFlowContext} from './chat-flow-context.mjs?v=20261106-chatflow1';
export const CHAT_MEMORY_KEY='dvp:chat-pattern-memory:v1';
export function updateMemory(saved,bars,symbol,now=Date.now()){
  const memory=saved?.version===1&&Array.isArray(saved.samples)?saved:{version:1,samples:[]};
  return {version:1,samples:memory.samples.filter(s=>s?.version&&Number.isFinite(s.learnedAt)&&now-s.learnedAt<90*86400000).slice(-270).map(s=>s.symbol===symbol?settle(s,bars,now):s)};
}
export function exportChatSample({bars,symbol,live=false,visible,now=Date.now(),memory,indicatorContext=null}){
  const closed=closedBars(bars,now),selected=closed.filter(b=>b.t>=visible.from*1000&&b.t<=visible.to*1000);
  const current=pattern(selected,{now,symbol});
  const indicators=current?chatFlowContext(indicatorContext,{symbol,bars:closed,firstTime:current.firstTime,lastTime:current.lastTime,asOf:current.asOf}):null;
  if(!current)throw Error('Vùng xem cần ít nhất 24 nến M15 liên tục và 4 pivot xác nhận. Hãy thu nhỏ chart để thấy đủ cấu trúc.');
  const day=dayNY(now),next=updateMemory(memory,closed,symbol,now),same=next.samples.find(s=>s.id===current.id);
  const count=next.samples.filter(s=>s.exportDay===day).length;
  if(!same&&count>=3)throw Error('Đã lấy đủ 3 mẫu M15 mới hôm nay (ngày New York, gộp SPY/QQQ trên trình duyệt này). Có thể mở lại mẫu đã lấy.');
  if(!same)next.samples.push({...current,flowAtCapture:indicators.summary,learnedAt:now,exportDay:day,outcome:null});
  const stats=similar(current,next.samples),newCount=next.samples.filter(s=>s.exportDay===day).length;
  const payload={format:'DVP_CHAT_PATTERN_V1',exportedAt:now,sampleNumberToday:newCount,dailyLimit:3,quotaScope:'Trình duyệt này; ngày America/New_York. Không tự đồng bộ giữa thiết bị.',source:{url:'https://trongdatfx-hash.github.io/D-github-thanh/',symbol,interval:'15m',freshness:live&&now-current.asOf<2*STEP?'LIVE_CLOSED_BARS':'HISTORICAL_OR_DELAYED',visible,formingCandleExcluded:true},current,indicators,statistics:stats,memory:{retained:next.samples.length,completed:next.samples.filter(s=>s.outcome).length,samples:next.samples.filter(s=>s.lastTime<=current.lastTime&&(s.outcome?.closedAt<=current.asOf||s.id===current.id)).slice(-12).map(({id,symbol,sequence,lastTime,features,flowAtCapture,outcome})=>({id,symbol,sequence,lastTime,features,flowAtCapture,outcome:outcome?.closedAt<=current.asOf?outcome:null}))},candles:selected.filter(b=>b.t>=current.firstTime).slice(-128)};
  const prompt='Chỉ phân tích TREND HIỆN TẠI, trả lời tối đa 3 dòng ngắn (khoảng 80 từ):\\n1. Trend: TĂNG / GIẢM / ĐI NGANG / CHƯA RÕ, dựa HH/HL/LH/LL và các nến gần nhất.\\n2. Lực xác nhận: SPY V (đúng nguồn gốc hoặc mượt H1 trong gói), Taker NF riêng mã và Composite (ghi rõ khác nhau), Volume Delta và ΔOI/nến OI đồng thuận/phổ OI. Nêu đồng thuận hay xung đột; thiếu/trễ ghi rõ, không tự suy ra Long/Short hay hấp thụ. Các chỉ báo chung nguồn không được tính thành bằng chứng độc lập.\\n3. Mốc đổi trend gần nhất. Không viết báo cáo dài hoặc kịch bản 8 nến. CHƯA ĐỦ MẪU thì không đưa xác suất. Chỉ dùng dữ liệu đóng đúng timestamp, không dùng phổ ngày hiện tại cho mẫu quá khứ. Cùng id là cập nhật mẫu cũ; tối đa 3 mẫu mới/ngày New York.\\n\\n';
  return {memory:next,text:prompt+'```json\n'+JSON.stringify(payload)+'\n```',current,count:newCount,missingIndicators:indicators.summary.missing};
}
