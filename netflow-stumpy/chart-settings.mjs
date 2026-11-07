export function mountChartSettings(controls,card){
  const head=card?.querySelector('.chart-head');if(!controls||!head)return null;
  const details=document.createElement('details');details.id='chart-settings';
  const summary=document.createElement('summary');summary.textContent='Cài đặt chart';
  const panel=document.createElement('div');panel.id='chart-settings-panel';panel.setAttribute('role','group');panel.setAttribute('aria-label','Cài đặt chart');
  controls.classList.add('chart-options');controls.setAttribute('aria-label','Tùy chọn biểu đồ');panel.append(controls);details.append(summary,panel);head.append(details);
  details.addEventListener('keydown',event=>{if(event.key==='Escape'&&details.open){event.stopPropagation();details.open=false;summary.focus();}});
  return details;
}
