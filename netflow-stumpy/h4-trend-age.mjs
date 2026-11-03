const H4=4*3600000;
// The H4 strip repeats one box across up to four H1 cells. Count each box once.
export function continuousH4Age(states=[],now=Date.now()){
 const grouped=new Map();
 for(const s of states){
  if(!Number.isFinite(s?.blockStart)||!Number.isFinite(s?.t)||s.blockStart>now||![-1,0,1].includes(s.direction))continue;
  const group=grouped.get(s.blockStart)??new Map();group.set(s.t,s);grouped.set(s.blockStart,group);
 }
 const boxes=[];
 for(const [start,cells] of [...grouped].sort(([a],[b])=>a-b)){
  const rows=[...cells.values()].sort((a,b)=>a.t-b.t),s=rows.at(-1),preview=s.preview===true;
  if(rows.some(r=>r.direction!==s.direction||Boolean(r.preview)!==preview))continue;
  if(!preview&&(rows.length!==4||rows.some((r,i)=>r.t!==start+i*3600000)||start+H4>now))continue;
  boxes.push({start,end:start+H4,direction:s.direction,preview});
 }
 let ageH4=0,direction=0,from=null,lowerBound=false,previous=null;
 for(const box of boxes){
  const contiguous=previous&&box.start===previous.end;
  if(!box.direction){ageH4=0;direction=0;from=null;lowerBound=false;}
  else if(contiguous&&box.direction===direction){ageH4++;}
  else{ageH4=1;direction=box.direction;from=box.start;lowerBound=!previous||!contiguous;}
  previous=box;
 }
 const preview=previous?.preview===true;
 return {direction,ageH4,closedH4:Math.max(0,ageH4-(preview&&direction?1:0)),preview,from,asOf:previous?.start??null,lowerBound,delayed:Boolean(previous&&now>=previous.end+H4),boxes:boxes.length};
}
export function h4AgeReadout(age){
 if(!age?.boxes)return {text:'—',note:'Chờ hộp màu H4',title:'Tuổi trend đếm các hộp H4 liên tiếp cùng màu trên dải H4.'};
 const direction=age.direction>0?'UP':age.direction<0?'DOWN':'WAIT',prefix=age.lowerBound&&age.ageH4?'≥':'';
 return {text:`${direction} · ${prefix}${age.ageH4} H4${age.preview?' · PREVIEW':''}${age.delayed?' · DELAYED':''}`,note:`${age.closedH4} H4 đã khóa${age.preview?' + hộp đang hình thành':''} · liên tục 24/7`,title:'Tuổi trend tuần = số hộp H4 liên tiếp cùng màu trên dải H4: xanh UP, đỏ DOWN; WAIT đặt tuổi về 0. Đổi hướng bắt đầu từ 1. Không đặt lại khi sang ngày hoặc tuần; không nối qua dữ liệu thiếu. PREVIEW có thể đổi màu trước khi H4 đóng. Dấu ≥ khi chưa biết màu hộp ngay trước chuỗi. Đây là tuổi đã quan sát, không phải dự báo tuổi cuối từ Daily packet.'};
}
