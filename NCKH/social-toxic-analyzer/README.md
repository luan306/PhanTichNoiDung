# Lăng Kính — Tool phân tích hành vi tiêu cực trên mạng xã hội của học sinh, sinh viên

Web app hỗ trợ giáo viên / nhà trường phát hiện sớm: bắt nạt qua mạng, ngôn từ độc hại,
kỳ thị/phân biệt đối xử, đe dọa, và dấu hiệu nguy cơ tâm lý (để cảnh báo, KHÔNG thay thế
chuyên viên tâm lý).

## Cấu trúc dự án

```
social-toxic-analyzer/
├── backend/
│   ├── server.js         # Express API
│   ├── detector.js        # Engine phân tích (chấm điểm, phân loại)
│   ├── dictionaries.json  # Từ điển từ khoá theo nhóm hành vi (CẦN BỔ SUNG)
│   ├── db.js               # Kết nối & truy vấn MySQL
│   ├── schema.sql          # Schema tạo bảng MySQL
│   └── package.json
└── frontend/
    └── index.html         # Dashboard React (chạy trực tiếp bằng trình duyệt, không cần build)
```

## 1. Cài đặt backend

```bash
cd backend
npm install
```

Tạo database MySQL:

```bash
mysql -u root -p < schema.sql
```

