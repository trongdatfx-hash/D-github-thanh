# TK V₂: thử bộ lọc trend khỏe, 20/11/2026

Bộ lọc tùy chọn, mặc định TẮT. Không có bằng chứng cải thiện ổn định để thay quy tắc gốc. Không xác thực lệnh ngày 19/11 vì archive dừng tại 00:00 UTC ngày 13/11 (07:00 VN).

Sau nến SPY V thân nến đổi dấu có mốc V₂ đầu, chờ tối đa thêm 3 nến đóng. Chỉ vào ở mở nến kế tiếp khi:

- Hai giá trị SPY V liên tiếp cùng dấu; độ lớn hiện tại ≥ 0,15 và không giảm.
- Giá đóng nằm thuận phía WLR-8 dự phóng và độ dốc thuận hướng ≥ 0,02 ATR14/nến.
- WLR dùng 8 nến trước; ATR14 cũng chỉ dùng nến trước. Bộ lọc này riêng với WLR dài trên chart.

Đổi dấu, mất dữ liệu hoặc hết hạn thì hủy setup. Mốc V₂ đầu vẫn là mốc ở nến đổi dấu. Không SL; giữ nguyên thoát đổi dấu, TP cùng pha sau đủ 4 M15 và nhánh chờ đổi dấu nếu mốc TP đến sớm. Tắt bộ lọc trả lại mô phỏng gốc.

## Kiểm tra lịch sử

Dữ liệu SPY/QQQ M15 archive tháng 10 và 11: 4.031 nến từ 01/10/2026 00:00 UTC đến trước 13/11/2026 00:00 UTC. Tái dựng H1 và SPY V thân nến theo module hiện tại, gồm thời gian khởi động. Chỉ lọc thời gian vào lệnh PRE–POST New York. Chi phí giả định 2 bps khứ hồi mỗi lệnh, một đơn vị, không trượt giá riêng. Chỉ tính lệnh đóng; lệnh đang mở không được đánh dấu thành thắng/thua.

| Khoảng theo thời điểm vào | Gốc: lệnh | Gốc: điểm ròng | Lọc: lệnh | Lọc: điểm ròng |
| --- | ---: | ---: | ---: | ---: |
| Toàn mẫu | 55 | -22,49 | 33 | -14,74 |
| Tháng 10 | 43 | -15,94 | 31 | -19,67 |
| Tháng 11 đến hết mẫu | 12 | -6,55 | 2 | +4,93 |

PF toàn mẫu gốc 0,50; lọc 0,56. SELL toàn mẫu: gốc 29 lệnh / -5,09 điểm; lọc 14 lệnh / -7,36 điểm. Vì vậy không được coi giảm tổng lỗ hoặc kết quả tốt hơn ở 2 lệnh tháng 11 là tối ưu SELL đã được chứng minh. Tháng 11 đã được xem khi nghiên cứu, không phải tập kiểm định độc lập chưa đụng tới.

Đã đối chiếu bộ lọc WLR dài, xác nhận SPY V riêng, và kết hợp. WLR dài bỏ lỡ nhiều nhịp; ghép thêm hiệu suất đường giá/tiến triển giá quá chặt khiến mẫu quá ít. Không quét tham số để làm đẹp riêng ngày 19. Không có kiểm định tiến về tương lai hoặc kết quả giao dịch thực.

Kết quả trong trình duyệt có thể khác bảng vì thời điểm bắt đầu, độ dài lịch sử khởi động, chế độ H1 và chi phí khác nhau. TK V₂ tính đối chiếu gốc/lọc trên cùng dữ liệu chart hiện tại và cùng chi phí, không dùng bảng này thay dữ liệu live.

Kiểm tra thực thi: 36 test về quy tắc cũ, BUY/SELL đối xứng, xác nhận nến đóng, hết hạn, ngược WLR, thiếu dữ liệu và tính bất biến khi thêm dữ liệu tương lai.
