// Paint only the OHLC body on the price series' own pane and scale.
// A primitive follows chart zoom, pane resizing and price-axis dragging.
export function oiBodyWidth(spacing){
  if(!Number.isFinite(spacing)||spacing<2)return 0;
  return Math.min(spacing*.94,Math.max(1,spacing*.65)*1.5);
}
export class OiBoldCandles {
  constructor(){
    this.data=[];
    this.view={zOrder:()=> 'normal',renderer:()=>({draw:target=>this.draw(target)})};
  }
  attached({chart,series,requestUpdate}){this.chart=chart;this.series=series;this.requestUpdate=requestUpdate;}
  detached(){this.chart=null;this.series=null;this.requestUpdate=null;}
  updateAllViews(){}
  paneViews(){return [this.view];}
  setData(data){this.data=data;this.requestUpdate?.();}
  draw(target){
    if(!this.chart||!this.series||!this.data.length)return;
    const ts=this.chart.timeScale(),width=oiBodyWidth(ts.options().barSpacing);
    if(!width)return;
    target.useBitmapCoordinateSpace(({context,horizontalPixelRatio:rx,verticalPixelRatio:ry,bitmapSize})=>{
      context.save();
      for(const row of this.data){
        const x=ts.timeToCoordinate(row.time),open=this.series.priceToCoordinate(row.open),close=this.series.priceToCoordinate(row.close);
        if(x===null||open===null||close===null||x*rx<0||x*rx>bitmapSize.width)continue;
        const left=Math.round((x-width/2)*rx),right=Math.round((x+width/2)*rx),top=Math.round(Math.min(open,close)*ry),bottom=Math.round(Math.max(open,close)*ry);
        context.fillStyle=row.color;context.fillRect(left,top,Math.max(1,right-left),Math.max(1,bottom-top));
      }
      context.restore();
    });
  }
}
