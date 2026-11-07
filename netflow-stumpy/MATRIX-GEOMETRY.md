# Trendline causal 50/50 dùng ma trận H1 — bản thử v1

**Phạm vi:** SPYUSDT M15. Công tắc **Trendline 50/50 · ma trận H1** trong Cài đặt chart bật mặc định. Tắt công tắc để dùng bộ chọn 50/50 cũ. Không thay ma trận, điểm hộp, màu H1, WLR, HT/KC REV6 hoặc các khung/mã khác.

## Nguồn và thời điểm

- Dùng cùng `scoreH1Box` và `buildH1Matrix` với nhãn/điểm hộp: WLR, random walk, ΔV SPY × C Taker NF SPY+QQQ, OI P62. Ngưỡng OI cố định P62 như điểm hộp; phổ OI theo ngày không tham gia.
- Chỉ hộp đủ 4 M15 đóng. Hộp preview 3/4 bị loại. Mỗi bước replay chỉ nhận hộp có `blockEnd < asOf` và `asOf` của điểm không vượt thời điểm hiện tại của bước đó. Nhóm H1 cũ qua khoảng trống không xác nhận phá.
- Số hộp và kích thước nhóm đi theo cài đặt ma trận 6–10 hộp. Hình học vẫn neo vào giá; màu hộp H1 đã khóa ưu tiên làm pivot. Khi thiếu pivot H1, bộ hình học giữ fallback M15 đã xác nhận.
- Không cộng tổng ±5, RW alignment và kết luận ma trận thành các phiếu độc lập. Điểm xếp hạng thử nghiệm: 80% điểm hình học gốc + 20% mức đồng chiều của các hàng ma trận. Trọng số trong phần ma trận: vị trí .25, dốc .20, ΔV×C Taker .25, OI .20, RW gốc .10. Đây là điểm ưu tiên, không phải xác suất.

## Hai nhóm line

- 50% giới hạn dành cho line hỗ trợ/kháng cự ứng viên breakout. Ví dụ giới hạn 4: tối đa 2 line ứng viên và 1 nêm = 2 biên. Thiếu ứng viên thì không bù quota sang nhóm kia.
- Nêm giữ điều kiện hình học hội tụ cũ, ít nhất hai đỉnh và hai đáy; hai biên đi cùng nhau. Không tách một biên để lấp chỗ trống.
- WATCH/theo dõi có thể tái khớp. Khi giá còn phía trong, cách biên tối đa .8 ATR và 8 M15 gần nhất cho thấy khoảng cách giảm ít nhất 20% hoặc range 4 nến cuối giảm ít nhất 20% so với 4 nến trước: chuyển ARMED/chờ phá. Hai biên nêm phải còn bao giá khi khóa.
- ARMED sao chép điểm neo và độ dốc; chỉ kéo dài theo phương trình cũ. Worker giữ khóa giữa các cập nhật, kể cả khi cửa sổ dữ liệu dịch chuyển hoặc OI được nạp bổ sung. Đổi mã/khung hoặc cấu hình bắt đầu phiên khóa mới. Tải lại trang xây lại lịch sử từ phần dữ liệu hiện có; không phải nhật ký tín hiệu live đã ghi bền vững.

## Phá, xác nhận và hết hạn

- Giá đóng ngoài biên .35 ATR ghi **Phá ↑/↓ · chờ xn**, kể cả dòng taker đang xung đột.
- Xác nhận dùng line đã khóa trên nến trước: hai đóng ngoài biên + điều kiện dòng/volume của detector hiện hành + nhóm ma trận mới nhất đúng hướng và đủ OI. Nhãn **Phá ↑/↓ · xn**; không gọi đây là xác suất. Nêm vẫn có nhánh breakout mạnh theo bộ lọc volume/range/thân nến cũ, nhưng cũng phải qua ma trận.
- Đóng trở lại sau phá được ghi **Phá giả** theo detector cũ, không cần bịa hướng vị thế OI.
- Line chờ phá hết hạn sau 96 M15; trạng thái phá/chờ xn được giữ tối đa 8 M15. Nêm hết hạn khi hai biên đã giao nhau.
- Khởi động replay tối đa 600 M15 với tối đa 200 nến làm nền hình học. Các cập nhật tiếp theo chỉ tiến phần nến mới trong worker. Chỉ giữ bốn thông báo gần nhất từ chính line của bộ chọn này.

## Kiểm tra

`node --test netflow-stumpy/tests/matrix-geometry.test.mjs netflow-stumpy/tests/geometry.test.mjs`

Bao phủ thời điểm khóa, loại preview, thiếu OI, taker xung đột, không đếm trùng điểm, quota và cặp nêm, giữ neo sau breakout, giữ khóa khi cửa sổ 800 nến dịch chuyển, loại dữ liệu tương lai, fixture thực và tắt/bật bộ chọn qua studies core. Chưa có kết luận cải thiện tỷ lệ dự báo.
