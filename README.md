# YouTube Live Translate · Continuous audio

Extension Chrome 116+ bằng TypeScript. Thu audio YouTube, gửi trực tiếp tới **Gemini 3.5 Live Translate** và phát giọng dịch tiếng Việt song song. Không có chức năng phụ đề.

## Cài đặt

1. Node.js 22+: `npm.cmd install`, `npm.cmd run check`, `npm.cmd test`, `npm.cmd run build`.
2. Mở `chrome://extensions`, bật Developer mode, Load unpacked thư mục `dist`.
3. Sao chép `.env.example` thành `.env` nếu chưa có; điền API key, ID extension và mã ghép nối ngẫu nhiên ít nhất 32 ký tự. Không commit/chia sẻ `.env`.
4. Chạy `npm.cmd run server`. Mở video YouTube, nhập mã ghép nối trong popup rồi bấm Bắt đầu. Bấm Dừng để đóng capture, kết nối và hủy audio đang phát/chờ.

Sau nâng cấp: khởi động lại backend, Reload extension và tải lại tab YouTube. macOS/Linux dùng `npm` thay `npm.cmd`.

Nếu không nghe giọng dịch: bấm **Kiểm tra loa · Không gọi API**. Có tiếng bíp nghĩa là đường phát hoạt động. Kiểm tra `Chunk audio Gemini`: nếu bằng 0, chưa nhận audio model, cần kiểm tra tín hiệu nguồn và quyền truy cập model mới. Nếu chunk tăng nhưng vẫn im lặng, kiểm tra trạng thái bộ phát, âm lượng và thiết bị đầu ra. Gửi các dòng trạng thái popup để chẩn đoán; không gửi key hoặc mã ghép nối.

## Truyền liên tục

Audio nguồn → PCM16 mono 16 kHz, mỗi chunk 100 ms → `sendRealtimeInput` ngay khi thu được. Model trả audio qua mọi `modelTurn.parts[].inlineData` → PCM16 24 kHz → lịch phát liên tiếp trên AudioContext riêng. Gửi và nhận độc lập; không đợi `turnComplete`, không chia lượt 5 giây, không có hàng đợi chờ model 15 giây, không tự dừng sau 8 phút. Âm thanh gốc YouTube được nối ra loa song song với audio Gemini trên hai audio graph riêng; giọng dịch không được nối ngược vào audio nguồn gửi model.

Live Translate dùng xử lý luồng dịch chuyên dụng, không dùng VAD/lượt hội thoại của Flash Live. `translationConfig.targetLanguageCode: vi` chọn đích tiếng Việt. `echoTargetLanguage: true` yêu cầu trả audio cả khi nguồn đã là tiếng Việt; nếu false thì nguồn tiếng Việt có thể không có đầu ra. Không bật input/output transcription. Độ trễ và chất lượng vẫn phụ thuộc tín hiệu nguồn, model và mạng; không bảo đảm audio không có khoảng nghỉ.

Không gửi các cấu hình agent như context compression trong setup Live Translate. Khi goAway/ngắt socket/lỗi gửi, ứng dụng xin token mới và kết nối lại tự động (chờ 10 giây, tối đa 3 lần lỗi liên tiếp). Đây là kết nối mới, chưa phục hồi ngữ cảnh bằng session-resumption handle. Có thể có khoảng ngắt hoặc mất phần phản hồi đang sinh khi đổi kết nối.

Chỉ trong thời gian mất kết nối, giữ tối đa 30 giây audio nguồn để gửi sau khi kết nối lại. Không thể giữ vô hạn khi mạng lỗi; vượt giới hạn hoặc không kết nối lại được sẽ báo lỗi và dừng. Hàng đợi phát audio tối đa 20 giây để tránh tăng bộ nhớ vô hạn. Không có bộ hẹn giờ dừng trong điều kiện hoạt động bình thường; đóng tab/lỗi thiết bị/API/mạng vẫn có thể kết thúc phiên.

## Model, tham số và phí

`gemini-3.5-live-translate-preview`, `@google/genai` 3.1.0+, API v1beta, chỉ AUDIO. Live Translate không hỗ trợ system instructions hoặc thinking. Chủ đích bỏ prompt, temperature, maxOutputTokens, VAD và NO_INTERRUPTION của agent; dùng cấu hình dịch chính thức thay vì ép model hội thoại đóng vai phiên dịch. Backend và client dùng chung `liveConfig()` để khóa ngôn ngữ/model trong ephemeral token.

