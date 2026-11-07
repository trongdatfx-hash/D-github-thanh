# Taker lớn theo giá — thử nghiệm v1

Trong Cài đặt chart, bật **Taker lớn P95 · THỬ** để thay dải CVD bằng phổ SPYUSDT riêng. Tắt để khôi phục dải CVD. Không thay đầu vào ma trận H1, điểm hộp, WLR hay OI. Không gộp QQQ.

- Nguồn: Binance USD-M `/fapi/v1/aggTrades`, mỗi 15 giây; tối đa 5 trang × 1.000 bản ghi/lượt. Khởi động lấy 1.000 aggTrade gần nhất, sau đó nối `fromId=lastId+1`. ID trùng bỏ qua, ID đứt ghi có khoảng trống. Không chặn luồng tải nến.
- Giá trị giao dịch = `p*q` USDT. `m=false` là buyer taker; `m=true` là seller taker. Đây là cụm khớp gộp, không xác định tài khoản hay toàn bộ lệnh mẹ.
- Đầu mỗi M15, khóa P95 nội suy tuyến tính từ tối đa 5.000 aggTrade trước đó trong 24h; chung ngưỡng hai chiều, tối thiểu 200 mẫu. Không đưa giao dịch M15 hiện tại vào nền của chính nó. M15 đầu sau mở lạnh thường chưa đủ nền.
- Chỉ các M15 đã đóng, không vượt timestamp đóng cuối của chart, trong ngày America/New_York hiện tại được vẽ. Vị trí giá `round(p/0.5)*0.5`, dùng giá khớp thực tế, không gán tại close nến. Chỉ hiển thị ±12 điểm quanh close cuối.
- Sell đỏ sang trái, Buy xanh sang phải, cùng tỷ lệ USDT, không triệt tiêu hai phía. Trỏ/chạm hàng giá xem Buy/Sell, số aggTrade lớn, Buy%. Từ 5 giao dịch lớn/bin mới hiện Buy%; đây là tỷ trọng quan sát, không phải xác suất dự báo.
- Phổ luôn ghi **MỘT PHẦN NGÀY** vì không thu trọn ngày từ đầu. Mất kết nối/không có giao dịch mới quá 120 giây ghi TRỄ/THIẾU, giữ phần đã thu. Lỗi API ghi rõ, không thay bằng dữ liệu giả. OI vẫn giữ phạm vi riêng và không được gọi là đồng timestamp với phổ này.
- Lưu localStorage theo SPYUSDT và phiên bản, có kiểm tra cấu trúc, hết hạn 24h. Không đồng bộ thiết bị; tab đóng không thu tiếp. Muốn phổ đầy đủ cần collector nền liên tục.

Minh họa trong chat dùng số liệu giả lập, không đưa vào chart.

Kiểm tra: `node --test netflow-stumpy/tests/large-taker-spectrum.test.mjs`
