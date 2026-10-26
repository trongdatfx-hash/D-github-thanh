# Rà soát nhãn tuổi trend · 21/10/2026

Ảnh được đối chiếu là nhãn `↑ UP · 7/12 NẾN · TUỔI P16 · CÒN ~7 NẾN · TREND CÒN 75%`, không phải nhãn dự báo giá A–B–A.

## Cách hiểu các trường

- **UP/DOWN:** hướng của Flow-Leg đã xác nhận; nhãn chuyển WAIT nếu thiếu điều kiện công bố hoặc ước lượng sống thêm ba nến dưới ngưỡng 55%. Đây không phải dự báo màu nến tiếp theo.
- **7/12:** 7 nến đóng đã được nhận vào leg hiện tại; 12 là trung vị tổng số nến của cohort lịch sử, không phải thời hạn bắt buộc.
- **TUỔI P16:** phân vị tuổi trend theo ước lượng Kaplan–Meier; không phải phân vị giá WLR hoặc độ tin tưởng 16%.
- **CÒN ~7:** trung vị số nến được nhận thêm, có điều kiện leg đã đạt tuổi hiện tại; không tính bằng 12−7. Hai số 7 và 12 do đó không tự mâu thuẫn.
- **TREND CÒN 75%:** ước lượng leg sống thêm **3 nến được nhận**, không phải xác suất giá tăng 75%, tỷ lệ đúng A–B–A hoặc khả năng chạm giá mục tiêu.

Ảnh không kèm timestamp/cohort nên không thể xác minh riêng con số 75% từ ảnh. Việc rà soát dưới đây phát hiện lỗi ở mã đang dùng, không kết luận mọi giá trị trong ảnh đều sai.

## Các lỗi đã tái hiện và sửa

1. **Lệch một nến trong xác suất sống:** T là số nến đã được nhận. Đang sống sau n nến nghĩa là T≥n. Với 6 leg dài 7 và 6 leg dài 11, tuổi 7, sống thêm 3 nến phải là 6/12=50%; mã cũ trả 100%. KM chung vẫn giữ nguyên. Riêng thống kê tuổi đặt vị trí thất bại F=T+1, censor sau c nến tại c, rồi tính S_F(n+3)/S_F(n). Khi không có censor, kết quả khớp trực tiếp P(T≥n+3 | T≥n).
2. **Đuôi chưa được quan sát bị coi là chắc chắn:** 12 leg đều bị censor tại tuổi 7 không cho biết sống thêm ba nến hay không; mã cũ có thể trả 100%. Giờ cần đủ chân trời và ít nhất 5 kết quả có thể xác định trong tập đạt tuổi hiện tại; nếu không thì WAIT. Tỷ lệ KM vẫn là ước lượng mô tả với giả định kiểm duyệt, chưa phải xác suất đã hiệu chỉnh.
3. **Trễ kết thúc:** kênh đã có nến exit nhưng bộ đếm tuổi còn thêm một lượt dung sai nến yếu. Giờ bộ đếm theo trực tiếp vòng đời kênh: một leg đã xác nhận là một episode, dừng ngay ở exit đã đóng. Engine vẽ kênh và hai nến dung sai bên trong engine không đổi.
4. **Tuổi lấy chiều dài cuối trước khi được biết:** bảng ánh xạ dùng `trend.bars` cho mọi nến, có thể đưa tuổi cuối của kênh tương lai hoặc chưa xác nhận vào kết quả khi phát lại một prefix. Giờ chỉ lấy nến đã đóng trong phần dữ liệu đang biết, đợi confirmation và không nối qua khoảng trống dữ liệu.
5. **Chọn cohort thiếu mẫu sống:** cohort hẹp có đủ N nhưng thiếu mẫu đạt tuổi hiện tại có thể chặn cohort rộng đủ mẫu. Giờ tất cả các mức fallback đều kiểm tra tuổi, số mẫu và thời gian theo dõi.
6. **Chặn trung vị phần đời còn lại ở 48 nến:** bỏ giới hạn này; lấy thời điểm KM thực sự đạt trung vị. Phần đời còn lại có thể bằng 0; nếu chưa quan sát được trung vị thì để trống.
7. **Nhãn xanh còn hiện khi dữ liệu cũ/ngoài phiên:** lớp hiển thị kiểm tra live, độ mới M15 và phiên PRE/RTH theo đồng hồ Binance; chuyển WAIT thay vì tiếp tục trình bày tỷ lệ cũ như live. Bộ ước lượng đã tính không bị ghi đè.
8. **Mô tả cũ khác mã:** đồng bộ tooltip, hai trang HTML, phương pháp và định nghĩa N. R² OOS/partial chỉ chẩn đoán; tuổi từ leg đã xác nhận, kể cả leg ngắn không được vẽ. N là số leg; số ngày ghi riêng, không gọi số leg là mẫu độc lập.

## Giới hạn thay đổi

