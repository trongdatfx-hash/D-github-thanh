# Kiểm thử TK V2 bằng bộ máy web — 22/11/2026

Dữ liệu: kho SPYUSDT M15 trong repository, từ 2026-04-06T13:30:00.000Z đến 2026-11-13T00:00:00.000Z. Đây không phải kết quả TakeProfit và không bao gồm dữ liệu sau mốc cuối này.

Nguồn SPY V: thân nến, EWMA cố định như app.mjs. Giữ trend bật. Mỗi tháng quy theo thời gian vào lệnh tại Việt Nam; trạng thái chỉ báo được làm nóng từ lịch sử có sẵn trước tháng, không khởi tạo lại vào đầu tháng. Chỉ tính lệnh đã có giá mở nến thoát thực sự.

Chi phí 10 bps khứ hồi = 0,1% tổng hai chiều, tính theo giá vào/thoát trung bình cho 1 đơn vị. Chưa tính funding/trượt giá.

| Tháng | Lệnh gốc | Điểm chưa phí | Điểm sau 10 bps | Lệnh lọc trend | Điểm lọc trend sau 10 bps |
|---|---:|---:|---:|---:|---:|
| 2026-04 | 27 | -7.69 | -26.76 | 12 | -12.09 |
| 2026-05 | 43 | -9.73 | -41.68 | 28 | -34.60 |
| 2026-06 | 35 | -13.47 | -39.40 | 17 | -26.46 |
| 2026-07 | 31 | -5.63 | -28.79 | 21 | -12.01 |
| 2026-08 | 43 | -3.84 | -37.00 | 19 | -18.85 |
| 2026-09 | 36 | +4.28 | -23.28 | 22 | -6.71 |
| 2026-10 | 39 | -13.79 | -43.89 | 18 | -14.31 |
| 2026-11 | 8 | +18.09 | +12.13 | 3 | +16.33 |

Tổng dữ liệu: 21059 nến, 8 chỗ gián đoạn. Bản gốc có 2 vị thế thiếu dữ liệu được loại khỏi P&L, không tự tạo giá thoát; còn 1 vị thế mở tại cuối dữ liệu. Tháng 4 và tháng 11 là các tháng chưa đủ dữ liệu trọn tháng.

Kết luận giới hạn: các tháng trước tháng 11 chưa cho thấy lợi thế ổn định sau chi phí; bật lọc trend không bảo đảm cải thiện mọi tháng. Không đổi mặc định chiến lược dựa trên lần kiểm thử này. Lỗi chờ 506 nến của bản Indie TakeProfit không được coi là cùng hành vi với web: web đánh dấu gián đoạn/loại lệnh thiếu dữ liệu, không quản lý vị thế trên sàn.

Setup TK V2 được tự lưu trong cùng snapshot với setup chart. Nút Lưu setup vẫn lưu các lựa chọn chart và vùng đang xem; cập nhật TK V2 không xóa snapshot chart đã lưu. Lưu trên cùng trình duyệt/origin, không đồng bộ thiết bị.
