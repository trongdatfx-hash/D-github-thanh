# Dự báo vùng giá và màu WLR kế tiếp · nghiên cứu V1

Ngày nghiên cứu: 21/10/2026. **Không thay mô hình, chart, vùng CVD hoặc nhãn trên web.** Mục tiêu cuối theo bổ sung của người dùng: liên tục dự báo đoạn WLR kế tiếp hội tụ ở vùng giá nào và màu xanh/vàng/đỏ. Có hai phép thử: sau A–B tại mốc B đầu tiên, rồi cập nhật liên tục từng nến đóng. A–B–A/A–B–C là ngữ cảnh, không giới hạn toàn bộ mục tiêu.

## Câu hỏi và mốc dự báo

Sau khi A đã kết thúc và nến đầu tiên của B đã đóng, dự báo đoạn đổi màu ngay sau B. Đoạn đó có thể quay về màu A hoặc sang màu thứ ba C; không bỏ A–B–C như đối với mục tiêu A–B–A cũ. Xanh, đỏ, vàng đều được phép là A/B/C.

WLR tham chiếu là điểm WLR của nến B cuối đã đóng khi phát dự báo. Chỉ dùng phần B đã biết; không lấy trung vị, chiều dài hoặc điểm cuối B trong tương lai. Mục tiêu giá là **trung vị toàn đoạn WLR kế tiếp**, được chấm sau khi đoạn đó đổi màu và hoàn tất trong cùng khung PRE→POST.

Kết quả gồm ba phần riêng:

1. `pReturn`: tần suất quay lại A, có điều kiện xuất hiện đoạn kế tiếp; phía còn lại là C. Chọn nguồn tỷ lệ màu theo validation, không theo test.
2. `price`: phân phối trung vị WLR của đoạn kế tiếp, gộp cả A và C; P10/P50/P90, tỷ lệ cao/thấp hơn WLR tham chiếu. Không dùng màu thực tế tương lai để chọn nhánh trước khi dự báo.
3. `byRole`: phân vị riêng nếu quay lại A hoặc chuyển C. Mỗi nhánh cần ít nhất 12 ngày có trung vị hoàn tất; thiếu mẫu thì WAIT. `anchorPercentile` là vị trí WLR tham chiếu trong phân phối trung vị mục tiêu, không phải độ tin tưởng của mô hình.

Đường gạch vẫn tương ứng P50 nếu sau này đủ bằng chứng để tích hợp. Không đổi nhãn hiện tại hoặc thêm nhãn phủ lên nến. Nghiên cứu này chỉ tạo dữ liệu kiểm tra; chưa kết nối vào bộ vẽ.

## Dữ liệu và kiểm tra causal

Nguồn là 18.969 nến M15 SPYUSDT và 18.969 nến QQQUSDT từ 06/04/2026 13:30 UTC đến nến đóng 21/10/2026 05:15 UTC (12:15 giờ Việt Nam). Dữ liệu QQQ chỉ tham gia Strength Composite; SPY V vẫn dùng volume gốc SPY. SHA-256 từng tệp nằm trong báo cáo. Snapshot nguồn: `9223935348c53b0585d715ec37363e3a6ed5a44b`.

Giữ nguyên WLR, đồng thuận Strength Composite × SPY V và bộ 10 đặc trưng giá/độ dày WLR/cụm nến/Strength. Cửa sổ 8 và 16 nến. `STUMPY8/16` dùng hàm khoảng cách đã đối chiếu MASS trong ứng dụng; lần chạy này thực hiện bằng JavaScript, không gọi thư viện STUMPY Python. `CYCLE8/16` thêm ngữ cảnh causal của B và A đã hoàn tất với trọng số cố định.

Chỉ so với lịch sử cùng cặp màu A/B và cùng pha PRE/RTH/POST. Nhãn lịch sử phải trưởng thành trước đầu cửa sổ 16 nến truy vấn. Mỗi phân phối lấy tối đa một mẫu mỗi ngày, mô hình tối đa 20 ngày, cần ít nhất 12 ngày. Tỷ lệ màu, khả năng xuất hiện trước POST và phân phối giá có bộ mẫu đủ điều kiện riêng, được ghi tách biệt.

