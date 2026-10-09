# NetFlow RTH Lite · V1

Trang độc lập: https://trongdatfx-hash.github.io/D-github-thanh/netflow-rth-lite/
Chỉ thêm thư mục này; không sửa các trang/workflow hiện có. Chạy qua hosting HTTP tĩnh (ES modules), không mở file://.

## Dữ liệu

Binance USDⓈ-M Futures public API: `/fapi/v1/exchangeInfo`, `/fapi/v1/time`, `/fapi/v1/klines`. Xác minh thực tế 2026-10-08: SPYUSDT và QQQUSDT là TRADING / TRADIFI_PERPETUAL / USDT (metadata lưu `symbol-validation.json`). Web vẫn xác minh lại mỗi lần tải, không dùng metadata để thay dữ liệu trực tiếp. Không phải Binance Spot hay dữ liệu giao dịch ETF trên sàn Mỹ.

M5/M15/M30/H1; lịch sử 7/14/30 ngày, phân trang 1000 nến/request. Chỉ chấp nhận nến đã đóng theo thời gian server. Poll 60 giây khi tab hiển thị; yêu cầu timeout 20 giây; không websocket. API lỗi có thể do CORS, hạn chế vùng, HTTP 451/429/418, symbol mất trạng thái hoặc mất mạng. Refresh lỗi giữ dữ liệu cũ kèm thông báo; đổi timeframe/lịch sử xóa dữ liệu cũ. Không có fake data, snapshot fallback, proxy hay đổi symbol ngầm.

BuyQ = kline[10] (taker buy quote asset volume). Quote volume Q = kline[7]. SellQ = Q − BuyQ. NetFlowQ = 2×BuyQ − Q. NF% = 100×NetFlowQ/Q; Q=0 thì NF% để trống.

SPY/QQQ tính riêng; composite chỉ lấy timestamp giao nhau, cộng Q/BuyQ/SellQ/NetFlowQ rồi NF% = 100×ΣNetFlowQ/ΣQ. Tương đương quote-volume weighted NF%; không trung bình đơn giản và không có OHLC composite. Pane giữa hiển thị Taker NetFlowQ của SPY/QQQ/composite dưới dạng nến cột quanh mốc 0: xanh khi BuyQ > SellQ, đỏ khi SellQ > BuyQ. Nhãn được rút gọn thành S/Q/C Taker NF; nhãn số và trục pane dùng K USDT, trong khi tooltip và CSV giữ số USDT đầy đủ. Ba nguồn dùng độ trong suốt khác nhau khi chồng lên nhau; có thể bật/tắt riêng. NF% vẫn có trong tooltip và CSV. Dropdown giá chọn symbol nến riêng. Dropdown nguồn Strength chọn nguồn tô màu nến và pane Strength, kể cả composite.

Pane Taker NetFlow giữ nguyên dải đồng thuận SPY↔QQQ ở phần đáy trên một scale riêng: `+1` xanh khi cả hai NetFlowQ dương, `−1` đỏ khi cả hai âm; `+0.45` cam khi SPY dương/QQQ âm, `−0.45` cam khi SPY âm/QQQ dương. Độ đậm vẫn tăng theo `min(|SPY NF%|, |QQQ NF%|)`, bão hòa tại 50%. Một histogram Relative riêng dùng `(F_SPY − F_QQQ)/2`, trong đó mỗi `F` là EWMA NF% causal với half-life 2: cam phía trên khi SPY mạnh hơn, tím phía dưới khi QQQ mạnh hơn; độ đậm dựa trên phân vị quote volume quá khứ của nguồn yếu hơn. Tooltip tách Common NF% quote-volume weighted, Relative, trạng thái chi tiết chín mức và mức đối nghịch. Các đại lượng chỉ dùng timestamp chung và dữ liệu hiện tại/quá khứ; chúng mô tả đồng thời, không phải tín hiệu dự báo.

