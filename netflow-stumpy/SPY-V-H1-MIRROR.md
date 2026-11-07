# SPY V gương · điểm H1 — thử nghiệm

- Nút **SPY V gương H1: BẬT/TẮT** nằm cạnh SPY V mượt H1 trong Cài đặt chart. Bật mặc định, lưu cùng cấu hình chart. Chỉ hiển thị trên SPYUSDT M15, trong pane SPY V (pane 1), cùng thang và cùng tâm 0.
- Nguồn luôn là `volumeStrengthRows` — SPY V gốc từ `calculateVolumeStrength`, không lấy `displayVolumeStrengthRows` đã bật làm mượt theo màu H1. Nút SPY V mượt H1 không thay đầu vào đường mới.
- Lấy điểm từ cùng ledger `scoreH1Box` của biểu đồ, tối đa 512 hộp đã khóa. Chỉ `LOCKED`, đủ 4 M15 đóng, không thiếu thành phần, điểm nguyên trong −5…+5. Preview 3/4 không tham gia.
- Với mỗi M15 tại t, chỉ dùng điểm H1 đã khóa **trước hoặc đúng giờ mở t**, còn mới trong một giờ. Như vậy điểm của một hộp không làm thay đổi đường gương trong chính hộp đã tạo ra điểm đó. Thiếu điểm hợp lệ dùng trọng số 1 và `h1Score=null`, không điền điểm 0 giả.
- Trọng số `w=1+abs(score)` (1–6). EWMA có trọng số: `N(t)=d*N(t−1)+w*Vgoc(t)`, `D(t)=d*D(t−1)+w`, `S(t)=N(t)/D(t)`, `d=2^(-1/2)` (half-life 2 M15). Gương qua mốc 0: `Mirror(t)=−S(t)`. Điểm âm cũng dùng trọng số dương; dấu điểm không đảo dữ liệu thêm lần nữa.
- Nến đang chạy có điểm gương xem trước từ SPY V hiện tại và trọng số H1 đã biết. Điểm nguồn thiếu hoặc khoảng trống thời gian khởi động lại bộ làm trơn. Nét solid 1px, `rgba(210,194,174,.55)`, không nhãn giá, không tô nền và không chiếm pane mới.
- Bộ nhớ đệm điểm chỉ được làm mới khi nến đóng, nguồn điểm hoặc dữ liệu OI thay đổi. Đường chỉ để so sánh thị giác; không đưa vào WLR, màu nến, ma trận, điểm H1 hay xác nhận breakout. Không phải nguồn bằng chứng độc lập với SPY V.

Kiểm tra: `node --test netflow-stumpy/tests/spy-volume-h1-mirror.test.mjs`