Đoạn kế tiếp còn mở cuối POST được ghi nhận màu nhưng không gán trung vị cuối. Chưa có đoạn kế tiếp được ghi riêng; thiếu dữ liệu tương lai khác với mẫu đang mở. Không gán các trường hợp đó thành C hoặc dự báo giá sai. 33 truy vấn thuộc 4 ngày có lỗ hổng dữ liệu tương lai được lưu riêng, không đưa vào điểm số.

Nến PRE số 0 chưa có A trước đó trong cùng PRE→POST, vì vậy nghiên cứu **sau A–B** phải chờ B đầu tiên. Mô hình A–B–A hiện đang chạy từ PRE số 0 vẫn giữ nguyên.

## Thiết kế đánh giá

- Chọn cửa sổ/mô hình bằng tỷ lệ đúng hướng trung bình theo ngày từ 01/06 đến 16/07. CYCLE16 được chọn; không thay bằng mô hình thắng test.
- Validation 17/07–20/08. Nguồn tỷ lệ màu chọn bằng Brier theo ngày: nền cặp màu/pha thắng mô hình hình học, nên giữ nền cho câu hỏi màu.
- Hồi cứu test từ 21/08, dữ liệu đến 21/10. 300 truy vấn trên 33 ngày đầy đủ: 237 trung vị hoàn tất, 33 đoạn kế tiếp còn mở cuối POST, 30 trường hợp chưa có đoạn kế tiếp.
- Bộ lọc WAIT dùng đúng quy tắc có sẵn: xác suất hỗ trợ phía P50 phải trên 50% và vượt nền cùng phía. Không dò lại ngưỡng trên test.
- Đối chứng: nền causal cùng cặp màu/pha, WLR hiện tại cho sai số giá, hướng thay đổi WLR vừa chốt (`momentum1`) và độ dốc 8 điểm WLR (`slope8`). Chọn đối chứng hướng đơn giản trên cửa sổ chọn ban đầu: momentum1.
- Kho này đã được xem trong nghiên cứu trước; mọi kết quả là hồi cứu thăm dò. Forward từ 22/10 chưa có mẫu. Bootstrap ghép cặp theo trung bình mỗi ngày, block 5 ngày, 5.000 lần, khoảng 97,5%; không coi N truy vấn là N ngày độc lập.

## Kết quả đã chạy

| Chỉ tiêu | CYCLE16 | Nền cặp màu/pha | Đối chứng hướng WLR vừa chốt |
|---|---:|---:|---:|
| Đúng màu kế tiếp, 262 truy vấn | 191/262 = 72,9% | 195/262 = 74,4% | — |
| Đúng cao/thấp WLR, 225 truy vấn | 153/225 = 68,0% | 133/225 = 59,1% | 170/225 = 75,6% |
| Đúng cao/thấp sau WAIT, 149 truy vấn | 117/149 = 78,5% | 96/149 = 64,4% | 113/149 = 75,8% |

Bộ lọc phát 156/300 = 52,0% số truy vấn; 149 trong số đó có mục tiêu hoàn tất để chấm. Không so trực tiếp 78,5% sau lọc với 68,0% trước lọc như cùng bộ mẫu.

Sau WAIT, chênh lệch độ chính xác **trung bình theo ngày** so với momentum1 chỉ +0,41 điểm %, khoảng 97,5% từ **−6,96 đến +7,45 điểm %**: chưa chứng minh hơn đối chứng đơn giản. Chưa lọc, CYCLE16 còn kém đối chứng này.

MAE trung vị theo ngày: 0,1302% giá tham chiếu, nền 0,1346%; khoảng cải thiện vẫn chứa 0. Pinball của P10/P50/P90 cũng chưa cải thiện rõ. P10–P90 chứa trung vị thực tế 164/225 = 72,9% theo truy vấn, trung bình theo ngày 67,6%, **chưa đạt 80%**. Sau WAIT độ phủ theo ngày 67,6%, theo truy vấn 73,2%.

