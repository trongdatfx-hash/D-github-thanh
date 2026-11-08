# Màu và độ dày WLR theo hộp H1

Áp dụng trên SPYUSDT M15. Giữ nguyên giá trị đường WLR, điểm H1, ma trận và đường Điểm H1 mượt. Chỉ thay cách hiển thị màu và độ dày WLR.

| Trạng thái | Màu WLR | Độ dày khi bật |
| --- | --- | --- |
| Điểm cùng chiều hộp tăng/giảm | Xanh/đỏ; độ lớn 0–1 dùng sắc nhạt | 2 + độ lớn điểm, từ 2 đến 7 px |
| Điểm ngược chiều màu hộp | Vàng cam | 2 px |
| Hộp trung tính | Xám | 2 px |
| Điểm thiếu thành phần hoặc không có màu hộp khớp thời gian | Xám | 2 px |

Vàng cam là cảnh báo xung đột giữa dấu điểm và hướng màu hộp, vì vậy WLR có thể vàng dù hộp xanh hoặc đỏ. Không thêm EWMA và không tính các thành phần đã nằm trong điểm thành bằng chứng độc lập.

## Căn thời gian của phần hiển thị

App gọi `wlrH1Styles(...,{alignment:'box',boxStates:h1CandleMap})`. Khi H1 đã đóng và điểm đủ dữ liệu, đoạn WLR của bốn M15 thuộc chính hộp đó được tô theo điểm đó. Không đẩy màu và độ dày sang H1 kế tiếp.

Đây là lớp hiển thị lịch sử hoàn chỉnh sau khi H1 đóng: điểm của cả hộp chưa tồn tại tại lúc hộp mở. Mỗi điểm có `knownAt`, `blockStart`, `historical` và `alignment` để phân biệt thời gian biết điểm với thời gian vẽ. Không dùng lớp tô lịch sử này để đánh giá tín hiệu hoặc dự báo tại đầu hộp. Đường Điểm H1 mượt và ma trận vẫn giữ timeline riêng, không bị thay đổi.

Màu tham chiếu lấy đúng state của nến/hộp đang hiển thị. Nếu ledger còn lưu hướng màu cũ, chỉ màu tham chiếu được đối chiếu lại; điểm và các thành phần đã khóa không bị tính lại. Tooltip ghi giờ hộp theo Việt Nam để đối chiếu.

Điểm tạm đủ toàn bộ thành phần sau ba M15 đóng chỉ tác động điểm WLR đang chạy sau `asOf`; nét nhạt 55%, tối đa 3 px, theo màu hộp hiện đang xem trước. Màu preview và điểm này có thể đổi cho tới lúc khóa, không được lưu thành điểm khóa và không tô ngược cho ba M15 trước. Trước ba M15 đóng, chưa có điểm hộp hiện tại thì giữ xám mảnh.

Mỗi đoạn nét nối hai nến được chia ở trung điểm như ranh giới ô H1: cả màu lẫn độ dày của mỗi nửa thuộc đúng nến của nó. Đổi độ dày không làm nửa đoạn của hộp trước nhận độ dày hộp sau.

## Chế độ khả dụng theo thời gian

Hàm thuần vẫn mặc định `alignment:'available'`: điểm khóa chỉ có hiệu lực từ `blockEnd+1` và hết hạn sau một H1. Chế độ này giữ nguyên quy tắc causal trước đây; lớp WLR trong app chủ động dùng chế độ căn hộp để phục vụ đối chiếu hình ảnh.

`Độ dày WLR: Điểm H1` tắt thì dùng cố định 3 px. `Màu WLR theo H1` tắt thì dùng màu C×V cũ. Các khung/mã khác giữ mô hình cũ.

## Kiểm tra

`node --test netflow-stumpy/tests/wlr-h1-style.test.mjs netflow-stumpy/tests/wlr-h1-integration.test.mjs netflow-stumpy/tests/wlr-color-segments.test.mjs`

Kiểm tra cả timeline causal và timeline hiển thị, đúng bốn M15 của hộp, không lấy điểm hộp trước, thiếu dữ liệu, preview 3/4, màu state khác ledger, ranh giới trùng dải H1, renderer thực tế chia cả màu và độ dày, giữ nguyên giá trị WLR và các nút bật/tắt.

