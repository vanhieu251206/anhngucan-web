// Script tạm dùng 1 lần để nén 3 ảnh UI dùng toàn cục (bee.png, mic.png, logo.png) — xem audit
// Phase 6/P1: các ảnh này nặng bất thường (>800KB-1.4MB) so với kích thước hiển thị thực tế
// (56-94px, x3 cho màn hình retina). Resize xuống đúng kích thước cần + nén PNG.
// Chạy 1 lần: npm install --no-save sharp && node scripts/compress-ui-images.mjs
import sharp from "sharp";
import { statSync } from "node:fs";

const targets = [
  { file: "public/assets/img/mascot/bee.png", maxSize: 256 },
  { file: "public/assets/img/icons/mic.png", maxSize: 320 },
  { file: "public/assets/img/logo.png", maxSize: 150 },
];

for (const { file, maxSize } of targets) {
  const before = statSync(file).size;
  const buffer = await sharp(file)
    .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true })
    .png({ quality: 85, compressionLevel: 9 })
    .toBuffer();
  await sharp(buffer).toFile(file);
  const after = statSync(file).size;
  console.log(`${file}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`);
}
