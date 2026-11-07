# Xác nhận giá ma trận bằng biên nhóm H1 trước

- Vùng tham chiếu = high lớn nhất / low nhỏ nhất của toàn bộ M15 trong nhóm H1 liền trước, cùng kích thước nhóm trong cài đặt ma trận. Ví dụ H7–9 dùng vùng H4–6; H4–6 dùng H1–3. Nếu cửa sổ không chứa đủ nhóm trước hoặc thiếu một M15 nguồn, ghi chờ biên, không mượn vùng REV6.
- Vùng được biết tại thời điểm nhóm trước đóng, trước nến phá đầu của nhóm đang đọc. Không dùng high/low của chính nhóm đang đọc để di chuyển biên.
- Chỉ khi hai M15 đóng liên tiếp có close > high mới ghi Tăng · xn 2 M15; tương tự close < low cho Giảm. Đóng đúng mép, xuyên bằng râu, hai phía đối nhau, thiếu timestamp, nguồn incomplete hoặc nến còn hình thành không đủ điều kiện.
- Nhóm lịch sử chỉ dùng các M15 đóng trong chính nhóm. Nhóm mới nhất được cập nhật thêm M15 đã đóng sau giờ cuối nhóm, vì chưa có đủ H1 mới để dịch cửa sổ ma trận. Không chờ khóa H1 mới mới kiểm tra giá.
- Đây là xác nhận trạng thái giá HIỆN TẠI: giá trở lại trong vùng thì về chờ phá. Một nến ngoài vùng ghi chờ 2 M15 (1/2).
- Giá quyết định hướng nhãn xn, có thể ngược WLR trước đó. C Taker/OI ghi riêng ✓, ×, ?? hoặc thiếu; không chặn nhãn xn giá khi thiếu OI. C Taker vẫn là đồng thuận ΔV SPY × C Taker NF SPY+QQQ, không có dữ liệu mới hay giả định vị thế Long/Short.
- `forceState` và `forceText` giữ kết luận lực cũ. `priceConfirmation` chứa vùng, thời điểm khóa vùng, hai timestamp và hướng phá. Trendline 50/50 vẫn đòi hỏi lực/OI của mô hình cũ, đồng thời không được xn phá nếu chưa có hai đóng vượt vùng nhóm.

Kiểm tra: `node --test netflow-stumpy/tests/matrix-price-confirmation.test.mjs netflow-stumpy/tests/h1-matrix-state.test.mjs`
