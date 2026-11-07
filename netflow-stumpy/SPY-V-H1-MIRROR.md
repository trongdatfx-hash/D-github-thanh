# SPY V gương · điểm H1 — thử nghiệm

- Nút **SPY V gương H1: BẬT/TẮT** nằm cạnh SPY V mượt H1 trong Cài đặt chart. Bật mặc định, lưu cùng cấu hình chart. Chỉ hiển thị trên SPYUSDT M15, trong pane SPY V (pane 1), cùng thang và cùng tâm 0.
- Nguồn luôn là `volumeStrengthRows` — SPY V gốc từ `calculateVolumeStrength`, không lấy `displayVolumeStrengthRows` đã bật làm mượt theo màu H1. Nút SPY V mượt H1 không thay đầu vào đường mới.
- Lấy điểm từ cùng ledger `scoreH1Box` của biểu đồ, tối đa 512 hộp đã khóa. Chỉ `LOCKED`, đủ 4 M15 đóng, không thiếu thành phần, điểm nguyên trong −5…+5. Preview 3/4 không tham gia.
- Với mỗi M15 tại t, chỉ dùng điểm H1 đã khóa **trước hoặc đúng giờ mở t**, còn mới trong một giờ. Như vậy điểm của một hộp không làm thay đổi đường gương trong chính hộp đã tạo ra điểm đó. Thiếu điểm hợp lệ dùng trọng số 1 và `h1Score=null`, không điền điểm 0 giả.
- Bản nhanh: `w=1+abs(score)` (1–6), `d=2^(-1/0.65)`, `alpha=min(0.85,1−d^sqrt(w))`. Cập nhật `S(t)=S(t−1)+alpha*(Vgoc(t)−S(t−1))`; gương qua mốc 0 là `−S(t)`. Điểm âm cũng dùng trọng số dương. Bỏ bộ tích lũy khối lượng trọng số cũ để H1 mạnh đã hết hạn không kéo chậm giờ sau.
- Khi thay đổi SPY V nhỏ hơn 0,035: nhân alpha với 0,65 để giảm rung. Khi SPY V trái dấu với S và |SPY V|≥0,08: nâng alpha tối thiểu 0,90, có điều chỉnh theo độ lớn hai phía, tối đa 0,98. Không dùng nến tương lai, không ngoại suy vượt mức nguồn. Đây là ngưỡng hiển thị thử nghiệm, không phải tín hiệu giao dịch.
- Kiểm tra bước nhảy giả lập +0,8→−0,8 và chiều ngược lại: bản nhanh đổi dấu ngay mẫu đầu; bản cũ half-life 2 còn giữ dấu cũ ở mẫu đầu. Đây là kiểm tra phản ứng bộ lọc, không phải kết quả hiệu suất thị trường.
- Nến đang chạy có điểm gương xem trước từ SPY V hiện tại và trọng số H1 đã biết. Điểm nguồn thiếu hoặc khoảng trống thời gian khởi động lại bộ làm trơn. Nét solid 1px, `rgba(210,194,174,.55)`, không nhãn giá, không tô nền và không chiếm pane mới.
- Bộ nhớ đệm điểm chỉ được làm mới khi nến đóng, nguồn điểm hoặc dữ liệu OI thay đổi. Đường chỉ để so sánh thị giác; không đưa vào WLR, màu nến, ma trận, điểm H1 hay xác nhận breakout. Không phải nguồn bằng chứng độc lập với SPY V.

Kiểm tra: `node --test netflow-stumpy/tests/spy-volume-h1-mirror.test.mjs`
