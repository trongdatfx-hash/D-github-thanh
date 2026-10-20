// Update only the running candle while the causal history and display mode are unchanged.
export function createSeriesWriter(){
  const cache=new Map();
  return (name,series,data,context)=>{
    const key=`${context}|${data.length}|${data[0]?.time}|${data.at(-2)?.time}`;
    if(data.length&&cache.get(name)===key)series.update(data.at(-1));
    else{series.setData(data);cache.set(name,key);}
  };
}
