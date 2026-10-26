function samePoint(a,b){
 if(!a||!b)return a===b;
 const keys=Object.keys(a);
 return keys.length===Object.keys(b).length&&keys.every(key=>Object.is(a[key],b[key]));
}
// Skip identical writes. Update a changed tail, but replace corrected history.
export function createSeriesWriter(){
 const cache=new Map();
 return (name,series,data,context)=>{
  const previous=cache.get(name),old=previous?.data;
  if(previous?.series===series&&previous.context===context&&old?.length&&data.length>=old.length&&data[0]?.time===old[0]?.time){
   let first=0;while(first<old.length&&samePoint(old[first],data[first]))first++;
   if(first>=old.length-1){
    for(let i=first;i<data.length;i++)series.update(data[i]);
    cache.set(name,{series,context,data});return;
   }
  }else if(previous?.series===series&&previous.context===context&&!old.length&&!data.length)return;
  series.setData(data);cache.set(name,{series,context,data});
 };
}
