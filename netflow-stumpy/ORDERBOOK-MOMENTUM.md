# Động lực orderbook — cửa sổ dài

Mặc định tổng kết 5 phút. OB ⚙ > Tổng kết động lực cho phép chọn 3, 5 hoặc 10 phút; lưu trên trình duyệt. Dữ liệu chưa đủ cửa sổ chọn sẽ dùng cửa sổ nhỏ hơn đã đủ (3 phút, 1 phút, 15 giây) và ghi TẠM trên nhãn. Không dựng lịch sử orderbook từ nến. Cửa sổ 5 giây chỉ phục vụ chẩn đoán.

## Ngưỡng hướng giá

| Cửa sổ | Giá ròng tối thiểu | Lệch khớp | Số bản tin khớp tối thiểu |
|---|---|---|---|
| 15/60 giây | 1,5 spread bình quân | 30% | 10 |
| 3 phút | 2 spread bình quân | 30% | 20 |
| 5 phút | 3 spread bình quân | 30% | 30 |
| 10 phút | 4 spread bình quân | 30% | 50 |

Giá phải đi cùng dấu delta. Xác nhận cần Book cùng hướng >=12%, hoặc OFI >=10%, hoặc đồng thời Book, OFI và microprice cùng hướng. Spread là ask tốt nhất trừ bid tốt nhất; giá ròng dùng mid đầu/cuối cửa sổ. Ngưỡng là quy tắc thử nghiệm, chưa xác nhận lợi nhuận.

Book dùng 20 mức mỗi bên, trọng số price*quantity/rank. Delta dùng notional USDT của aggTrade mua chủ động trừ bán chủ động; cờ m=true là bán chủ động. Lệch = delta/tổng khớp. OFI là biến động hàng chờ tại best bid/ask, chuẩn hóa theo độ sâu L1 các lần cập nhật. Microprice = (ask*bidQty+bid*askQty)/(bidQty+askQty).

Hấp thụ vẫn cần lực khớp >=30%, đủ số bản tin tương ứng cửa sổ, ít nhất 5 mẫu quote; |giá ròng| <=0,25 spread, range <=2 spread, tổng khớp >=15% độ sâu đối ứng có trọng số, bổ sung tại cùng mức giá >=10% |delta|. Đây là giả thuyết, không xác nhận iceberg/spoofing hay mở/đóng Long/Short.

## Làm ổn định và nhãn

Giữ nguyên xác nhận hướng mới 8s, đổi loại/hướng 15s và trạng thái cũ tối thiểu 20s trước khi đảo. Về CHƯA RÕ cần 20s. Lệch lớn có thể rút xác nhận còn 5s, vẫn cần điều kiện giá và thời gian giữ. Lệch lớn: >=20 khớp, lệch >=45%, |delta| >=50% độ sâu đối ứng và Book >=20% hoặc OFI >=15% cùng hướng.

Tiêu đề OB 5p/3p/10p + trạng thái. Hai dòng phụ chứa delta USDT, lệch %, Book %, cờ LỆCH LỚN. TẠM cho biết cửa sổ thực còn ngắn hơn lựa chọn. Cỡ chữ desktop 14/13px, mobile 13/12px. Khung cố định chiều rộng tối đa 370px và giới hạn theo màn hình; chữ xuống dòng, dành sẵn chiều cao dòng tổng kết.

Tổng kết hiển thị mỗi 5s; tỷ lệ EWMA có nửa đời 15s, làm tròn nấc 5 điểm %. Delta là tổng thực của cửa sổ. Tỷ lệ không phải xác suất thắng. Không sửa điều kiện TK V2.

## Đồng bộ và tài nguyên

Snapshot depth + U/u/pu theo Binance USD-M, depth 100ms qua /public/ws/, aggTrade qua /market/ws/. Giữ tối đa 602 bucket một giây, không lưu từng trade. Thời gian kết nối phải đủ cửa sổ và có quote trong ít nhất 3 bucket. Đứt chuỗi, reconnect, đổi mã hoặc tab trở lại sẽ tích lũy lại; không ghép qua khoảng mất dữ liệu.

Chu kỳ nối lại depth chủ động tăng từ 3 lên 20 phút để cửa sổ 5/10 phút có thể tích lũy. Watchdog mất bản tin, giá chéo và các kiểm tra chuỗi vẫn giữ. Chỉ dùng vùng giá đã được snapshot bao phủ. REST chỉ vẽ lệnh chờ, không kết luận động lực. Depth cũ quá 5s bỏ hướng; không trade trong 60s ghi CHỜ GIAO DỊCH.

## Kiểm tra

node --test netflow-stumpy/tests/orderbook.test.mjs netflow-stumpy/tests/orderbook-momentum.test.mjs netflow-stumpy/tests/orderbook-momentum-stability.test.mjs netflow-stumpy/tests/orderbook-momentum-ui.test.mjs netflow-stumpy/tests/orderbook-long.test.mjs
