# Phổ taker theo giá — phân vị P61/P85/P90/P95

- Chọn **Taker ≥ P61/P85/P90/P95** trong Cài đặt chart. Mặc định **P90**, rộng hơn P95 cũ; P61 là mức lọc rộng nhất. Cả bốn mức dùng cùng nguồn SPYUSDT và cùng baseline, không tự nội suy thêm giao dịch để làm dày phổ.
- Dùng giá khớp × lượng `aggTrade`; buyer maker = seller taker. Ngưỡng mỗi phân vị khóa tại đầu M15 từ tối đa 5.000 giao dịch thu trước đó trong 24h, tối thiểu 200 mẫu; cùng ngưỡng hai phía. Mỗi M15 lưu đồng thời bốn tier nên có thể đổi mức mà không xóa số liệu đã thu trong phiên v2.
- Mở lạnh nạp lùi một giờ qua REST rồi theo `fromId`, tối đa 5 trang/lượt, mỗi 15 giây. Nếu giờ hiện tại không có giao dịch, thử dữ liệu gần nhất. Cache v2 tách cache P95 cũ; không thể biến những phần P95 đã tổng hợp trước đây thành P61/P90 vì không có giao dịch gốc.
- Chỉ M15 đã đóng và không vượt timestamp đóng cuối của chart. Gom giá thực tế vào bin 0,5 điểm. Buy xanh bên phải, Sell đỏ bên trái; chọn phân vị chỉ lọc dữ liệu, không thay cách tính volume hay OI.
- Nếu ngày NY hiện tại chưa có mẫu đóng nhưng còn mẫu ngày gần nhất, hiển thị ngày đó kèm CŨ/THIẾU. Không gọi dữ liệu này là LIVE. Phổ luôn là phần đã thu, không tự nhận trọn ngày. Từ 5 giao dịch lớn/bin mới hiện Buy%; đây là tỷ trọng quan sát.
- P61 thường giữ nhiều mẫu hơn P95; số thực tế phụ thuộc phân phối giá trị giao dịch và các giá trị bằng ngưỡng. Không xác định được tài khoản hay lệnh mẹ.

Kiểm tra: `node --test netflow-stumpy/tests/large-taker-spectrum.test.mjs`
