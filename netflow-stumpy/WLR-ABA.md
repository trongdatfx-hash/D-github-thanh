# WLR A–B–A · thử nghiệm

Được xuất bản theo yêu cầu ngày 21/10/2026. Giữ nguyên dự báo tuổi trend, nhãn vàng trên chart và bảng tuổi trend. Các dự đoán aeon, hình học RTH, lợi suất sau3/6/12 nến và đường giá +8 được gỡ khỏi giao diện.

A là một đoạn WLR hiện tại; B là đúng một đoạn khác màu; mục tiêu là đoạn A cùng màu kế tiếp. Xanh, đỏ và vàng đều được tính. A–B–C–A không đáp ứng điều kiện. Mẫu và mục tiêu nằm trong một ngày PRE→RTH→POST theo New York, với lịch đóng sớm thực tế. Dữ liệu NIGHT được dùng để khởi tạo chỉ báo và cửa sổ đầu vào 8/16 nến; không trở thành đoạn A/B hoặc mục tiêu ngoài PRE→POST.

Bắt đầu ngay từ nến PRE số 0, mở 04:00 và đóng 04:15 New York trên M15. Không cần chờ 16 nến trong PRE: cửa sổ 16 nến gồm nến số 0 đã đóng và 15 nến lịch sử liên tục ngay trước đó. Trung vị A lúc này chỉ lấy phần PRE đã biết (một điểm WLR), không cộng các điểm NIGHT. Chưa đóng nến số 0, thiếu lịch sử, đứt chuỗi hoặc chưa đủ chỉ báo/mẫu lịch sử thì báo WAIT. Kho hồi cứu và mô hình cũng được tính lại với quy tắc này; dữ liệu phiên bản cũ không trộn vào báo cáo mới.

Màu WLR lấy đúng đồng thuận Strength Composite × SPY V; không lấy màu cụm nến. Trung vị lấy các điểm đường WLR50, không lấy giá đóng nến. Mốc so sánh là trung vị phần A đã biết khi bắt đầu theo dõi; dự báo được giữ nguyên qua B và A kế tiếp để tránh sửa kết quả sau khi đã thấy tương lai. Nút “Theo WLR hiện tại” bắt đầu lượt mới. Các lượt trong tab được giữ khi tải lại trang; đây không phải sổ giao dịch.

Mẫu đang dở vẫn được dự đoán và nhận dạng. Khi A kế tiếp xuất hiện, giao diện báo đã thuộc A–B–A dù A đó còn mở. Trung vị cuối chỉ được chốt khi đổi màu; không dùng trung vị tạm như kết quả cuối. Nếu hết POST mà chưa đủ chuỗi, giữ “chưa xác nhận”, không tự gán sai. Chỉ A–B–C được xác nhận khác mẫu.

Tần suất thuộc mẫu dựa trên những ngày lịch sử đã xác nhận; số chưa xác nhận được ghi riêng. Đây không phải xác suất đã hiệu chỉnh hay tỷ lệ thắng. Vùng trung vị và P10–P90 chỉ có điều kiện nếu mẫu xuất hiện và có đủ12 ngày hoàn tất. Thiếu mẫu thì WAIT, không vẽ đường phẳng thay dự báo. Vùng ngang không quy định thời gian8 nến hay bảo đảm giá nằm trong vùng.

CYCLE8/16 được chọn trên validation, không đổi theo mô hình tốt nhất ở tập test. STUMPY MASS thật tính trong GitHub Actions; trình duyệt dùng khoảng cách tương đương đã đối chiếu. Các nhãn lịch sử phải hoàn tất trước đầu cửa sổ16 nến hiện tại; cùng màu và cùng pha PRE/RTH/POST; tối đa20 ngày, mỗi ngày một mẫu. Kiểm tra lỗi gom theo ngày để tránh tăng N từ các cửa sổ trùng nhau.

Các điểm số hồi cứu trong báo cáo dùng mốc đầu đoạn đủ điều kiện. Bắt đầu theo dõi một đoạn đã mở lâu là một dự báo causal mới, chưa được kiểm chứng tương lai riêng. Giá trị và thời gian kho dữ liệu luôn được ghi. Ngoài SPY M15, ngoài PRE–POST, API cũ hoặc timestamp chart không đồng bộ, vùng dự báo chuyển WAIT.

Lợi thế dự báo trung vị giá chưa được xác lập. Các kết quả trên kho đã nghiên cứu vẫn mang tính thăm dò. Nút bật/tắt A–B–A không ảnh hưởng nến giá, WLR, hai Strength hoặc dự báo tuổi trend.


## Chỉ tiêu chính: cao / thấp so với WLR cuối

Mốc là điểm WLR của nến cuối đã đóng tại lúc phát dự báo, không phải close OHLC hoặc điểm cuối A còn chưa biết. Mốc được giữ nguyên qua A→B→A; phần trăm trên chart cũng so với mốc này. Mô hình trung vị và cách chọn validation MAE giữ nguyên. Đánh giá hướng là phép kiểm tra bổ sung thăm dò, không chọn lại người thắng trên test.

Hướng mô hình lấy dấu của trung vị dự kiến trừ mốc WLR. Tần suất hướng có điều kiện lấy phân phối delta/ATR đã dùng cho vùng giá, chiếu tại mốc truy vấn; không phải xác suất hiệu chỉnh. Nền hướng chọn phía phổ biến hơn trong các nhãn hoàn tất lịch sử cùng màu/phiên, lấy một mẫu gần giờ nhất mỗi ngày, nhãn trưởng thành trước cửa sổ đầu vào. Không dùng tỷ lệ toàn tập test để chọn phía. Hòa không phát hướng.