Giữ nguyên vị trí, kiểu chữ và cấu trúc nhãn ngắn. Chỉ sửa phép tính tuổi, vòng đời và giải thích. Không đổi engine/geometry vẽ kênh, WLR, hai Strength, mô hình A–B–A, vùng giá P10–P90 ở tâm CVD hoặc các nghiên cứu WLR kế tiếp.

Nhãn tuổi này dùng PRE→RTH và dừng live lúc hết RTH theo lịch phiên hiện có. Phạm vi PRE→POST của dự báo A–B–A là một luồng riêng, không trộn xác suất vào nhãn tuổi trend.

## Kiểm tra

```sh
node --test netflow-stumpy/tests/pre-rth-wlr-trend.test.mjs netflow-stumpy/tests/causal-trend-channel.test.mjs netflow-stumpy/tests/strength-box.test.mjs netflow-stumpy/tests/quantile-price.test.mjs netflow-stumpy/tests/engine.test.mjs netflow-stumpy/tests/strength-sources.test.mjs
node netflow-stumpy/scripts/audit-trend-age.mjs
```

77/77 kiểm tra đạt, không có test bỏ qua. Ca kiểm tra gồm: công thức rời rạc đối chiếu đếm trực tiếp, censor thiếu chân trời, median bằng 0 và vượt 48 nến, exit không trễ, confirmation tương lai, clip chiều dài, dữ liệu hở/cũ, fallback cohort, giữ nguyên chuỗi nhãn ảnh, không ảnh hưởng A–B–A và Strength. Script phát lại ba mốc PRE/RTH/kết thúc phiên từ kho Binance M15 thực đã đạt; kiểm tra tuổi bằng số nến của kênh đang mở và sửa dữ liệu tương lai không làm đổi kết quả hiện tại.

Snapshot nguồn rà soát: `9223935348c53b0585d715ec37363e3a6ed5a44b`; 18.969 nến M15 SPY và QQQ trong kho. Báo cáo phát lại được lưu trong artifact `trend-age-label-audit` của workflow **Trend age label correctness**. Đây là kiểm tra tính đúng của mã, không phải bằng chứng tăng tỷ lệ thắng giao dịch.


## Màu nến lịch sử · 25/10/2026

Nút **Nến tuổi trend** áp dụng cho SPY M15 cả khi xem lịch sử hoặc ngoài phiên live. Mỗi nến đóng lấy nhãn riêng tại thời điểm đó; không lấy nhãn của trend hiện tại để tô lại cả leg. Chỉ bắt đầu màu từ nến xác nhận, không tô ngược các nến trước confirmation. UP xanh, DOWN đỏ khi cohort đủ mẫu và xác suất sống thêm ba nến đạt 55%; WAIT, ngoài phiên và nến chưa đóng màu xám.

Phát lại dùng cùng thuật toán tuổi, ngưỡng, fallback cohort và Strength context với nhãn hiện tại. Cohort của mỗi ngày chỉ gồm các ngày trước; tuổi tại từng nến là số nến đã nhận đến lúc đó. Không dùng chiều dài cuối của leg để ấn định tuổi quá khứ. Bộ lọc live vẫn áp dụng riêng cho nhãn và đề xuất giao dịch hiện tại. Đây là phát lại mô tả, không phải xác thực live hoặc tỷ lệ thắng.

Tính trong studies worker, chỉ trả trạng thái thuộc khoảng giá đang tải, nhưng giữ các ngày trước để huấn luyện cohort. Tooltip trên nến có nhãn, tuổi, xác suất sống thêm +3 nến và số leg mẫu.

Kiểm tra: 25 ca tuổi trend và lịch sử, 26 ca kênh/màu WLR đạt. Phát lại kho 19.044 nến Binance: 160 nến trong phiên thuộc 500 nến cuối, 44 UP / 25 DOWN / 91 WAIT; kiểm tra các prefix so với bộ ước lượng hiện tại khớp. Số liệu này kiểm tra mã, không phải hiệu quả giao dịch.


## Biên WLR ±2σ theo pha A–B–A

Hai biên giữ nguyên công thức giá và σ. Chỉ đổi màu trên các đoạn thuộc track nghiên cứu hiện tại: A xanh, B đỏ, A kế tiếp xanh, độc lập với dấu tăng/giảm gốc của WLR. Các đoạn khác giữ xanh lam trung tính. Mẫu phải đồng bộ, live, snapshot xác minh, preview V3 emit, prediction ready, memberReady và pMembership ≥50%. Không gọi đó là tín hiệu đã được xác thực sử dụng; usableSignal và các khóa forward giữ nguyên.

Chỉ tô các nến đã đóng đến lastTime của track. Đổi symbol/timeframe, mất live, thiếu context, mẫu bị phá hoặc chất lượng không đạt trả về trung tính. Bốn ca kiểm tra bổ sung đạt: chuỗi pha, khóa chất lượng, mẫu phá/gap và giá trị biên không đổi.

Cập nhật 26/10/2026: dự báo WLR A–B–A V2/V3 đã được gỡ. Phân vị giá hiện neo hộp DVP; xem BOX-QUANTILES.md. Các kết quả 77/77 ở trên ghi nhận đợt kiểm tra tuổi trend trước thay đổi này.
