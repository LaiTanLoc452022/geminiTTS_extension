# YouTube Live Translate · Continuous audio

Extension Chrome 116+ bằng TypeScript. Thu audio YouTube, gửi trực tiếp tới **Gemini 3.5 Live Translate** và phát giọng dịch tiếng Việt song song. Không có chức năng phụ đề.

## Cài đặt

1. Node.js 22+: `npm.cmd install`, `npm.cmd run check`, `npm.cmd test`, `npm.cmd run build`.
2. Mở `chrome://extensions`, bật Developer mode, Load unpacked thư mục `dist`.
3. Chạy `npm.cmd run server`, mở **http://127.0.0.1:8787**. Nhập Gemini API key và ID extension lấy từ chrome://extensions, bấm **Lưu cấu hình**. Backend tự tạo/cập nhật `.env`; không commit/chia sẻ file này. Để trống key khi lưu lần sau sẽ giữ key hiện có. Key đã lưu không được trả lại trình duyệt.
4. Mở video YouTube và bấm Bắt đầu trong popup. Bấm Dừng để đóng capture, kết nối và hủy audio đang phát/chờ. Không cần mã ghép nối.

Sau nâng cấp: khởi động lại backend, Reload extension và tải lại tab YouTube. macOS/Linux dùng `npm` thay `npm.cmd`.

Trang quản lý backend gồm trạng thái sẵn sàng, form cấu hình và tối đa 100 dòng log mới nhất cùng tổng token/USD của các dòng hiển thị. Cấu hình lưu trên web áp dụng ngay cho kết nối tiếp theo, không ngắt phiên đang chạy. Sửa `.env` bằng trình soạn thảo vẫn cần khởi động lại server. Trang chỉ phục vụ trên loopback; kiểm tra Host/Origin và token chống CSRF cho thao tác lưu, không có mã ghép nối phải nhập. Nút lưu chỉ xác thực định dạng/cấu hình, không gọi Gemini có tính phí để kiểm tra key/quota.

Nếu không nghe giọng dịch, kiểm tra `Chunk audio Gemini`: nếu bằng 0, chưa nhận audio model, cần kiểm tra tín hiệu nguồn và quyền truy cập model. Nếu chunk tăng nhưng vẫn im lặng, kiểm tra trạng thái bộ phát, âm lượng và thiết bị đầu ra. Gửi các dòng trạng thái popup để chẩn đoán; không gửi API key.

## Truyền liên tục

Audio nguồn → PCM16 mono 16 kHz, mỗi chunk 100 ms → `sendRealtimeInput` ngay khi thu được. Model trả audio qua mọi `modelTurn.parts[].inlineData` → PCM16 24 kHz → lịch phát liên tiếp trên AudioContext riêng. Gửi và nhận độc lập; không đợi `turnComplete`, không chia lượt 5 giây, không có hàng đợi chờ model 15 giây, không tự dừng sau 8 phút. Âm thanh gốc YouTube được nối ra loa song song với audio Gemini trên hai audio graph riêng; giọng dịch không được nối ngược vào audio nguồn gửi model.

Live Translate dùng xử lý luồng dịch chuyên dụng, không dùng VAD/lượt hội thoại của Flash Live. `translationConfig.targetLanguageCode: vi` chọn đích tiếng Việt. `echoTargetLanguage: true` yêu cầu trả audio cả khi nguồn đã là tiếng Việt; nếu false thì nguồn tiếng Việt có thể không có đầu ra. Không bật input/output transcription. Độ trễ và chất lượng vẫn phụ thuộc tín hiệu nguồn, model và mạng; không bảo đảm audio không có khoảng nghỉ.

Không gửi các cấu hình agent như context compression trong setup Live Translate. Khi goAway/ngắt socket/lỗi gửi, ứng dụng xin token mới và kết nối lại tự động (chờ 10 giây, tối đa 3 lần lỗi liên tiếp). Đây là kết nối mới, chưa phục hồi ngữ cảnh bằng session-resumption handle. Có thể có khoảng ngắt hoặc mất phần phản hồi đang sinh khi đổi kết nối.

Chỉ trong thời gian mất kết nối, giữ tối đa 30 giây audio nguồn để gửi sau khi kết nối lại. Không thể giữ vô hạn khi mạng lỗi; vượt giới hạn hoặc không kết nối lại được sẽ báo lỗi và dừng. Không có bộ hẹn giờ dừng trong điều kiện hoạt động bình thường; đóng tab/lỗi thiết bị/API/mạng vẫn có thể kết thúc phiên.

## Adaptive Audio Buffer

