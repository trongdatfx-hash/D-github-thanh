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
        const rgb=zone.kind==='support'?'35,216,165':'255,110,130';
        context.fillStyle='rgba('+rgb+','+(zone.opacity??.16)+')';
        const left=Math.max(0,x*rx),width=bitmapSize.width-left,height=Math.max(1,(bottom-top)*ry);
        if(width<=0)continue;
        context.fillRect(left,top*ry,width,height);
        context.strokeStyle='rgba('+rgb+',.75)';context.lineWidth=(zone.borderWidth??1)*ry;
        context.strokeRect(left,top*ry,width,height);
        if(zone.boxes){context.font=(11*ry)+'px sans-serif';context.fillStyle='rgb('+rgb+')';context.fillText(zone.boxes+' H1 · Σ'+zone.points,Math.max(left+5*rx,bitmapSize.width-180*rx),Math.max(12*ry,top*ry-4*ry));}
      }
    });
  }
}