Pane giá có **CVD∞ gương** học theo cấu trúc Continuous/Mirror trong `GEX_ODTE_v15_0i.pine`: với mã giá đang chọn, mọi nến Binance đã đóng trong lịch sử đang tải cộng `NetFlowQ` vào `round(close/0.5)`, không reset theo phiên. Lịch sử mặc định là mức tối đa 30 ngày để CVD∞ có mẫu tích lũy dài nhất trong giao diện. Chỉ các bin trong ±12 điểm quanh giá cuối được lấy, EMA span 2 chạy từ bin giá thấp lên cao, rồi tự chuẩn hóa theo `max(|CVD bin|)`. Mỗi whisker xuất phát từ trục zero: delta mua màu xanh bung sang phải, delta bán màu cam bung sang trái. Đây là taker delta phân bố theo giá, không phải OFI đầy đủ và không phải CVD tuần tự theo thời gian. Toggle CVD∞ gương bật mặc định.

## Strength & phiên

Strength dùng cùng chuỗi làm mượt đã port trên trang `netflow-ml`: `voldH = NetFlowQ / SMA(quote volume,20)`; `R = sum(voldH,8)`; `Rs = EWMA(R)` với half-life 2 nến và alpha `1−2^(−1/2)`; `sigmaHat = SMA(abs(Rs),500) × sqrt(pi/2)`; `S = 2 × Phi(Rs/sigmaHat) − 1`. Trước khi SMA20 có đủ mẫu, dùng NetFlowQ thô như logic của bản port. Phi dùng xấp xỉ A&S và clamp z ±8. Khác biệt với Pine gốc: đầu vào ở đây là Binance Taker NetFlowQ theo quote volume, không phải `requestUpAndDownVolume` của TradingView. Đổi timeframe làm đổi thời gian làm mượt thực tế; cần ít nhất 507 nến liên tục mới có Strength đầu tiên, nên H1 cần tải 30 ngày.

Timezone America/New_York tự đổi DST. Ngày thường: NIGHT 20:00–04:00, PRE 04:00–09:30, RTH 09:30–16:00, POST 16:00–20:00. Weekend tách riêng không hiệu chỉnh. Chưa có holiday/early close calendar. Nhãn theo giờ mở nến; M30/H1 đi qua ranh giới phiên không tách volume.

Tối đa 500 mẫu raw Strength quá khứ mỗi phiên, tối thiểu 26 mẫu nguồn và RTH. PRE/POST/NIGHT: adjusted = (raw−mean_source)/sd_source×sd_RTH+mean_RTH. RTH giữ raw sau khi đủ mẫu. Không thêm mẫu hiện tại trước khi hiệu chỉnh. Phân phối phẳng/thiếu mẫu để trống, nến xám. Gap reset toàn bộ chuỗi Strength, thống kê phiên và hồi quy. Hiệu chỉnh có thể đổi dấu, không khẳng định dự báo giá tốt hơn.

OLS trên 50 adjusted Strength hợp lệ liên tiếp trước nến hiện tại; dự báo tại chỉ số 50; residual sigma = sqrt(SSE/(50−2)); biên prediction center ±2 sigma. Không dùng nến hiện tại hoặc tương lai để fit, không vẽ hồi quy fit cả đoạn ngược về quá khứ. Strength, hồi quy và biên nằm ở pane Strength riêng dưới cùng như bố cục ban đầu. Biên không phải biên giá hoặc khoảng tin cậy 95%. Không có hồi quy khi chuỗi hiệu chỉnh chưa đủ liên tiếp.

Pane nến dùng **WLR giá 50** màu vàng với trọng số thời gian `1..50` và biên xanh ±2 weighted residual sigma. Mức đối nghịch `O = min(1, sqrt(max(0, −F_SPY × F_QQQ))/50)` bằng 0 khi hai dòng tiền mượt cùng dấu và tăng khi cả hai trái dấu với cường độ lớn. Một custom series duy nhất vẽ trực tiếp đường WLR với độ dày liên tục `1 + 8 × O^0.7` px; không có các series nét chồng lên nhau. Nút Độ dày khi nghịch bật/tắt riêng; tooltip hiển thị mức đối nghịch và độ dày. WLR vẫn chỉ dùng giá quá khứ, nên dòng tiền không làm lệch đường hồi quy.

