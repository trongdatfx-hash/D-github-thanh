# NetFlow ML — V1

Web độc lập, chỉ thêm `netflow-ml/`. Không sửa trang, mô hình hoặc workflow hiện có.

URL GitHub Pages: https://trongdatfx-hash.github.io/D-github-thanh/netflow-ml/

## Dữ liệu thật

API công khai `https://fapi.binance.com`: `exchangeInfo`, `time`, `klines`. Không cần API key. Validate mỗi lần tải: SPYUSDT / QQQUSDT, status TRADING, quoteAsset USDT, contractType PERPETUAL hoặc TRADIFI_PERPETUAL. `.P` chỉ là hậu tố hiển thị.

Xác nhận lúc 2026-10-08 khoảng 08:00 Asia/Saigon: cả hai là TRADING / TRADIFI_PERPETUAL. Metadata lưu trong `symbol-validation.json`. Fixture kiểm thử là 1000 nến M15 thật mỗi symbol được tải cùng thời điểm, có thể chứa nến chưa đóng; parser loại nến đó bằng thời gian server lưu trong `tests/fixtures/time.json`. Fixture chỉ dùng kiểm thử, không tự thay thế dữ liệu trực tiếp trong web.

- Volume = kline[5], Taker Buy = kline[9], Taker Sell = Volume − Buy.
- Taker NetFlow = 2 × Buy − Volume, đơn vị base asset của hợp đồng, không phải USD notional, không phải tiền vào/ra tài khoản hay open interest.
- 24h = tổng 96 nến M15 liên tục đã đóng (gồm nến hiện tại). Thiếu nến thì để trống, không kéo cửa sổ qua khoảng trống.
- Phân trang lịch sử 14/30/60 ngày, 1000 nến/request. Chỉ tính nến đã đóng theo `serverTime`; cập nhật mỗi 60 giây khi tab hiển thị. Không có websocket trong V1.

Ví dụ nến 2026-10-08 00:45 UTC: SPY volume 203.02, Buy 109.25, Sell 93.77, Net +15.48; QQQ volume 514.58, Buy 248.72, Sell 265.86, Net −17.14.

## Strength theo DVP

Nguồn đọc: `DVP_v2924_clean.pine` do người dùng cung cấp, SHA256 `a7ecae8c74ceb65bbd4aa9eff8d95fd4b4fa1d39bf7006df2a432c6e40e6d9ff`.

Port các dòng 155–168 và 1367–1380, tham số mặc định:

1. `voldH = NetFlow / SMA(volume,20)` khi SMA có sẵn và >0; trước đó fallback delta thô theo Pine.
2. `R = sum(voldH,8)`.
3. `Rs = EWMA(R)`, half-life 2; seed bằng R đầu tiên, alpha `1 − 2^(−1/2)`.
4. `sigmaHat = SMA(abs(Rs),500) × sqrt(pi/2)`.
5. `S = 2 × Phi(Rs / sigmaHat) − 1`. Phi dùng đúng xấp xỉ A&S của Pine, clamp z ±8.

S đầu tiên ở nến chỉ số 506 (507 nến gồm khởi động). Không có giá trị khi sigmaHat = 0. Mất nến M15 thì reset engine và khởi động lại; không tự gộp nến cách xa nhau.

Pine gốc lấy `vold` bằng `TradingView/ta/10.requestUpAndDownVolume`; web thay đầu vào bằng Taker NetFlow Binance theo yêu cầu. Công thức Strength được port, không tuyên bố kết quả bit-for-bit với chart TradingView. V1 không port các module khác của Pine như Flow-Leg, BVC, pane envelope hoặc ma trận SPY+QQQ.

## Hiệu chỉnh phiên đơn giản, không lookahead

Timezone `America/New_York`, tự đổi DST. Trên ngày thường: NIGHT 20:00–04:00, PRE 04:00–09:30, RTH 09:30–16:00, POST 16:00–20:00. Phiên gắn theo giờ mở nến. Cuối tuần tách WEEKEND, không hiệu chỉnh. Chưa có lịch nghỉ lễ / early close Mỹ.

Duy trì tối đa 500 **Strength có sẵn trước nến hiện tại** của mỗi phiên. Đòi ≥26 mẫu cho phiên nguồn và RTH. Với PRE/POST/NIGHT:

`S_adjusted = (S − mean_session) / sd_session × sd_RTH + mean_RTH`

RTH giữ `S_adjusted = S` khi đủ mẫu. Phép dịch trung bình có thể đổi dấu; đây chỉ là chuẩn hóa thống kê về phân phối RTH, không học dấu từ lợi nhuận tương lai. Không khẳng định dấu hiệu chỉnh dự báo giá tốt hơn dấu gốc. Phân phối phẳng hoặc thiếu mẫu: để trống, nến màu xám. Tính kết quả xong mới thêm mẫu hiện tại vào lịch sử. Filter RTH chỉ lọc hiển thị, tính toán vẫn chạy toàn bộ lịch sử 24h.

±2 sigma hiển thị quanh 0 trên thang Strength: `±2 × sd(S_RTH_past)`, population SD của tối đa 500 mẫu trước đó. Đây **khác sigmaHat của Rs bên trong DVP**. S hiệu chỉnh có thể vượt ±1, không còn là phân vị xác suất. Không clamp để che độ lớn. Đổi độ dài lịch sử tải có thể đổi seed/khởi động và thống kê ở đầu chuỗi.

## ML

`trained=false` luôn trong V1, không dùng lại model của `ai-engine/` để giả định đã train cho nhiệm vụ này. Chưa có dataset nhãn, model, walk-forward hoặc báo cáo chất lượng RTH của V1. Chỉ có phép hiệu chỉnh thống kê trên.

Trước khi bật ML cần: dataset liên tục có provenance của cả hai symbol; định nghĩa nhãn return/horizon chỉ trong RTH và hoàn tất trước khi dùng để train; đủ phiên độc lập (mục tiêu ban đầu ≥120 phiên train, ≥30 validation và ≥30 test); chia theo thời gian có purge/embargo theo horizon; kiểm định walk-forward so với Strength gốc và hiệu chỉnh V1 trên dữ liệu chưa dùng train, có chi phí giao dịch. Số nến tự nó không chứng minh dữ liệu đủ. V1 chưa có trainer và không tự bật ML theo số mẫu.

## Chạy và kiểm thử

Tại thư mục `netflow-ml/`, `node server.mjs`, mở http://127.0.0.1:8765. Hosting tĩnh bất kỳ hỗ trợ JavaScript modules cũng chạy được. Không mở bằng file://.

- `node --test tests/engine.test.mjs`: 9 kiểm thử về dữ liệu thật, symbol, DST, công thức Pine, không lookahead (sửa tương lai không đổi quá khứ), hiệu chỉnh không ăn mẫu hiện tại, khoảng trống, rolling 24h và phân trang.
- `node tests/browser.test.cjs`: cần Playwright + Edge. Kiểm tra SPY/QQQ, desktop/mobile, zoom, filter RTH, CSV, API 451 và không có lỗi JS. Browser test dùng fixture Binance đã ghi lại, không chứng minh mọi vùng truy cập live API thành công.

Giới hạn vận hành: API có thể bị chặn theo vùng, CORS, rate limit; web báo lỗi và giữ biểu đồ cũ có nhãn chưa cập nhật khi refresh thất bại. Đổi symbol sẽ xóa dữ liệu cũ. Không proxy, không snapshot fallback, không bịa dữ liệu. Live access tùy mạng của người xem.
