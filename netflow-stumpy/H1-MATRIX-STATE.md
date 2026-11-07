# Nhãn suy luận nhóm H1

Ma trận gồm sáu hàng: vị trí/WLR, dốc WLR, RW gốc, RW điều chỉnh, ΔV×NF và OI.
Dữ liệu thực lấy từ điểm thành phần của các H1 đóng liên tục, không lấy điểm
tổng để đoán các hàng. Hộp PREVIEW ba M15 không tham gia suy luận nhóm.

Mặc định dùng 9 H1: đọc hai nhóm gần nhất, mỗi nhóm ba hộp không chồng nhau;
ba hộp cũ nhất là ngữ cảnh để đánh giá suy yếu của nhóm trước. Người dùng có
thể chọn dữ liệu 6/8/9/10 hộp, mỗi nhóm 2/3/4 hộp và đọc 1/2/3 nhóm.
Số nhóm tự giảm nếu không vừa cửa sổ. Lựa chọn lưu trong trình duyệt.
Dải histogram 36 H1 độc lập với cửa sổ ma trận này, không đổi công thức điểm.

Quy tắc mô tả, chưa được kiểm định dự báo:

- Hướng giá cần ít nhất ceil(2N/3) hộp cùng dấu vị trí WLR, có ít nhất một
  dốc WLR cùng hướng và không có dốc ngược trong nhóm.
- Được ủng hộ: ít nhất ceil(2N/3) hộp ΔV×NF và OI cùng hướng giá.
- Suy yếu: nhóm liền trước cùng hướng và từng được ủng hộ; cả số hộp dòng tiền
  lẫn số hộp OI hỗ trợ đều giảm. Không gán suy yếu chỉ vì tổng điểm thấp.
- Dòng tiền ngược giá ít nhất ceil(2N/3) hộp: xung đột, ưu tiên hơn suy yếu.
- Thiếu dữ liệu vị trí/dốc/ΔV×NF/OI: ghi thiếu, không quy thành 0; thiếu cả
  nhóm, đứt chuỗi: chờ đủ hộp. RW điều chỉnh không tạo xác nhận độc lập.
- Hiển thị giảm đối xứng với tăng, cùng trạng thái chưa đủ xác nhận/chuyển tiếp.

Nhãn một dòng nằm trên tuổi H1, thứ tự trước → mới; thời gian và ma trận chi tiết
trong tooltip/dataset. H1 quá cũ có dấu H1 CŨ; không gọi dữ liệu cũ là live.
Nhãn CVD một dòng giữ CVD, ΔOI%, tuổi nguồn và trạng thái chờ/lỗi, bỏ phần
xác nhận ngược; logic nguồn không thay đổi. Trên màn hình hẹp phần vượt bề
rộng có dấu …, nội dung đầy đủ trong tooltip và aria-label.
Nhãn dự đoán tuổi M15 chỉ hiện khi active, reliable và continuation hữu hạn;
continuation bằng 0 vẫn là dự báo hợp lệ. Nhãn tuổi H1 đếm hộp vẫn giữ riêng.
