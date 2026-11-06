import {pattern,closedBars,settle,similar,dayNY,STEP} from '../netflow-stumpy/gpt-pattern-core.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGIN||'https://trongdatfx-hash.github.io';
    if(origin&&origin!==allowed)return json({error:'Origin không được phép.'},403);
    const headers={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'};
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    let response;
    if(request.method!=='POST')response=json({error:'Chỉ hỗ trợ POST.'},405);
    else if(!env.ANALYST_TOKEN)response=json({error:'Máy chủ chưa cấu hình ANALYST_TOKEN.'},503);
    else if(!await sameSecret(request.headers.get('Authorization')||'',`Bearer ${env.ANALYST_TOKEN}`))response=json({error:'Mã truy cập không đúng.'},401);
    else if(Number(request.headers.get('Content-Length')||0)>300000)response=json({error:'Dữ liệu quá lớn.'},413);
    else {
      // All tabs, devices and symbols share one durable quota and learning store.
      const id=env.PATTERN_MEMORY.idFromName('owner-m15-v1');
      response=await env.PATTERN_MEMORY.get(id).fetch(request);
    }
    const result=new Response(response.body,response);for(const [k,v] of Object.entries(headers))result.headers.set(k,v);return result;
  }
};
async function sameSecret(a,b){
  const hash=async x=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)));
  const [x,y]=await Promise.all([hash(a),hash(b)]);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;
}
export class PatternMemory {
  constructor(ctx,env){this.storage=ctx.storage;this.env=env;}
  async fetch(request){
    try {
      const path=new URL(request.url).pathname;
      if(!['/observe','/analyze'].includes(path))return json({error:'Đường dẫn không hợp lệ.'},404);
      const text=await request.text();if(text.length>300000)return json({error:'Dữ liệu quá lớn.'},413);
      const body=JSON.parse(text),now=Date.now();
      if(!['SPYUSDT','QQQUSDT'].includes(body.symbol)||body.interval!=='15m')return json({error:'Chỉ hỗ trợ SPYUSDT/QQQUSDT M15.'},400);
      const bars=closedBars(body.bars,now),current=pattern(bars,{symbol:body.symbol,now});
      if(!current)return json({error:'Cần ít nhất 24 nến M15 liên tục và 4 pivot đã xác nhận.'},422);
      let samples=await this.storage.list({prefix:'sample:',reverse:true,limit:1000});
      for(const [key,sample] of samples){if(sample.symbol!==body.symbol||sample.outcome)continue;const updated=settle(sample,bars,now);if(updated.outcome){await this.storage.put(key,updated);samples.set(key,updated);}}
      if(path==='/observe'){
        const fresh=now-current.asOf>=0&&now-current.asOf<2*STEP,day=dayNY(now);
        if(!fresh||dayNY(current.lastTime)!==day)return json({learned:false,reason:'DELAYED: không lưu mẫu cũ vào ngày hiện tại.'});
        const key=`sample:${current.lastTime}:${current.id}`,quotaKey=`learn:${day}`;
        const result=await this.storage.transaction(async tx=>{
          const count=await tx.get(quotaKey)||0;
          if(await tx.get(key))return {learned:false,reason:'Mẫu đã lưu.',count};
          // A pivot belongs to one sample, even when further candles arrive.
          const pivotKey=`pivot:${current.id}`;
          if(await tx.get(pivotKey))return {learned:false,reason:'Pivot đã học.',count};
          const previous=await tx.get(`last:${body.symbol}`);
          if(previous&&current.firstTime<=previous.lastTime+8*STEP)return {learned:false,reason:'Chờ mẫu độc lập sau cửa sổ 8 nến.',count};
          if(count>=3)return {learned:false,reason:'Đã đủ 3 mẫu mới/ngày New York (gộp hai mã).',count};
          await tx.put(key,{...current,learnedAt:now,day,outcome:null});await tx.put(pivotKey,true);
          await tx.put(quotaKey,count+1);await tx.put(`last:${body.symbol}`,{lastTime:current.lastTime});
          return {learned:true,count:count+1,reason:'Đã lưu mẫu; chờ kết quả sau 8 nến đóng.'};
        });
        // Bound retained learning history. Quotas remain durable.
        if(samples.size>=1000&&result.learned){const oldest=[...samples.keys()].at(-1);await this.storage.delete(oldest);}
        return json({...result,day,timeZone:'America/New_York',limit:3});
      }
      if(!this.env.OPENAI_API_KEY)return json({error:'Chưa cấu hình OPENAI_API_KEY ở máy chủ. Chưa gọi GPT.'},503);
      const stats=similar(current,[...samples.values()]);
      const bytes=new TextEncoder().encode(JSON.stringify({current,stats}));
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
      const cacheKey=`answer:${hash}`,cached=await this.storage.get(cacheKey);
      if(cached)return json({...cached,cached:true});
      const day=dayNY(now),admitted=await this.storage.transaction(async tx=>{
        const count=await tx.get(`calls:${day}`)||0;
        if(count>=20)return 'LIMIT';
        const pending=await tx.get(`pending:${hash}`);if(pending&&now-pending<120000)return 'PENDING';
        await tx.put(`pending:${hash}`,now);await tx.put(`calls:${day}`,count+1);return 'OK';
      });
      if(admitted!=='OK')return json({error:admitted==='LIMIT'?'Đã đạt giới hạn 20 lượt gọi GPT/ngày. Mẫu đã trả lời vẫn mở lại được.':'GPT đang phân tích mẫu này, hãy đợi rồi thử lại.'},429);
      let answer;
      try {
        const response=await fetch('https://api.openai.com/v1/responses',{
          method:'POST',headers:{Authorization:`Bearer ${this.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(55000),
          body:JSON.stringify({model:this.env.OPENAI_MODEL||'gpt-5.6-terra',store:false,reasoning:{effort:'low'},max_output_tokens:1800,
            instructions:'Bạn phân tích cấu trúc nến M15 bằng tiếng Việt. Chỉ dùng số liệu JSON cung cấp. Đây là dữ liệu nến đã đóng trong cửa sổ chart, không có ảnh và không có nến đang chạy. Pivot cần 2 nến phải xác nhận. Tự nhận định hình học (xu hướng, kênh, co hẹp, phá cấu trúc), nêu HH HL LH LL, độ dốc ATR, R2, tỷ lệ thân/râu và dòng taker nếu có. Không bịa tên mẫu, số mẫu hay xác suất. Không suy ra Long/Short hoặc dealer từ volume; không có dữ liệu WLR/SPY V/OI thì nói rõ. Nêu mốc hỗ trợ/kháng cự từ pivot thực, điều kiện xác nhận/vô hiệu theo giá. Bộ nhớ là các mẫu lưu trước đó, không phải huấn luyện trọng số GPT. stats.status WAIT: nói CHƯA ĐỦ MẪU, không phát biểu xác suất dự báo. Thống kê chỉ mô tả mẫu quan sát đã chọn, không phải kiểm định chiến lược. Trả lời ngắn tối đa 350 từ, gồm Cấu trúc hiện tại; Đặc trưng; Đối chiếu lịch sử; Kịch bản và mốc vô hiệu. Không đưa khuyến nghị vào lệnh chắc thắng.',
            input:JSON.stringify({current,stats,freshness:now-current.asOf<2*STEP?'RECENT_CLOSED_BARS':'HISTORICAL_OR_DELAYED',learning:{capPerNYDay:3,stored:samples.size,outcomeHorizon:8}})})});
        if(!response.ok)throw Error(`OpenAI HTTP ${response.status}`);
        const data=await response.json();answer=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
        if(data.status!=='completed'||!answer)throw Error('OpenAI chưa hoàn thành trả lời; hãy thử lại.');
      } catch(error){return json({error:error.name==='TimeoutError'?'GPT quá thời gian chờ.':error.message},502);}
      finally{await this.storage.delete(`pending:${hash}`);}
      const result={answer,model:this.env.OPENAI_MODEL||'gpt-5.6-terra',asOf:current.asOf,symbol:body.symbol,sequence:current.sequence,stats,stored:samples.size,cached:false};
      await this.storage.put(cacheKey,result);
      const answers=await this.storage.list({prefix:'answer:',limit:101});if(answers.size>100)await this.storage.delete([...answers.keys()].find(k=>k!==cacheKey));
      return json(result);
    } catch(error){return json({error:error instanceof SyntaxError?'JSON không hợp lệ.':error.message||'Lỗi xử lý mẫu.'},400);}
  }
}