Popup báo usage snapshot và ước tính của kết nối hiện tại, reset khi mở kết nối mới; không cộng dồn toàn bộ lịch sử reconnect. Giá USD/triệu audio token kiểm tra 11/11/2026: input **3.50**, output **21.00** (`src/usage.ts`). Modality khác không gán giá của model cũ, được đánh dấu chưa phân loại. Không phải hóa đơn; có thể thiếu usage cuối khi ngắt mạng, chưa tính thuế/free tier. Chi phí tiếp tục phát sinh tới khi dừng, kể cả audio im lặng. Không có trần USD cưỡng chế.

## Bảo mật và timeout

Key dài hạn chỉ ở backend local 127.0.0.1:8787. Backend kiểm tra Origin ID extension và Bearer pairing secret, giới hạn cấp token mỗi 10 giây. Token một lần, mở phiên trong 60 giây, hết hạn sau 30 phút, khóa model/config. Mỗi reconnect xin token mới; hạn token không phải timer dừng app. Secret chỉ lưu Chrome session storage. Không log key/audio. Backend dành cho một người trên máy; triển khai công khai cần HTTPS, đăng nhập và quota riêng.

Timeout backend 10 giây, token fetch 12 giây, connect 15 giây; không còn timeout chờ model 25 giây vốn không phù hợp audio liên tục hoặc video im lặng. HTTP 401/403: kiểm tra ID/secret; 429: giới hạn cấp token/quota; 502: key/model/quota/mạng.

## Nhật ký từng kết nối API

File text UTF-8 **`logs/api-sessions.jsonl`**, một đối tượng JSON trên mỗi dòng, tự tạo tại thư mục dự án. Không chứa API key, pairing secret, ephemeral token, audio hoặc transcript. `logs/` được bỏ qua bởi Git.

Mỗi kết nối API ghi một dòng khi kết thúc, chỉ gồm `time` (UTC ISO 8601), `totalTokens` và `estimatedUsd`. Không còn các bản ghi checkpoint hay cấu hình chi tiết.

Một lần bấm Bắt đầu có thể có nhiều dòng nếu reconnect. Số liệu dùng usage gần nhất trước khi kết thúc, chỉ là ước tính, không phải hóa đơn. Nếu Chrome/backend bị đóng đột ngột có thể mất bản ghi. Giá 0 có thể do chưa nhận usage, không khẳng định miễn phí. Không tự xóa/luân chuyển file log.

```json
{"time":"2026-11-11T10:00:00.000Z","totalTokens":1234,"estimatedUsd":0.012345}
```

Xem các bản ghi gần nhất bằng PowerShell:

```powershell
Get-Content logs/api-sessions.jsonl -Tail 10 | ForEach-Object { $_ | ConvertFrom-Json } | Format-List
```

## Mã nguồn và kiểm tra

- `capture.ts`: tài nguyên thu âm; `public/pcm-worklet.js`: downmix và PCM.
- `connection.ts`: cấp token và mở/hủy kết nối.
- `live-stream.ts`: gửi liên tục, reconnect và bộ đệm khi mất kết nối.
- `audio.ts`, `pcm.ts`: phát/giải mã/mã hóa audio.
- `offscreen.ts`: điều phối; `background.ts`: Chrome API; `popup.ts`: giao diện.

Chạy `npm.cmd run check`, `npm.cmd test`, `npm.cmd run build`. Tests không gọi API tính phí: kiểm tra gửi tiếp trong lúc model trả audio, không chờ turnComplete, reconnect/hủy, PCM, capture, lịch phát, tính giá và SDK serialize translationConfig vào token request bằng HTTP giả lập. Cần Chrome/API key thật có quyền truy cập model mới để xác nhận chất lượng/độ trễ, hoạt động nhiều phút và goAway thực tế. Tua video nên Dừng/Bắt đầu để xóa ngữ cảnh.

Nguồn: [Live Translation](https://ai.google.dev/gemini-api/docs/live-api/live-translate), [ephemeral token](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-live-translate-preview), [giá](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-live-translate-preview).
