export function tpoRenderMode(cellWidth,rowHeight){return cellWidth>=7&&rowHeight>=12?'letters':cellWidth>=3&&rowHeight>=3?'cells':'compact';}
export function compactTpoRows(rows,yOf){
  const pixels=new Map();
  for(const row of rows){
    if(!row.blocks.length)continue;
    const top=yOf(row.high),bottom=yOf(row.low);
    if(!Number.isFinite(top)||!Number.isFinite(bottom))continue;
    const y=Math.floor(Math.min(top,bottom)),height=Math.max(1,Math.abs(bottom-top));
    const mean=row.blocks.reduce((a,b)=>a+b,0)/row.blocks.length,old=pixels.get(y);
    if(!old||row.blocks.length>old.count)pixels.set(y,{y,height,count:row.blocks.length,mean,indices:[...(old?.indices??[]),row.index]});
    else old.indices.push(row.index);
  }
  return [...pixels.values()];
}