Chấm cùng các mốc mà cả hai bên đủ ít nhất 12 ngày có hướng lịch sử khác mốc, mô hình sẵn sàng và trung vị A kế tiếp đã hoàn tất. Mục tiêu bằng mốc được đếm riêng. Mẫu dở không bị gán sai. Báo số lần đúng/tổng số và tỷ lệ trung bình theo ngày; kiểm định ghép cặp block bootstrap 5 ngày, 5000 lần, 97,5%, cần ít nhất 30 ngày và toàn khoảng cải thiện lớn hơn 0. Tín hiệu hồi cứu vẫn cần forward test. Tỷ lệ thuộc mẫu A–B–A, độ chính xác hướng và sai số giá là ba chỉ tiêu riêng. P10–P90 chưa có kiểm định độ phủ ngoài mẫu.

## Vùng vẽ ổn định theo WLR

Dịch ngang sang trái đúng 20 vị trí nến theo logical scale hiện tại của biểu đồ, không phải 20 pixel hoặc 300 phút lịch qua đêm/cuối tuần. Vùng vẫn có thể chồng lên CVD, thay đổi khoảng cách pixel khi zoom. Giá trị dọc dùng priceToCoordinate của chính series WLR; điểm tham chiếu là WLR cuối đã đóng tại lúc phát dự báo. Không dùng close OHLC hoặc màu nến làm tham chiếu. Mô hình và các giá trị dự báo WLR tuyệt đối không đổi bởi việc dịch vùng vẽ.

Giữ nguyên mốc, giá kỳ vọng và hai phân vị của cùng lượt dự báo khi chuyển A→B→A. Chỉ lượt mới sau kết thúc/phá mẫu đã xác nhận hoặc thao tác thủ công mới có giá mới. Canvas dùng back buffer, không resize/xóa nếu hình học không đổi; khung đã vẽ chỉ được thay sau khi khung mới hoàn tất. Đồng bộ ngắn tối đa 20 giây được giữ khung cũ với nhãn đang đồng bộ, giới hạn một nến đã đóng chênh lệch; mất dữ liệu mới, đổi symbol/timeframe hoặc ngoài điều kiện live thì ẩn. Không giữ vùng cũ vô thời hạn như dự báo live.

Nhãn A ↑ …% / nền …%: cả hai số cùng đo phía cao hơn mốc WLR đã chốt, có điều kiện trung vị mục tiêu hoàn tất. Lấy từ dự báo hướng hiện tại và nền lịch sử causal tại cùng mốc, không lấy tỷ lệ đúng hồi cứu chung 69,7% để gắn lên mọi mẫu. Mẫu thiếu lịch sử ghi WAIT; không thay bằng tỷ lệ thuộc mẫu hoặc phần trăm biến động giá.

## V2: chọn hướng, thử hiệu chỉnh, chọn WAIT

Các cửa sổ cố định: chọn CYCLE8/16 theo tỷ lệ đúng hướng trung bình theo ngày từ 01/06 đến trước 17/07; fit sigmoid ridge theo trọng số mỗi ngày từ 17/07 đến trước 07/08; chọn giữ tỷ lệ gốc hay dùng sigmoid và chọn WAIT từ 07/08 đến trước 21/08. Không dùng nhãn test để chọn model, calibrator hoặc gate. Test lịch sử đã được xem trong nghiên cứu trước nên là hồi cứu thăm dò; forward từ 22/10/2026 được báo riêng và không dùng để refit.

Phép hiệu chỉnh có đối chứng identity. Nếu sigmoid không hạ Brier trên validation kế tiếp thì giữ tỷ lệ gốc, không gọi là xác suất đã đáng tin cậy hơn. WAIT luôn yêu cầu tỷ lệ hỗ trợ phía của P50 và vượt nền cùng phía; thử thêm các mức vượt 0/5/10 điểm % và điều kiện cả dải P10–P90 cùng phía WLR. Cấu hình cần ≥20 mốc và ≥5 ngày validation, giữ ≥30% các mốc đủ điều kiện. Bộ lọc quá ít mẫu không được chọn mặc định. V2 tiếp tục theo dõi mẫu đang dở khi WAIT, chỉ ẩn vùng dự báo phát tín hiệu. Đổi mốc bằng nút thủ công hoặc sau khi lượt cũ kết thúc/phá; không đổi WLR neo theo màu nến đang chạy.

Báo trước/sau WAIT cùng tỷ lệ tín hiệu; kết quả hai tập mốc khác nhau không chứng minh tự động mô hình tốt hơn. Độ phủ P10–P90 được đo trên các trung vị hoàn tất có dự báo giá sẵn sàng, cả theo số mốc và trung bình theo ngày; chưa coi là dải hiệu chỉnh có bảo đảm 80%.

Theo điều chỉnh hiển thị mới nhất: vùng dự báo rộng bằng 1/3 bề ngang phổ CVD, neo tâm CVD; thay cho độ lệch 20 nến cũ. Không vẽ nhãn chữ trong vùng giá và ẩn badge phủ lên nến. Giá WLR và phân vị vẫn giữ nguyên, số liệu xem ở bảng dưới chart.
