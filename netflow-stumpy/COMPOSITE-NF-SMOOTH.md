# C Taker NF mượt — thử nghiệm hiển thị

SPYUSDT M15, line riêng trong pane SPY V. Bật mặc định; cài đặt cho phép tắt hoặc chọn cộng 4/8 M15. Giữ nguyên line Giá×Delta, histogram C Taker NF, điểm H1, ma trận, OI và các đầu vào dự báo. Không thêm yêu cầu dữ liệu mạng.

## Công thức

Chỉ ghép hai nến SPY và QQQ đóng đúng timestamp. Mỗi mã: NF = 2 × takerBuyQuote − quoteVolume. Tổng N = NF_SPY + NF_QQQ, tổng Q = Q_SPY + Q_QQQ.

1. x = N / SMA20(Q), cần đủ 20 cặp liên tục. Nếu toàn bộ Q bằng 0 thì x = 0.
2. R = tổng 4 x gần nhất, có lựa chọn 8.
3. E = |tổng x| / tổng |x| trên cùng cửa sổ; mẫu số 0 thì E = 0.
4. α = 0,18 + 0,42 E. Khi R ngược dấu EWMA trước và |R| ≥ 0,5 |EWMA trước|, α ít nhất 0,48.
5. F = F_trước + α(R − F_trước); điểm đầu khởi tạo F = R.
6. σ = SMA500(|F|) × √(π/2); S = 2Φ(F/σ) − 1. Khi σ = 0 thì S = 0.

S là chỉ số không đơn vị, đối xứng quanh 0, nằm trong −1…+1. Không trừ trung bình hay ánh xạ phân phối phiên. Không dùng dấu thân giá, SPY V, màu/điểm H1 hoặc OI để ép hướng. Các α là giá trị thử nghiệm, chưa chứng minh tối ưu bằng kiểm định dự báo.

Line dương xanh, âm hồng đỏ, nét liền 2 px; line Giá×Delta cũ vẫn dạng chấm. Nhãn C NF4/C NF8 trong pane giải thích công thức khi trỏ/chạm. NF histogram vẫn mang đơn vị USDT của riêng từng nến; dấu histogram có thể khác line vì line đã cộng và làm mượt.

## Thời gian và thiếu dữ liệu

Chỉ nến đã đóng: knownAt = t + 15 phút. Nến đang chạy là khoảng trống. Thiếu một mã, dữ liệu sai, nguồn không hoàn chỉnh hoặc gián đoạn M15 thì ngắt và khởi tạo lại lịch sử; không điền 0 thay dữ liệu thiếu. Cần 522 nến ghép liên tục cho điểm đầu bản 4, 526 cho bản 8. Không gắn nhãn LIVE chỉ vì có điểm lịch sử.

Các tùy chọn lưu bằng chức năng lưu cài đặt chart hiện có. Đổi 4/8 chạy lại độc lập trên lịch sử; không nối hai trạng thái làm mượt. Nến đã đóng không bị thay bởi nến tương lai hoặc nến đang chạy.

## Kiểm tra

`node --test netflow-stumpy/tests/composite-nf-smooth.test.mjs netflow-stumpy/tests/composite-nf-ui.test.mjs`

Bao gồm NF thật của cả hai mã, đối xứng dấu, tâm 0, thiếu cặp/gap, loại nến mở, không dùng dữ liệu tương lai, α tự điều chỉnh, nền 4/8, wiring series và nhãn/cài đặt.
