const panel=document.getElementById('market-watchlist');
const host=panel?.querySelector('[data-market-watchlist-widget]');
let loaded=false;

const config={
  title:'Xem chỉ số',width:'100%',height:'100%',locale:'en',colorTheme:'dark',showSymbolLogo:true,
  symbolsGroups:[{name:'Xem chỉ số',symbols:[
    {name:'CBOE:VIX1D',displayName:'VIX1D'},
    {name:'CBOE:VIX9D',displayName:'VIX9D'},
    {name:'TVC:VIX',displayName:'VIX'},
    {name:'FOREXCOM:SPXUSD',displayName:'SP500'},
    {name:'AMEX:SPY',displayName:'SPY'},
    {name:'BINANCE:SPYUSDT.P',displayName:'SPYUSDT'},
    {name:'TVC:USOIL',displayName:'USOIL'},
    {name:'BINANCE:BTCUSDT',displayName:'BTCUSDT'},
    {name:'OANDA:XAUUSD',displayName:'XAUUSD'}
  ]}]
};

function loadWatchlist(){
  if(loaded||!host)return;loaded=true;
  const script=document.createElement('script');
  script.type='text/javascript';script.async=true;
  script.src='https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js';
  script.textContent=JSON.stringify(config);
  script.onerror=()=>{loaded=false;host.textContent='Không tải được báo giá TradingView. Có thể mở từng mã ở danh sách bên dưới.';host.classList.add('market-watchlist-error');};
  host.replaceChildren(script);
}

panel?.addEventListener('toggle',()=>{if(panel.open)loadWatchlist();});
if(panel?.open)loadWatchlist();
