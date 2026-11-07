export function h1OiLabel(live,error=false){
 if(!live?.ready||![live.delta,live.pct].every(Number.isFinite))return {arrow:'',value:'—',suffix:'',text:'—',title:error?'OI hiện tại lỗi hoặc chưa đủ mẫu; không tự điền 0%.':'Chờ OI hiện tại và mốc so sánh.',tone:'wait'};
 const arrow=live.delta>0?'↑':live.delta<0?'↓':'↔',value=(live.pct>0?'+':'')+live.pct.toFixed(2)+'%';
 const suffix=`${live.partial?'*':''}${live.stale?' · CŨ':''}`;
 return {arrow,value,suffix,text:`${arrow} ${value}${suffix}`,tone:live.delta>0?'up':live.delta<0?'down':'flat',title:`ΔOI SPYUSDT: ${value}; ${live.delta>0?'OI tăng':live.delta<0?'OI giảm':'OI không đổi'}. ${live.partial?'* So với lúc bắt đầu theo dõi vì thiếu mốc đầu nến.':'So với mốc đầu nến M15.'}${live.stale?' Dữ liệu OI cũ.':''}${error?' Nguồn OI đang báo lỗi.':''} Không xác định Long/Short.`};
}
export class OiPercentColor {
 constructor(){this.reset();}
 reset(){this.direction=0;this.changed=-Infinity;this.key=null;this.pending=null;}
 update(live,{now,sampleTime,error=false}={}){
  if(!live?.ready||live.stale||error||![live.delta,now,sampleTime].every(Number.isFinite)){this.reset();return 'wait';}
  if(this.key!==live.t){this.reset();this.key=live.t;}
  const direction=Math.sign(live.delta),tone=()=>this.direction>0?'up':this.direction<0?'down':'wait';
  if(direction===this.direction){this.pending=null;return tone();}
  if(!this.pending||this.pending.direction!==direction)this.pending={direction,since:now,count:1,last:sampleTime};
  else if(sampleTime>this.pending.last){this.pending.last=sampleTime;this.pending.count++;}
  if(this.pending.count>=3&&now-this.pending.since>=9000&&now-this.changed>=15000){this.direction=direction;this.changed=now;this.pending=null;}
  return tone();
 }
}
