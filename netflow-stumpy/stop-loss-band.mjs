export class StopLossBands{
  constructor(){this.zones=[];this.view={zOrder:()=> 'bottom',renderer:()=>({draw:target=>this.draw(target)})};}
  attached({chart,series,requestUpdate}){Object.assign(this,{chart,series,requestUpdate});}
  detached(){this.chart=null;this.series=null;this.requestUpdate=null;}
  updateAllViews(){}
  paneViews(){return [this.view];}
  setData(zones){this.zones=zones;this.requestUpdate?.();}
  draw(target){
    if(!this.chart||!this.series)return;
    target.useBitmapCoordinateSpace(({context,horizontalPixelRatio:rx,verticalPixelRatio:ry,bitmapSize})=>{
      for(const zone of this.zones){
        const top=this.series.priceToCoordinate(zone.high),bottom=this.series.priceToCoordinate(zone.low);
        const x=this.chart.timeScale().timeToCoordinate(zone.start/1000)??0;
        if(top===null||bottom===null)continue;
        context.fillStyle=zone.kind==='support'?'rgba(35,216,165,.16)':'rgba(255,110,130,.16)';
        context.fillRect(Math.max(0,x*rx),top*ry,bitmapSize.width-Math.max(0,x*rx),Math.max(1,(bottom-top)*ry));
      }
    });
  }
}