Chunk nguồn giữ nguyên 100 ms. Bộ phát bắt đầu với khoảng đệm 150 ms, giảm dần khi ổn định về 100–250 ms. Dùng độ trễ giữa các chunk và số lần hụt đệm để tăng tạm mục tiêu, tối đa 800 ms. Khoảng đệm mới chỉ áp dụng lúc bắt đầu/hụt đệm; không chèn im lặng giữa các chunk đang nối tiếp bình thường. Sự kiện kết thúc lượt và khoảng nghỉ dài được tách khỏi ước lượng jitter; thời gian model sinh và thời gian mạng không thể phân biệt hoàn toàn bằng phía client.

Khi tổng audio chờ phát vượt 3 giây, ưu tiên bắt kịp: hủy audio cũ và giữ khoảng 1 giây mới nhất, có thể lấy phần cuối chunk quá dài. Điều này có thể cắt câu/bỏ lời dịch hoặc tạo điểm nối nghe được. Không tua video, không đổi tốc độ giọng và không đồng bộ theo timestamp nguồn; chỉ giảm backlog ở bộ phát. Popup hiển thị đệm mục tiêu, hụt đệm và số giây audio cũ đã bỏ. Các ngưỡng nằm trong `src/adaptive-buffer.ts`.

## Model, tham số và phí

Live Translate chưa công bố tùy chọn giọng đặt tên qua speechConfig/voiceName. Giọng dịch do model tự tạo theo nguồn; giao diện không cung cấp lựa chọn giọng. Không gửi các tên giọng của model hội thoại/TTS sang API này. Muốn chọn giọng đặt tên cần dùng model khác hoặc pipeline dịch → TTS; không được tự động thay model vì sẽ đổi cách dịch liên tục, độ trễ và phí.

`gemini-3.5-live-translate-preview`, `@google/genai` 3.1.0+, API v1beta, chỉ AUDIO. Live Translate không hỗ trợ system instructions hoặc thinking. Chủ đích bỏ prompt, temperature, maxOutputTokens, VAD và NO_INTERRUPTION của agent; dùng cấu hình dịch chính thức thay vì ép model hội thoại đóng vai phiên dịch. Backend và client dùng chung `liveConfig()` để khóa ngôn ngữ/model trong ephemeral token.

Popup báo usage snapshot và ước tính của kết nối hiện tại, reset khi mở kết nối mới; không cộng dồn toàn bộ lịch sử reconnect. Giá USD/triệu audio token kiểm tra 11/11/2026: input **3.50**, output **21.00** (`src/usage.ts`). Modality khác không gán giá của model cũ, được đánh dấu chưa phân loại. Không phải hóa đơn; có thể thiếu usage cuối khi ngắt mạng, chưa tính thuế/free tier. Chi phí tiếp tục phát sinh tới khi dừng, kể cả audio im lặng. Không có trần USD cưỡng chế.

## Bảo mật và timeout

Key dài hạn chỉ ở backend local 127.0.0.1:8787. Bản dùng cá nhân không dùng pairing secret; backend kiểm tra Origin đúng ID extension và giới hạn cấp token mỗi 10 giây. Origin không phải xác thực chống ứng dụng khác trên cùng máy; đây là backend cá nhân local. Token một lần, mở phiên trong 60 giây, hết hạn sau 30 phút, khóa model/config. Mỗi reconnect xin token mới; hạn token không phải timer dừng app. Không log key/audio. Triển khai công khai cần HTTPS, đăng nhập và quota riêng.

Timeout backend 10 giây, token fetch 12 giây, connect 15 giây; không còn timeout chờ model 25 giây vốn không phù hợp audio liên tục hoặc video im lặng. HTTP 403: kiểm tra ID extension; 429: giới hạn cấp token/quota; 502: key/model/quota/mạng.

## Nhật ký từng kết nối API

File text UTF-8 **`logs/api-sessions.jsonl`**, một đối tượng JSON trên mỗi dòng, tự tạo tại thư mục dự án. Không chứa API key, pairing secret, ephemeral token, audio hoặc transcript. `logs/` được bỏ qua bởi Git.

Mỗi kết nối API ghi một dòng khi kết thúc, chỉ gồm `time` (dd/MM/yyyy HH:mm:ss, giờ Việt Nam UTC+7), `totalTokens` và `estimatedUsd`. Sau khi lưu thành công, cùng dòng JSON được in ra terminal đang chạy `npm.cmd run server`. Không còn các bản ghi checkpoint hay cấu hình chi tiết.

Một lần bấm Bắt đầu có thể có nhiều dòng nếu reconnect. Số liệu dùng usage gần nhất trước khi kết thúc, chỉ là ước tính, không phải hóa đơn. Nếu Chrome/backend bị đóng đột ngột có thể mất bản ghi. Giá 0 có thể do chưa nhận usage, không khẳng định miễn phí. Không tự xóa/luân chuyển file log.

```json
{"time":"11/11/2026 17:00:00","totalTokens":1234,"estimatedUsd":0.012345}
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