Nến giá dùng gradient theo adjusted Strength của nguồn đang chọn. Khi Strength gần 0, màu gần xám; `|Strength|` càng tiến đến 1, màu càng bão hòa về xanh (`Strength > 0`) hoặc đỏ (`Strength < 0`). Độ đủ mẫu chỉ điều chỉnh nhẹ cường độ để tín hiệu 26 mẫu vẫn nhìn rõ; đây không phải xác suất thắng. Chưa đủ hiệu chỉnh thì nến xám. Pane Strength dùng đường xanh khi dương, đỏ khi âm và đường 0 sáng, liền nét. Cụm huy hiệu bên phải pane hiển thị adjusted Strength hợp lệ mới nhất: SPY và QQQ có nhãn, Composite chỉ hiện số; cả ba xanh khi dương và đỏ khi âm. Các series hồi quy/±2σ không đặt nhãn để tránh che pane trên màn hình nhỏ. Chấm tròn xanh trên đường đánh dấu từng nến có adjusted Strength > 0.95 và tự ẩn khi tắt Strength.

## Chart & kiểm định

TradingView Lightweight Charts 5.0.9 được lưu cục bộ, Apache 2.0, giữ NOTICE/LICENSE và attribution. Ba pane đồng bộ: candlestick giá cùng CVD∞ gương; Taker NetFlowQ SPY/QQQ/composite cùng Relative Flow và dải đồng thuận giữ nguyên; adjusted Strength + OLS ±2σ. Thiết lập mở trang mặc định chỉ hiện Composite trong ba histogram NetFlow, ẩn SPY, QQQ và Relative; dải SPY↔QQQ, WLR, độ dày khi nghịch, CVD∞, Strength, hồi quy và marker vẫn bật. Wheel/pinch zoom, drag pan, normal crosshair xuyên pane, tooltip OHLC cùng quote flows và trạng thái đồng thuận, fit + auto scale từng trục, toggle từng nguồn/Relative/alignment/CVD∞/Strength/bands/day-RTH markers, responsive mobile. Nút **Full chart** mở riêng card biểu đồ bằng Fullscreen API; nếu trình duyệt mobile không hỗ trợ thì dùng lớp phủ `100dvh`. Trong chế độ này chart tự chiếm phần còn lại của màn hình, toggle cuộn ngang, tooltip giới hạn chiều cao và có nút Fit/Thu nhỏ ngay trong card. CSV xuất nguồn Strength đang chọn, toàn lịch sử đã tải. Marker RTH là nến đầu có nhãn RTH, nên H1 không thể đánh dấu chính xác 09:30.

Góc dưới phải chart có trạng thái kết nối: **LIVE** màu xanh sau lần tải Binance thành công; **KHÔNG LIVE** màu đỏ khi API/CORS/mạng lỗi, chưa kết nối hoặc lần cập nhật gần nhất đã quá 150 giây.

`node --test tests/engine.test.mjs` dùng fixture Binance thật từ `../netflow-ml/tests/fixtures/` chỉ để kiểm thử. Kiểm tra quote fields, composite, causal prefix/future mutation, chuỗi làm mượt DVP, regression, gaps, zero volume, DST, symbol validation, pagination. `tests/browser.test.cjs` kiểm chart desktop/mobile/fullscreen và trường hợp API bị chặn; chạy với NODE_PATH trỏ runtime có Playwright.

## ML tương lai

`modelStatus.trained=false`. V1 chưa có dataset nhãn, training hay backtest cho chiến lược này. `engine.mjs` tách khỏi UI/data để thay adapter bằng model có version sau khi có provenance dữ liệu, nhãn RTH, train/validation/test theo thời gian có purge/embargo, walk-forward ngoài mẫu và chi phí giao dịch. Không tự bật ML theo số nến. Hướng dẫn Binance: https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Kline-Candlestick-Data ; chart: https://tradingview.github.io/lightweight-charts/docs/5.0/ .