**Kết luận: NOT_ESTABLISHED.** Có thể xây dự báo chung sau A–B cho cả A/C và giá WLR, nhưng chưa đủ bằng chứng để thay mô hình A–B–A đang chạy. Không suy ra 78,5% này tốt hơn tỷ lệ của production vì mục tiêu và bộ thời điểm khác nhau. Khả năng xuất hiện đoạn tiếp theo trước POST cũng chưa thắng nền.

## Chạy lại

Tại thư mục gốc repo, Node.js 22, không cần dependency ngoài:

```sh
node --test research/wlr-next/tests.mjs
node research/wlr-next/dataset.mjs
```

Tạo `research/wlr-next/output/report.json`, `ledger.json`, `summary.md`. Ledger giữ mọi truy vấn đủ điều kiện, kể cả mẫu thiếu tương lai/đang mở/chưa có đoạn tiếp theo. Workflow nghiên cứu chỉ có quyền đọc, lưu kết quả vào artifact; không sửa dữ liệu production hoặc triển khai web.

Kiểm tra cục bộ: 9/9 test đạt, gồm màu vàng, A–B–C, mẫu mở, thiếu dữ liệu, chống nhìn tương lai và giới hạn ngày độc lập.

## Bổ sung mục tiêu: dự báo WLR kế tiếp liên tục

Người dùng xác nhận mục tiêu cuối là dự báo liên tục vùng giá phân vị của đoạn WLR kế tiếp và màu xanh/vàng/đỏ, thay vì chỉ nhận diện A–B–A. Đã thêm `rolling-core.mjs`, `rolling-dataset.mjs`, `rolling-tests.mjs`, `source.mjs`, `audit.mjs`. Toàn bộ vẫn là nghiên cứu riêng, không nối vào chart.

Sau mỗi nến M15 đóng, từ PRE số 0 khi đủ lịch sử, phát một lượt dự báo mới cho cùng mục tiêu WLR kế tiếp. Lượt mới có mốc WLR đã chốt mới; các lượt cũ và mốc cũ giữ nguyên trong ledger. Không dùng nến đang chạy, không ghi đè lịch sử, không nhận bản cập nhật trùng hoặc đến muộn. Mã mục tiêu theo ngày và thời điểm bắt đầu đoạn hiện tại, không phụ thuộc số thứ tự đoạn khi tải thêm lịch sử.

Đoạn kế tiếp được định nghĩa là đoạn **đổi màu**. Nếu đang xanh, đoạn đổi màu kế tiếp là vàng hoặc đỏ; khả năng tiếp tục xanh ở nến sau được dự báo riêng. Tương tự cho hai màu khác. Cả ba màu vẫn là mục tiêu trong toàn chuỗi; không gán xác suất sai cho một đoạn “mới” cùng màu đoạn hiện tại.

Mỗi lượt có vector xác suất xanh/vàng/đỏ, P10–P50–P90 chung cho trung vị WLR kế tiếp, P10–P50–P90 riêng từng màu nếu đủ mẫu, vị trí phân vị WLR tham chiếu, xác suất cao/thấp, khả năng tiếp tục màu hiện tại và khả năng xuất hiện đoạn tiếp theo trước hết POST. Không dùng màu tương lai thực tế để chọn nhánh giá. Không ép vùng dự báo hẹp lại để tạo cảm giác hội tụ.

Lịch sử đối chiếu cùng màu hiện tại, pha và nhóm tuổi đoạn 1 / 2–3 / 4–7 / 8–15 / 16–31 / 32+ nến. Vẫn một mẫu mỗi ngày, tối thiểu 12 ngày và tối đa 20 ngày cho mô hình. Ngữ cảnh trước đó được dùng nếu có; không bắt buộc phải có A trước đó ở nến PRE số 0.

### Kết quả liên tục

