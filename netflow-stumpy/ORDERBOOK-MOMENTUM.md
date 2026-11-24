# Động lực orderbook Binance USD-M

Nhãn OB là phân tích trực tiếp, độc lập khung nến và lịch sử chart. Nó không thay đổi lệnh, điều kiện TK V2 hay màu nến. Không suy luận mở/đóng Long/Short từ sổ lệnh.

## Dữ liệu

- Tái sử dụng `BinanceDepthFeed`: snapshot 1.000 mức và diff depth 100 ms, kiểm tra cầu nối U/u và chuỗi pu. Endpoint `/public/ws/`.
- Thêm aggTrade qua `/market/ws/`, dùng cờ `m`: true là bán chủ động, false là mua chủ động. Tổng hợp `price * quantity` theo USDT.
- ID aggTrade trùng/bị lùi được bỏ; nhảy ID đặt lại cửa sổ. Mất kết nối, thay mã và quay lại tab cũng đặt lại.
- Chỉ luồng depth đã nối snapshot mới được dùng. REST fallback vẫn vẽ lệnh chờ, nhưng nhãn động lực ghi CHỈ CÓ LỆNH CHỜ.
- Depth quá 5 giây hoặc thời gian bản tin trade lệch quá 5 giây không được dùng kết luận. Nếu không có trade mới trong 15 giây, ghi CHỜ GIAO DỊCH. Đồng hồ thiết bị phải đúng giờ.

## Các phép đo

- Book: `(B - A) / (B + A)`, với B/A là tổng `price * quantity / (rank + 1)` của tối đa 20 mức gần nhất mỗi phía.
- Microprice: `(ask * bidQty + bid * askQty) / (bidQty + askQty)`; chênh so với mid theo bps.
- OFI theo thay đổi giá/khối lượng tại best bid/ask, chuẩn hóa bằng tổng độ sâu L1 của các lần cập nhật trong cửa sổ. Đây là OFI quote, khác delta giao dịch khớp.
- Delta giao dịch: mua chủ động trừ bán chủ động. % cửa sổ là delta chia tổng khớp, không phải xác suất thắng.
- Bổ sung thanh khoản chỉ tính tăng khối lượng tại cùng mức giá có trong hai ảnh liên tiếp; không gọi mức mới đi vào top 20 là bổ sung. Không khẳng định giảm độ sâu là hủy lệnh hay spoofing.

## Trạng thái thử nghiệm

Cửa sổ 5/15/60 giây dùng các bucket 1 giây đã kết thúc. Mỗi cửa sổ phải có đủ thời gian kết nối liên tục và quote trong ít nhất nửa số giây. Chỉ 62 bucket được lưu; không lưu từng trade. Quote được lấy mẫu tối đa 5 lần/giây; OFI và biến động độ sâu vẫn tính trên từng diff được chấp nhận.

- MUA ĐẨY GIÁ / BÁN ÉP GIÁ: ít nhất 5 trade, |delta/tổng khớp| >= 25%, giá đi cùng chiều >= 0,5 spread bình quân và có Book/OFI/microprice hỗ trợ.
- MUA/BÁN BỊ HẤP THỤ: lực chủ động >= 25%, giá ròng <= 0,25 spread, range <= 2 spread, ít nhất 5 mẫu quote, tổng khớp >= 15% độ sâu đối ứng có trọng số và thanh khoản đối ứng bổ sung >= 10% |delta|. Đây là giả thuyết dựa trên các luồng bất đồng bộ, chưa xác nhận iceberg hay ý định của người đặt lệnh.
- CHƯA RÕ khi thiếu đồng thuận; CHỜ GIAO DỊCH khi số khớp quá ít.

Nhãn chính ưu tiên 15 giây khi đủ, trước đó dùng 5 giây. 5 hoặc 60 giây đi ngược hướng đẩy giá làm kết luận CHƯA RÕ. Đổi nhãn cần cùng ứng viên ít nhất 2,5 giây và 4 lần kiểm tra, tối đa 2 lần/giây. Trạng thái lỗi xóa hướng ngay. Không dùng tỷ lệ này làm xác suất thắng.

## Giao diện và giới hạn

Nhãn nằm ngay trên nhóm CVD/tuổi H1, hoặc gần đáy pane giá khi nhóm đó ẩn. Bật/tắt ở OB ⚙ > Động lực mua/bán; tự ghi nhớ cùng cài đặt Order Book. Tắt Order Book sẽ dừng cả hai luồng. Trang ẩn sẽ ngắt luồng, mở lại phải tích lũy lại.

Mỗi mã chỉ phản ánh thị trường Binance USD-M tương ứng, không phải toàn thị trường SPY/QQQ hay ES. Tín hiệu có quy tắc cố định, chưa được hiệu chỉnh/xác thực lợi nhuận trên lịch sử depth thực của SPYUSDT/QQQUSDT. Không dựng lại lịch sử orderbook từ nến M15.

## Kiểm tra

`node --test netflow-stumpy/tests/orderbook.test.mjs netflow-stumpy/tests/orderbook-momentum.test.mjs`

## Tham khảo

- https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/How-to-manage-a-local-order-book-correctly
- https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/websocket-market-streams/Important-WebSocket-Change-Notice
- https://hftbacktest.readthedocs.io/en/latest/tutorials/Market%20Making%20with%20Alpha%20-%20Order%20Book%20Imbalance.html
- https://github.com/mamonet/orderbook-heatmap (ý tưởng giao diện/nhóm chỉ số; không dùng nguyên bộ dựng orderbook hoặc điểm LONG/SHORT)
