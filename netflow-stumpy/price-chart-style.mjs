export function priceCandleData(data,lineMode){
  if(!lineMode)return data;
  return data.map(row=>({...row,color:'transparent',borderColor:'transparent',wickColor:'transparent'}));
}
export function mountPriceChartStyle({chart,price,actions,host,L,writeSeries,onChange}){
  const select=document.createElement('select');select.id='price-chart-style';select.hidden=true;
  select.innerHTML='<option value="CANDLES">Nến</option><option value="LINE">Line</option>';
  const button=document.createElement('button');button.type='button';button.id='price-chart-style-button';
  button.textContent='Dạng giá: NẾN';
  button.title='Chuyển nến OHLC sang đường nối giá đóng cửa; giữ TPO, WLR và các chỉ báo';
  actions.append(select,button);
  const line=chart.addSeries(L.LineSeries,{color:'#62bcff',lineWidth:2,visible:false,priceLineVisible:true,lastValueVisible:true,crosshairMarkerVisible:true,title:''},0);
  const isLine=()=>select.value==='LINE';
  button.onclick=()=>{select.value=isLine()?'CANDLES':'LINE';onChange();};
  function update(bars,priceFormat,key){
    const active=isLine();
    // Keep OHLC alive as coordinate host of TPO/orderbook primitives.
    price.applyOptions({priceLineVisible:!active,lastValueVisible:!active});
    line.applyOptions({visible:active,priceFormat});
    writeSeries('price-close-line',line,active?bars.map(b=>({time:b.t/1000,value:b.c})):[],key+'|'+select.value);
    button.textContent=active?'Dạng giá: LINE':'Dạng giá: NẾN';button.setAttribute('aria-pressed',String(active));
    host.dataset.priceChartStyle=select.value;
    return active;
  }
  return {update,isLine,candleData:data=>priceCandleData(data,isLine())};
}
