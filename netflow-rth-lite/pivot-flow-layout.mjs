// The histogram sits next to the SPY price axis. Its column width follows
// the chart's current candle spacing, including user zoom and mobile zoom.
export function pivotFlowLayout(barSpacing,binCount,availableWidth){
  if(!Number.isFinite(barSpacing)||barSpacing<=0||!Number.isInteger(binCount)||binCount<1||!Number.isFinite(availableWidth)||availableWidth<=0)return null;
  const barWidth=2*barSpacing,gap=2,padding=12;
  const shownCount=Math.min(binCount,Math.floor((availableWidth-padding+gap)/(barWidth+gap)));
  if(shownCount<1)return null;
  return {barWidth,barSpacing,gap,shownCount,panelWidth:padding+shownCount*barWidth+(shownCount-1)*gap};
}
