# Màu và độ dày WLR theo hộp H1

Áp dụng trên SPYUSDT M15. Giữ nguyên giá trị đường WLR và cách chấm điểm H1 hiện có; thay cách hiển thị dốc/σ + khóa mềm bằng điểm và màu hộp H1. Không cộng lại OI, C Taker hoặc WLR như bằng chứng mới vì các thành phần đó đã nằm trong điểm.

| Trạng thái | Màu WLR | Độ dày khi bật |
| --- | --- | --- |
| Điểm cùng chiều hộp tăng/giảm | Xanh/đỏ; điểm 0 hoặc độ lớn 1 dùng sắc nhạt | 2 + độ lớn điểm, từ 2 đến 7 px |
| Điểm ngược chiều màu hộp | Vàng cam | 2 px |
| Hộp trung tính | Xám | 2 px |
| Điểm thiếu thành phần, sai metadata hoặc đã quá một H1 | Xám | 2 px |

Không thêm EWMA hay chờ thêm hai nến để đổi độ dày. Điểm ±5 là trọng số đồng thuận mô tả, không phải xác suất hoặc kiểm định khả năng dự báo.

## Thời gian và điểm tạm

Điểm khóa của H1 chỉ có hiệu lực tại hoặc sau `blockEnd + 1`, từ M15 kế tiếp. Không dùng điểm cuối hộp để tô lại bốn M15 đã tạo ra hộp đó. Mỗi điểm khóa chỉ được dùng trong một giờ tiếp theo; không kéo dài điểm cũ khi thiếu hộp mới. Thiếu dữ liệu không được biến thành điểm 0.

Điểm tạm đủ toàn bộ thành phần sau ba M15 đóng chỉ được dùng cho điểm WLR của nến M15 đang chạy sau timestamp `asOf`. Nét nhạt 55%, tối đa 3 px. Màu hộp tạm có thể chứa nến thứ tư đang hình thành nên không dùng nó: giữ hướng màu hộp khóa liền trước. Phần tạm có thể đổi và được thay bằng trạng thái khóa khi H1 đóng; không ghi thành lịch sử khóa hoặc dùng ngược cho ba M15 trước. Nếu không có hộp khóa liền trước, giữ xám mảnh.

`Độ dày WLR: Điểm H1` bật/tắt độ dày theo điểm; tắt dùng cố định 3 px. `Màu WLR theo H1` bật/tắt màu theo H1; tắt dùng màu C×V cũ. Các khung/mã khác giữ mô hình cũ. Dùng chung một lần lấy điểm từ ledger với đường Điểm H1 mượt; không phụ thuộc bật/tắt đường đó hoặc tô màu nến H1.

## Kiểm tra

`node --test netflow-stumpy/tests/wlr-h1-style.test.mjs netflow-stumpy/tests/wlr-h1-integration.test.mjs`

Kiểm tra timestamp hiệu lực, không dùng điểm tương lai cho tiền tố, đối xứng điểm âm/dương, xung đột, điểm thiếu/trễ, preview 3/4 chỉ trên phần đang chạy, giữ nguyên giá trị WLR và hoạt động riêng của hai nút bật/tắt.