CYCLE16 thắng CYCLE8 trên cửa sổ chọn 01/06–16/07. Nguồn tỷ lệ màu được chọn bằng Brier validation 17/07–20/08. Test hồi cứu có **2.070 lần cập nhật, 333 mục tiêu, 33 ngày**; đây không phải 2.070 mẫu độc lập. Điểm chính lấy trung bình các lần cập nhật trong mỗi mục tiêu, rồi trung bình các mục tiêu trong ngày; bootstrap theo ngày.

| Chỉ tiêu cân bằng theo mục tiêu/ngày | CYCLE16 | Nền cùng màu/pha/tuổi | Hướng WLR vừa chốt |
|---|---:|---:|---:|
| Đúng màu kế tiếp, 303 mục tiêu có màu | 74,7% | 70,4% | — |
| Đúng cao/thấp, 268 mục tiêu có trung vị | 71,9% | 59,4% | 78,7% |
| Đúng cao/thấp sau WAIT, 243 mục tiêu | 76,3% | 60,5% | 80,0% |
| MAE giá trung vị | 0,0946% | 0,1027% | — |
| Pinball P10/P50/P90 | 0,0347 | 0,0378 | — |
| Độ phủ P10–P90 | 74,7% | 79,6% | — |

Tỷ lệ đúng hướng đếm theo lượt cập nhật lần lượt là 73,4% chưa lọc và 80,3% sau WAIT; không dùng những số này thay cho điểm cân bằng theo mục tiêu/ngày. Có dự báo giá đủ mẫu trên 1.897/2.070 lượt (91,6%). Bộ lọc phát 1.320/2.070 lượt (63,8%); 1.173 lượt trong đó có trung vị hoàn tất để chấm.

Màu, MAE và pinball tốt hơn nền theo kiểm tra ghép cặp hồi cứu. Tuy nhiên hướng vẫn chưa thắng đối chứng WLR vừa chốt, và dải 80% danh nghĩa vẫn thiếu độ phủ. Vì vậy kết luận tổng hợp tiếp tục là **NOT_ESTABLISHED**, chưa thay mô hình web.

### Đo khả năng hội tụ

Trong 222 mục tiêu có ít nhất hai lần dự báo giá đủ mẫu trên 33 ngày, so lượt đầu với lượt cập nhật đủ mẫu cuối trước khi đoạn mục tiêu thực sự bắt đầu:

- MAE P50 giảm từ **0,1420% xuống 0,0680%**, cùng mẫu số là WLR tham chiếu của lượt đầu mỗi mục tiêu.
- Độ rộng P10–P90 giảm từ **0,2925% xuống 0,2326%**; khoảng 71,2% chuỗi có vùng hẹp hơn.
- Độ phủ ở hai mốc này tăng từ 66,5% lên 80,0%, nhưng đây là hai mốc được xác định trong hồi cứu, không phải độ phủ của mọi dự báo live.
- Khoảng cải thiện MAE 97,5% theo ngày: +0,0501 đến +0,0988 điểm % giá tham chiếu.

Không thể biết trước nến nào là nến cuối đoạn B. Những số trên chứng minh dấu hiệu hội tụ trong hồi cứu, không tạo một quy tắc vào lệnh ở “lượt cuối” hoặc cam kết giá sẽ đến P50. Điểm toàn bộ quá trình và độ phủ 74,7% vẫn là thước đo cần cải thiện; chưa có forward test.

### Chạy lại và kiểm tra

```sh
node --test research/wlr-next/tests.mjs research/wlr-next/rolling-tests.mjs
node research/wlr-next/rolling-dataset.mjs
node research/wlr-next/audit.mjs
```

16/16 test đạt. Audit đi qua 5.139 lượt dự báo cho 807 mục tiêu từ cửa sổ chọn đến cuối kho: kiểm tra timestamp, mục tiêu, xác suất màu, thứ tự phân vị, mẫu chưa hoàn tất và mốc giá. Báo cáo đầy đủ, mọi phiên bản dự báo và SHA-256 nguồn nằm trong artifact `wlr-next-after-ab-research`; không thay dữ liệu production, vị trí vùng CVD hay nhãn trên chart.
