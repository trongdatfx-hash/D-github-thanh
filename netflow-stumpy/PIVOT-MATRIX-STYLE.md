# HT/KC theo ma trận H1

Chỉ vẽ hai line chính HT và KC tại pivot giá. Bỏ các line Low/High phụ của
REV6; không bỏ WLR ±2σ hoặc dự báo P10/P50/P90 riêng. Giữ nguyên low/high
trong phép tính vùng, nhận biết chạm và loại vùng đã phá.

Kiểu nét là đánh giá hiện tại, không phải trạng thái đã biết từ lúc pivot sinh ra:

- Nét liền 1 px: chưa đủ xác nhận, thiếu OI, chưa chạm vùng hoặc dữ liệu cũ.
- Nét liền 3–4 px: ít nhất 2/3 H1 cùng dấu giá/WLR, ΔV×NF, OI theo hướng giữ
  vùng; giá thực tế chạm vùng, hai M15 cuối giữ biên và có phản ứng khỏi vùng.
  Toàn bộ H1 đồng thuận dùng 4 px; còn lại 3 px.
- Nét đứt 2 px: ít nhất 2/3 H1 đồng thuận theo hướng phá; giá chạm vùng,
  hai M15 đóng cuối tiếp tục tiến vào hoặc xuyên vùng.

Dùng tối đa 3 H1 liên tục gần nhất trong ma trận, tối thiểu 2, chỉ sau thời gian
zone.confirmedAt, đủ 4 giá M15 đóng mỗi H1 và không cũ quá một H1. Ma trận
thiếu được giữ ở trạng thái chưa xác nhận. Quy tắc HT/KC đối xứng. Không dùng
RW để cộng thêm bằng chứng. Không dùng điểm tổng làm xác suất. Tính riêng
từng vùng: một nhóm tăng có thể hỗ trợ HT và gây áp lực lên KC, chỉ khi có
chạm giá thực tế tại mỗi vùng.

Giữ màu HT/KC cũ. Kiểu nét không tái dùng làm nhãn huấn luyện tại thời điểm
quá khứ và chưa được đánh giá là cải thiện độ chính xác so với REV6 gốc.
