# XAUUSDT NetFlow ML

Bản sao độc lập của trang NetFlow DVP hiện tại, đặt tại `/netflow-ml/`.

- Nguồn thị trường duy nhất: Binance Futures `XAUUSDT`.
- Hai khóa SPYUSDT/QQQUSDT còn tồn tại bên trong chỉ là khe tương thích cho các mô-đun giao diện cũ; cả hai nhận cùng dữ liệu XAUUSDT và không phát sinh request SPY/QQQ.
- Composite nhận một lần NetFlow XAUUSDT, không cộng trùng.
- Các report/mô hình đã huấn luyện từ SPY/QQQ không được mang sang. Các ô dự báo phụ thuộc model sẽ giữ WAIT cho tới khi có model XAU riêng.
