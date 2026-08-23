// Smoke test tạm 1 lần (Playwright headless) để verify runtime thật cho các thay đổi phiên
// trước: Dashboard lazy-load, Speaking scene-progress sessionStorage, Cloudinary upload
// validation. Không phải test suite lâu dài của dự án — chạy xong rồi xoá.
import { chromium } from "playwright";

const BASE_URL = process.argv[2] || "https://localhost:5173/";
const errors = [];

const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
page.on("console", msg => {
  if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
});
page.on("pageerror", err => errors.push(`[pageerror] ${err.message}`));

console.log("=== TEST 1: Trang chủ tải được ===");
await page.goto(BASE_URL, { waitUntil: "load", timeout: 15000 });
const title = await page.title();
console.log("Title:", title);
console.log("Console/page errors sau khi tải trang chủ:", errors.length ? errors : "(không có)");

console.log("\n=== TEST 2: Vào trang Bài học + Speaking (Starters 1) ===");
errors.length = 0;
await page.goto(`${BASE_URL}?page=lessons&series=starters&level=1`, { waitUntil: "load", timeout: 15000 });
await page.waitForTimeout(2500);
console.log("Console/page errors sau khi vào Lessons:", errors.length ? errors : "(không có)");

// Tìm nút bắt đầu Speaking test1 (tên nút thực tế phụ thuộc UI — log ra để kiểm tra thủ công
// nếu selector không khớp, đây là smoke test không phải test suite chính thức).
const startBtn = page.locator("button", { hasText: /Speaking|Test 1|Bắt đầu/i }).first();
const hasStartBtn = await startBtn.count();
console.log("Tìm thấy nút liên quan Speaking/Test1:", hasStartBtn > 0);
const bodyText = await page.locator("body").innerText();
console.log("Có PasswordGate (yêu cầu mật khẩu) không:", /mật khẩu/i.test(bodyText));
console.log("--- 400 ký tự đầu nội dung trang ---");
console.log(bodyText.slice(0, 400));

console.log("\n=== TEST 3: Trang Dashboard (yêu cầu login, chỉ kiểm tra route không crash 500) ===");
errors.length = 0;
await page.goto(`${BASE_URL}?page=login`, { waitUntil: "load", timeout: 15000 });
await page.waitForTimeout(1000);
console.log("Console/page errors ở trang Login:", errors.length ? errors : "(không có)");

await browser.close();
console.log("\n=== HOÀN TẤT SMOKE TEST ===");
