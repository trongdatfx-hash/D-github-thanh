# Trạng thái trend từ ma trận — nền không OI

Thay hoàn toàn dự báo tuổi trend cũ trên chart chính SPY M15. Gỡ import/call Kaplan–Meier, cohort tuổi, preview tuổi và nút tô nến theo dự báo tuổi khỏi app/worker; không còn xác suất hoặc số nến còn lại của bản cũ. Các trang khác có thể còn dùng module tương thích cũ, nên không xóa file dùng chung gây lỗi trang đó.

## Điểm nền

Tính lại từ `parts.position + parts.slope + parts.randomWalk + parts.deltaNF`, mỗi phần −1/0/+1, tổng −4…+4. Không dùng điểm tổng ±5, OI hay bonus RW thuận WLR/H1. Đây là điểm riêng; không so trực tiếp với histogram điểm hộp ±5 hiện có. Chấp nhận hộp thiếu OI nếu đủ cả bốn thành phần nền. Thiếu thành phần nền là thiếu dữ liệu, không điền 0.

Chỉ hộp đủ 4 M15 đóng, đúng `asOf=blockEnd+1≤now`. Hộp 3/4 và điểm vẽ lại trong lịch sử WLR không làm bằng chứng sớm. Nhóm đọc dùng số hộp/nhóm trong cài đặt ma trận (2/3/4); nhóm trước cùng kích thước làm tham chiếu.

## Trạng thái

- Hướng nền: ít nhất 2/3 hộp đóng cùng phía WLR; có ít nhất một dốc cùng hướng và không có dốc ngược.
- Xung đột: ít nhất 2/3 ΔV×C Taker nghịch hướng nền.
- Suy yếu: điểm giảm lực trong hai bước của nhóm (một bước với nhóm 2), giảm tổng ít nhất 2 điểm; hoặc số hộp dòng tiền hỗ trợ giảm so với nhóm trước cùng hướng.
- Được ủng hộ: có hướng nền, ít nhất 2/3 dòng tiền hỗ trợ, chưa có suy yếu/xung đột.
- Chuyển tiếp: dữ liệu đủ nhưng cấu trúc chưa đồng thuận.
- Phá biên: hai M15 đóng liên tiếp ngoài cùng mép vùng high/low của nhóm H1 liền trước, vùng đã tồn tại trước nhóm đang xét. Không thêm điều kiện OI/C Taker. Giá trở vào vùng thì bỏ trạng thái phá; chưa chứng minh trend kết thúc vĩnh viễn hay đảo chiều.

OI là dòng nhận xét riêng theo nhóm hiện tại: hỗ trợ, xung đột, chưa đồng thuận hoặc thiếu. Đổi OI không thay điểm nền, hướng nền hoặc trạng thái. Không suy ra Long/Short từ OI. Không dùng 9 ngày OI để học xác suất/tuổi.

## Thời gian còn lại

Hiện chỉ phát trạng thái mô tả. `remainingH1` và `probability` là null, `forecastStatus=CHUA_DU_MAU`; UI không in thời gian hoặc xác suất khi chưa có kiểm định ngoài mẫu. Không coi các nhóm hộp chồng lấn là mẫu độc lập. Muốn mở dự báo thời gian cần thu thập snapshot/outcome đúng thời điểm và đánh giá theo các đoạn thời gian tách biệt trước; bản này không tuyên bố cải thiện lợi nhuận/độ chính xác.

## H1 và tuần

Giữ nhãn Hộp H1 (đếm màu), điểm hộp, ma trận hiện có, line SPY V, line C Taker và các ô ngày trong tuần. Bỏ phụ thuộc tuổi/xác suất cũ khỏi đầu vào màu H1 và các ô ngày; hướng tham chiếu thay bằng hướng kênh đã xác nhận tại timestamp của từng điểm, không có xác suất. Cache màu đổi version để không phục hồi snapshot của thuật toán cũ. Điều này có thể thay đổi màu/độ đậm H1 so với bản cũ. Không ép các ô mô tả ngày thành xác suất dự báo.

## Kiểm tra

`node --test netflow-stumpy/tests/matrix-trend-status.test.mjs netflow-stumpy/tests/matrix-trend-runtime.test.mjs netflow-stumpy/tests/h1-color-cache.test.mjs netflow-stumpy/tests/matrix-geometry.test.mjs`
