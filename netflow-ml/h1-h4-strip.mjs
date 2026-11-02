const HOUR=3600000,QUARTER=900000;
// Only complete historical hours and the contiguous prefix of the current hour.
export function aggregateHourlyRows(rows=[],now=Date.now()){
  const groups=new Map(),unique=new Map(rows.map(row=>[row.t,row]));
  for(const row of unique.values()){
    if(!Number.isFinite(row.t)||row.t%QUARTER!==0)continue;
    const key=Math.floor(row.t/HOUR)*HOUR;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(row);
  }
  const result=[];
  for(const [key,group] of [...groups].sort(([a],[b])=>a-b)){
    group.sort((a,b)=>a.t-b.t);
    if(group[0].t!==key||group.some((row,i)=>row.t!==key+i*QUARTER))continue;
    const sourceComplete=group.length===4;
    if(!sourceComplete&&key!==Math.floor(now/HOUR)*HOUR)continue;
    const first=group[0],last=group.at(-1);
    result.push({...first,t:key,end:key+HOUR-1,sourceComplete,o:first.o,h:Math.max(...group.map(r=>r.h)),l:Math.min(...group.map(r=>r.l)),c:last.c});
  }
  return result;
}
// Use the actual chart candles inside the hour, never the next H1 across a gap.
export function h1StripCell(time,chartTimes,timeToCoordinate,barSpacing){
  let lo=0,hi=chartTimes.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(chartTimes[mid]<time)lo=mid+1;else hi=mid;}
  const centers=[];
  for(let i=lo;i<chartTimes.length&&chartTimes[i]<time+HOUR;i++){const x=timeToCoordinate(chartTimes[i]/1000);if(Number.isFinite(x))centers.push(x);}
  if(!centers.length)return null;
  const spacing=Math.max(1,Number(barSpacing)||6),left=Math.min(...centers)-spacing/2,right=Math.max(...centers)+spacing/2;
  return {x:left,width:Math.max(1,right-left-.7)};
}
