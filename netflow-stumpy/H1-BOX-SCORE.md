# Điểm 8 hộp H1 — bắt đầu sau 3 M15 đóng

Trên chart SPYUSDT M15, histogram nhỏ nằm ngay trong pane nến chính,
gốc 0 ở giữa, cột dương xanh và âm đỏ. Trục điểm cố định −5…+5,
độc lập thang giá. Tọa độ ngang dùng cùng `h1StripCell` với dải H1 ở pane SPY V:
mỗi cột ứng với đúng 4 M15 của một H1, không dồn 8 cột vào một góc.
Kéo/zoom/đổi kích thước sẽ cập nhật tọa độ. Khi xem quá khứ, chọn tối đa 8 hộp
đủ điều kiện tại mép phải cửa sổ đó. Hộp đang chạy bắt đầu có cột điểm tạm
khi đủ 3 M15 liên tục đã đóng kể từ đầu H1. Hộp này nằm trong giới hạn 8 cột,
thay cho hộp cũ nhất. Chưa đủ 3 M15 thì chưa có điểm cho hộp hiện tại.
Ký hiệu `~` và viền nét đứt là điểm tạm 3/4, không lưu thành điểm đã khóa.

## Công thức v2 — thưởng RW thuận chiều

Mỗi thành phần gốc có điểm −1, 0 hoặc +1. Cộng 5 thành phần và điểm thưởng
RW thuận chiều, sau đó giới hạn điểm hiển thị trong −5…+5. Tooltip giữ cả
tổng thô trước giới hạn để thấy rõ phần thưởng (ví dụ tổng +6 hiển thị +5).

1. Vị trí WLR: ít nhất 3 M15 đóng trên WLR: +1; dưới: −1; còn lại: 0.
   Điểm tạm cần cả 3/3; điểm cuối cần ít nhất 3/4.
   Dùng chính WLR giá M15 của chart, được fit trên 50 nến trước mỗi M15.
2. Dốc WLR: (WLR tại M15 cuối − WLR tại M15 đầu H1) / ATR14 trước H1.
   Lớn hơn +0,15: +1; nhỏ hơn −0,15: −1; còn lại: 0.
3. Random walk: lấy độ lớn 64 log-return M15 liên tục trước H1,
   bootstrap 512 đường, mỗi đường 3 bước cho điểm tạm hoặc 4 bước cho điểm cuối,
   với dấu ± cân bằng, xuất phát từ giá mở H1. Close M15 đã đóng cuối cùng
   > P80: +1; < P20: −1; còn lại: 0.
   Seed cố định theo thời gian H1. Không dùng return trong H1 để dựng biên,
   không ép đường đi qua close thực. Đây là mô hình tham chiếu thử nghiệm.
   **Thưởng thuận chiều:** RW +1 và dốc WLR tăng hoặc hộp H1 xanh: thêm +1.
   RW −1 và dốc WLR giảm hoặc hộp H1 đỏ: thêm −1. Khớp cả hai vẫn chỉ thưởng
   một lần. Dốc WLR dùng cùng ngưỡng ±0,15 ATR ở mục 2; WLR phẳng không khớp.
   Close nằm giữa hoặc đúng P20/P80 có RW 0, không thưởng. Thiếu RW không thưởng.
   Với điểm tạm 3/4, chỉ xét dốc WLR của 3 nến đóng, chưa xét màu H1 vì màu
   preview có thể dùng nến thứ tư đang chạy. Màu chỉ đủ điều kiện khi H1 khóa.
4. Volume Delta × Taker NF: cộng 3 hoặc 4 giá trị đã đóng của SPY ΔV = sign(close−open)×V/SMA20(V)
   và C Taker NF (SPY+QQQ). Cùng dương: +1; cùng âm: −1; còn lại: 0.
   Không coi Volume Delta là chênh lệch volume taker thực.
5. OI xác nhận: hướng giá H1 phải cùng hướng thành phần 4, tổng ΔOI H1 > 0,
   có ít nhất 2 M15 OI tăng đồng thuận theo đúng bộ lọc nến OI,
   và các nến này chiếm ít nhất 60% tổng |ΔOI| của 3 hoặc 4 nến đã đóng. Khi đạt, +1 cho tăng,
   −1 cho giảm; không đạt: 0. Bộ lọc cố định P62 của 10 |ΔOI| trước mỗi M15,
   có lọc pin bar. OI giảm không tự nhận là mở Long/Short và không cộng điểm hướng.
   Histogram OI và nến OI chung nguồn nên chỉ tính một lần.

## Thiếu dữ liệu và khóa điểm

- Sau 3 M15 liên tục đóng kể từ đầu H1: trạng thái `PREVIEW`, chỉ tính 3 nến này.
  Nến thứ tư đang chạy không ảnh hưởng điểm, WLR, NF, ΔV hay OI được dùng.
  Dốc WLR dùng từ nến đầu đến nến đóng thứ ba, giữ ngưỡng ±0,15 ATR.
- Sau nến thứ tư đóng, tính lại đủ 4 nến và khóa khi không thiếu thành phần,
  trạng thái màu `preview=false`. Điểm tạm có thể khác điểm cuối.
- Thiếu thành phần: tổng chỉ cộng phần biết, đánh dấu `*`, không phóng lên ±5.
  Điểm thưởng vẫn được tính khi đủ điều kiện từ dữ liệu có sẵn; thiếu OI vẫn
  ghi `*` dù tổng có thể đạt ±5. Đây không phải điểm đầy đủ khi còn thành phần thiếu.
  Thiếu cả giá: hiển thị `—*`. Tooltip liệt kê phần thiếu, phân biệt với điểm 0.
- Hộp đã khóa nhưng OI chưa đủ thì điểm còn chờ dữ liệu; cập nhật đến khi đủ
  rồi lưu điểm hoàn chỉnh trong bộ nhớ trình duyệt, tối đa 512 H1.
- Điểm đầy đủ đã lưu không đổi khi nến tương lai hoặc dữ liệu OI mới tới.
  Khi không lưu được cache, phép tính cố định cửa sổ và seed vẫn cho kết quả tái lập
  trên cùng dữ liệu đầu vào. Xóa cache hoặc sửa dữ liệu nguồn có thể thay đổi bản tái tính.
- Công thức v2 dùng phiên bản và khóa cache riêng. Điểm v1 không được dùng lại
  thành điểm v2; các hộp được tính lại theo công thức mới khi có dữ liệu nguồn.
- Không chấm H4 thành H1: overlay này chỉ hiện SPY M15. Không đổi màu hộp H1 gốc.
- Cột có viền vàng khi dấu điểm xung đột với màu hộp; đây không phải xác nhận đảo chiều.

Điểm thưởng là tăng trọng số cho sự đồng thuận, không phải bằng chứng độc lập:
WLR, màu hộp và RW đều có liên hệ với giá. Điểm không phải xác suất
và chưa được xác thực hiệu quả giao dịch.