Tạo file `.env` (hoặc export biến môi trường) nếu MySQL không dùng cấu hình mặc định:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=social_behavior_analyzer
PORT=4000
```

Chạy server:

```bash
npm start
# API chạy tại http://localhost:4000
```

## 2. Chạy frontend

Mở trực tiếp `frontend/index.html` bằng trình duyệt (double click), hoặc serve qua bất kỳ static
server nào (vd: `npx serve frontend`). Nếu backend không chạy ở `localhost:4000`, sửa biến
`API_BASE` ở đầu file `index.html`, hoặc set `window.API_BASE = '...'` trước khi React app khởi tạo.

## 3. Các chức năng chính

- **Phân tích nhanh**: dán 1 đoạn bình luận/bài đăng, xem điểm mức độ, nhóm hành vi vi phạm, cụm từ khớp.
- **Tải lên hàng loạt**: upload file CSV (cột bắt buộc `text`, tuỳ chọn `author`, `timestamp`) —
  dùng khi có dữ liệu xuất từ nhóm lớp, group chat, hoặc form khảo sát.
- **Thống kê**: dashboard tổng quan (số lượt phân tích, số cảnh báo nguy cơ tâm lý, xu hướng
  14 ngày, phân bố theo mức độ nghiêm trọng) — dữ liệu lấy từ MySQL nên tồn tại lâu dài.

## 4. Tích hợp Facebook (tự động lấy bình luận từ Page)

Tính năng ở tab "Đồng bộ Facebook" gọi Facebook Graph API để lấy bài viết + bình luận từ
**Facebook Page** (Fanpage) mà bạn là admin, sau đó phân tích tự động — không cần export CSV thủ công.

**Giới hạn quan trọng:** chỉ hỗ trợ **Page**, KHÔNG hỗ trợ **Group**. Từ sau các thay đổi
chính sách quyền riêng tư của Meta (2018+), quyền đọc bài viết/bình luận trong Group
(`groups_access_member_info`) gần như không còn được cấp cho ứng dụng thông thường nữa,
chỉ dành cho số ít đối tác được duyệt riêng. Nếu lớp bạn chỉ có Group (không có Page), tạm
thời vẫn phải export dữ liệu thủ công rồi dùng tab "Tải lên hàng loạt".

### Cách lấy Page ID và Access Token

1. Vào https://developers.facebook.com/apps → **Create App** → chọn loại "Business"
2. Trong App vừa tạo, vào mục **Graph API Explorer** (developers.facebook.com/tools/explorer)
3. Ở ô "User or Page", chọn **Page** của bạn (Page phải đã được thêm vào App qua mục Sản phẩm >
   Facebook Login for Business hoặc Page đã cấp quyền quản trị cho tài khoản bạn đang dùng)
4. Ở ô quyền (Permissions), thêm: `pages_read_engagement`, `pages_show_list`
5. Bấm **Generate Access Token**, đăng nhập và đồng ý cấp quyền
6. Token vừa tạo là **User Access Token**, thời hạn ngắn (~1-2 giờ) — cần đổi sang
   **Page Access Token dài hạn**:
   - Gọi: `GET /me/accounts?access_token=<user_access_token>` → lấy `access_token` tương ứng
     với Page trong kết quả trả về, đây chính là **Page Access Token**
   - Page Access Token loại này thường không hết hạn nếu User Access Token gốc là long-lived
     token (đổi qua endpoint `/oauth/access_token` với `grant_type=fb_exchange_token`)
7. Page ID lấy tại: vào Page → **Cài đặt & quyền riêng tư > Cài đặt > Thông tin Page**, hoặc
   gọi `GET /me?access_token=<page_access_token>` để lấy `id`

### Cấu hình

Điền vào file `.env` (copy từ `.env.example`):
```
FB_PAGE_ID=1234567890
FB_PAGE_ACCESS_TOKEN=EAAxxxxxxxxxxxxx
```

Sau đó chỉ cần vào tab "Đồng bộ Facebook" trên giao diện và bấm "Đồng bộ & phân tích" —
không cần nhập lại Page ID/Token mỗi lần (hệ thống tự lấy từ `.env`). Nếu muốn phân tích
Page khác không cấu hình sẵn, có thể nhập trực tiếp vào 2 ô trên giao diện.

### Lưu ý về quyền riêng tư khi dùng tính năng này

Bình luận công khai trên Page vẫn là dữ liệu công khai, nhưng vì đối tượng là học sinh
(có thể là trẻ vị thành niên), nên: thông báo rõ cho học sinh/phụ huynh biết Page của lớp
đang được rà soát nội dung tự động, và không dùng tên/dữ liệu thu thập được cho mục đích
nào khác ngoài phát hiện sớm & hỗ trợ tâm lý.

## 5. QUAN TRỌNG — về từ điển từ khoá (`dictionaries.json`)

File này chỉ chứa **một bộ từ khoá khởi điểm mang tính ví dụ**, không đầy đủ. Tiếng lóng, cách
né lọc và ngôn ngữ học sinh dùng thay đổi liên tục theo thời gian và vùng miền. Để tool thực sự
hữu ích, bạn cần:

1. Tự bổ sung từ khoá thực tế thu thập được (không nên chia sẻ công khai danh sách này).
2. Cân nhắc thêm bước duyệt thủ công (human review) cho các trường hợp điểm cao trước khi
   xử lý kỷ luật — hệ thống dựa trên từ khoá luôn có tỷ lệ báo sai (false positive), đặc biệt
   với mỉa mai, đùa giỡn giữa bạn bè.
3. Với nhóm `nguy_co_tam_ly` (dấu hiệu tự hại/tâm lý): đây là tính năng CẢNH BÁO ĐỂ CON NGƯỜI
   CAN THIỆP, không phải công cụ chẩn đoán. Khi có cờ cảnh báo, quy trình nên là liên hệ phụ
   huynh + chuyên viên tâm lý học đường, không tự ý xử lý.

## 6. Hướng mở rộng gợi ý

- Thêm xác thực đăng nhập (giáo viên/quản trị) trước khi xem dữ liệu — đây là dữ liệu nhạy cảm
  về học sinh, cần kiểm soát quyền truy cập chặt chẽ.
- Thêm bảng `students` để map `author` -> hồ sơ học sinh, phục vụ theo dõi lâu dài có kiểm soát.
- Đã có: đồng bộ tự động từ Facebook Page (xem mục 4). Có thể mở rộng thêm chạy tự động
  theo lịch (cron job) thay vì phải bấm nút thủ công mỗi lần.
- Thêm mô hình NLP (vd: PhoBERT fine-tune cho toxic comment tiếng Việt) để giảm báo sai so với
  cách chấm điểm theo từ khoá thuần tuý.

## 7. Lưu ý đạo đức & pháp lý

Đây là công cụ giám sát nội dung liên quan đến trẻ vị thành niên. Trước khi triển khai thực tế:
- Thông báo rõ với học sinh/phụ huynh về việc nội dung công khai/nhóm lớp có thể được rà soát.
- Không dùng để giám sát tin nhắn riêng tư cá nhân ngoài phạm vi được cho phép.
- Ưu tiên mục tiêu hỗ trợ và can thiệp sớm, không dùng kết quả như bằng chứng duy nhất để
  kỷ luật nặng học sinh.
