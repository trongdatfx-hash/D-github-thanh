# KBTT Web

Giao diện web cho quy trình: upload Excel bệnh nhân → kiểm tra → bổ sung → gửi KBTT.

## Kiến trúc
- GitHub Pages: giao diện HTML/CSS/JS.
- Backend Python: dùng lại `kbtt_convert.py` + `kbtt_api.py`.
- Tuyệt đối không đưa `KBTT_USER`/`KBTT_PASS` vào JavaScript hoặc repository công khai.

GitHub Pages là hosting tĩnh và không chạy Python/PHP phía server. Vì vậy bước gửi API KBTT cần một backend riêng. 

## Bước tiếp theo
Nối POST /api/analyze và POST /api/register vào backend Python hiện có.
