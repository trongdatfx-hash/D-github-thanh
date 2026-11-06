# Gửi mẫu vào chat — cấu trúc M15

**Chế độ hiện tại đã chuyển sang phân tích trong cuộc chat/nhóm ChatGPT đang dùng.**
Nút **Gửi mẫu vào chat → Sao chép mẫu**, rồi quay lại chat, dán và gửi.
Không cần API key hoặc máy chủ. Nút không tự gửi tin và không tự chọn model ChatGPT.
Mỗi lần mở nút tạo một mẫu mới nếu pivot chưa từng được lưu; cùng pivot là cập nhật.
Giới hạn 3 mẫu mới/ngày New York, gộp SPY/QQQ, dùng bộ nhớ trình duyệt 90 ngày
và Web Locks để tránh nhiều tab cùng vượt giới hạn. Thiết bị khác chưa đồng bộ;
xóa dữ liệu trình duyệt cũng xóa bộ nhớ và quota. Không có học nền khi đóng web.
Kết quả 8 nến được cập nhật khi web mở lại và có đủ nến tương ứng, rồi gửi kèm
gói dữ liệu lần sau để ChatGPT đối chiếu. Bộ nhớ không huấn luyện lại trọng số GPT.

Phần API dưới đây là phương án cũ, đã ngừng sử dụng trong nút trên chart.

## Phương án API cũ (chỉ tham khảo)

Chart có nút **GPT · Mẫu hiện tại** ở góc trái trên, hoạt động cả Full chart.
GPT-5.6 Terra (`gpt-5.6-terra`, Responses API, reasoning low) là mặc định;
đổi bằng biến máy chủ `OPENAI_MODEL`. Không có khóa OpenAI trong HTML/JS.

## Kích hoạt API

GitHub Pages chỉ phục vụ tệp tĩnh, không chạy được máy chủ giữ bí mật.
Thư mục này cung cấp Cloudflare Worker và Durable Object SQLite để giữ bộ nhớ,
giới hạn ngày và khóa OpenAI. Cần tài khoản Cloudflare hỗ trợ Durable Objects,
tài khoản OpenAI API có số dư, Node.js và Wrangler. Chạy từ thư mục này:

```powershell
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ANALYST_TOKEN
npx wrangler deploy
```

Nhập khóa qua lời nhắc của Wrangler; không ghi vào repo, không gửi vào chat.
`ANALYST_TOKEN` là mật khẩu riêng dài và ngẫu nhiên do chủ web tự đặt,
khác khóa OpenAI. Chép URL HTTPS Worker được trả về, mở nút GPT trên chart,
mở **Kết nối GPT**, điền API URL và mã truy cập máy chủ, bấm Lưu kết nối.
URL được nhớ trên trình duyệt; mã truy cập chỉ nhớ trong phiên tab.
Mỗi thiết bị cần nhập mã truy cập riêng. Có thể đặt URL công khai trong
`netflow-stumpy/gpt-pattern-config.mjs`; tuyệt đối không đặt khóa/mã truy cập ở đó.

## Cách học và giới hạn

- Tự gửi `/observe` khoảng 20 giây/lần khi chart đang mở, LIVE và khung M15;
  chỉ xử lý lại khi có nến đóng mới. Không gọi GPT tự động cho việc ghi mẫu.
- Tối đa **3 mẫu mới/ngày America/New_York**, gộp SPYUSDT và QQQUSDT,
  kiểm soát bằng transaction trong một Durable Object chung cho mọi tab/thiết bị.
- Pivot strict 2 nến trái + 2 nến phải, loại outside bar có cả đỉnh và đáy;
  cùng pivot chỉ lưu một lần. Chỉ dùng nến đã đóng và chuỗi liên tục.
- Đặc trưng: HH/HL/LH/LL, độ dốc/ATR14, R², độ rộng/ATR, dốc biên trên/dưới,
  tỷ lệ thân/râu, volume tương đối và taker NetFlow/quote volume (khi có).
  Nến hiện hành và dữ liệu thiếu không được nội suy. Chưa tích hợp WLR/SPY V/OI.
- Mẫu kế tiếp cùng mã cần nằm ngoài cả cấu trúc và cửa sổ kết quả 8 nến của mẫu trước.
  Vì vậy có thể có ít hơn 3 mẫu/ngày; không cố lấp đủ quota bằng mẫu trùng nhau.
- Kết quả sau 8 nến M15 liên tục được chốt khi lần gửi tiếp theo có đủ nến:
  return/ATR, MFE/ATR, MAE/ATR và hướng. Khoảng nghỉ hoặc thiếu nến giữ pending;
  không coi pending là thất bại. Giữ tối đa 1.000 mẫu mới nhất.
- Khi hỏi, lấy tối đa 30 mẫu cùng mã có khoảng cách vector chuẩn hóa ≤0,65,
  đã biết kết quả trước thời điểm hỏi và không chồng lấn cấu trúc hiện tại.
  Dưới 20 mẫu: WAIT, không công bố tỷ lệ dự báo. Từ 20 mẫu: chỉ thống kê mô tả,
  có khoảng Wilson 95% cho tỷ lệ tăng. Đây chưa phải xác thực khả năng giao dịch.
- GPT nhận dữ liệu OHLC và đặc trưng của tối đa 128 nến đóng cuối trong vùng
  chart nhìn thấy, không nhận ảnh chụp màn hình. Cuộn về quá khứ thì phân tích
  đúng vùng lịch sử và loại các kết quả chưa thể biết vào thời điểm đó.
- Trả lời trùng dữ liệu được cache. Giới hạn bảo vệ chi phí: 20 lượt gọi OpenAI
  mới/ngày NY; lượt lỗi cũng chiếm một lượt. Giới hạn này tách khỏi 3 mẫu học.
- Bộ nhớ nằm ở Worker, không mất khi xóa cache chart. Không fine-tune GPT.
  Chỉ tích lũy khi web đang mở và kết nối API. Muốn học khi đóng web cần Collector
  gửi cùng payload `POST /observe` sau mỗi nến M15 đóng; bản này chưa triển khai Collector đó.
- Xác thực Bearer token + CORS đúng origin GitHub Pages. Chủ token có quyền đọc/
  ghi bộ nhớ qua API. Không dùng `OPENAI_API_KEY` làm token của trình duyệt.

## Kiểm tra

Từ gốc repository:

```powershell
node --test gpt-pattern-api/pattern.test.mjs
```

Không có secret trong môi trường làm việc thì chưa thể kiểm thử OpenAI thật
hoặc xác nhận Worker đã được triển khai. Sau deploy: kiểm tra lưu 1 mẫu,
mở nhiều tab vẫn không quá 3, thử sai token, phân tích chart lịch sử,
thu hẹp vùng xem, chuyển M5/H1, ngắt API và thử lại.
