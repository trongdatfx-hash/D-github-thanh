// Draw in the chart's own pane paint. No independent canvas or delayed RAF:
// horizontal/vertical zoom, dragging and pane resizing use the same coordinates.
export class SpectrumPrimitive {
  constructor(draw){
    this.paint=draw;
    this.view={zOrder:()=> 'top',renderer:()=>({draw:target=>target.useMediaCoordinateSpace(scope=>{
      scope.context.save();
      try{this.paint(scope);}finally{scope.context.restore();}
    })})};
  }
  attached({requestUpdate}){this.requestUpdate=requestUpdate;}
  detached(){this.requestUpdate=null;}
  updateAllViews(){}
  paneViews(){return [this.view];}
  redraw(){this.requestUpdate?.();}
}
