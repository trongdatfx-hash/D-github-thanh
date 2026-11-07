# Điểm H1 mượt — thay đường gương SPY V

Nguồn trực tiếp là các điểm `scoreH1Box` từ cùng ledger với histogram hộp H1, không dùng `volumeStrengthRows` hoặc đường SPY V để tính đường mới. Điểm hộp vẫn giữ định nghĩa hiện hành; không tính lại ma trận hay WLR từ đường hiển thị này.

- Nút **Điểm H1 mượt: BẬT/TẮT** thay nút SPY V gương cũ trong Cài đặt chart. Bật mặc định, chỉ hiển thị SPYUSDT M15, cùng pane SPY V. Dương ở trên 0, âm ở dưới 0, không đổi dấu phản chiếu.
- Một hộp H1 đủ 4 M15 đóng, `LOCKED`, không thiếu thành phần mới có điểm chính thức. Timestamp là `blockEnd+1`: đúng lúc đóng H1. Không dịch điểm về đầu hộp.
- Lần đầu dùng điểm gốc. Sau đó `S=0.75*score+0.25*S_previous`. Khi điểm trái dấu với S trước và `abs(score)>=2`, dùng alpha .90. Chia S cho 5 để vẽ trên thang −1…+1; nội dung đọc vẫn ghi **H1 gốc** và **mượt** theo thang −5…+5.
- Hộp 3/4 chỉ xuất hiện trong series preview **nét chấm**, tại `asOf=blockStart+3*M15`, dùng đúng ba nến đã đóng. Preview không đi vào đường chính thức hoặc trạng thái làm trơn của hộp sau. Hết giờ, preview được gỡ và điểm chính thức đặt ở giờ đóng nếu đủ dữ liệu.
- Điểm thiếu được biểu diễn whitespace và reset bộ làm trơn. Khoảng trống H1 chèn điểm trống; không nối preview qua khoảng trống. Không điền điểm 0 giả.
- Nét mảnh 1px, nâu trắng nhạt `rgba(210,194,174,.55)`; các điểm H1 có marker nhỏ. Khi trỏ/chạm chart, nhãn trong pane đọc điểm gốc, điểm mượt và trạng thái ĐÃ KHÓA/TẠM 3/4. Tooltip chi tiết cũng có nội dung này.
- Không thay điểm hộp, màu nến, ma trận, Trendline 50/50, WLR hay dự báo tuổi trend. Đây là cách biểu diễn điểm cấu trúc, không phải xác suất hoặc dự báo giá.

Kiểm tra: `node --test netflow-stumpy/tests/h1-score-line.test.mjs`
