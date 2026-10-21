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

