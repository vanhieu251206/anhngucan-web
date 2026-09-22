// Tự động tách các ảnh khung riêng lẻ (nền trắng, mỗi ảnh có viền đen bao quanh) ra khỏi 1 ảnh
// chụp cả trang — dùng cho công cụ "Tách ảnh" (ImageSplitterPage.jsx). Toàn bộ xử lý bằng Canvas
// ngay trên trình duyệt, không cần server.
//
// Thuật toán: coi vùng nền trắng là "nền", phần còn lại gộp thành các khối liên thông (connected
// component, BFS 4 hướng) — mỗi khối = 1 ảnh khung (viền đen liền với ảnh bên trong nên luôn dính
// thành 1 khối), cắt sát theo hộp bao của khối đó. Thứ tự trả về = theo hàng từ trên xuống, trong
// cùng 1 hàng thì trái sang phải (đúng cách mắt người đọc 1 lưới ảnh nhiều hàng/cột).
//
// Việc dò khối chạy trên bản thu nhỏ (DETECT_MAX_SIDE) cho nhanh, nhưng ảnh cắt ra vẫn lấy từ ảnh
// gốc độ phân giải đầy đủ (quy đổi toạ độ theo tỉ lệ thu nhỏ) để không mất nét.
const BG_THRESHOLD = 238; // kênh màu >= ngưỡng này (và không quá lệch giữa các kênh) coi là nền trắng
const MIN_AREA_RATIO = 0.0002; // sàn tối thiểu (so với cả ảnh) để loại hạt bụi/răng cưa, KHÔNG dùng để phân biệt chữ với ảnh khung
const MIN_AREA_VS_MAX = 0.25; // bỏ khối nhỏ hơn tỉ lệ này so với khối lớn nhất tìm được — chữ chú thích/tiêu đề luôn nhỏ hơn nhiều so với ảnh khung thật nên lọc theo khối lớn nhất đáng tin hơn theo % cả ảnh (ảnh dài & hẹp — như 1 cột ảnh — khiến sàn tuyệt đối dễ lọt chữ)
const DETECT_MAX_SIDE = 1100;
const ROW_OVERLAP_RATIO = 0.35; // 2 khối coi là cùng 1 hàng khi phần giao theo trục y >= tỉ lệ này so với khối thấp hơn
const PAD_PX = 2; // nới thêm vài px quanh hộp bao khi cắt từ ảnh gốc, tránh cắt sát mất viền

function isBackground(r, g, b, a) {
  if (a < 16) return true;
  return r >= BG_THRESHOLD && g >= BG_THRESHOLD && b >= BG_THRESHOLD;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được file ảnh."));
    };
    img.src = url;
  });
}

// BFS liên thông bằng ngăn xếp thủ công (tránh đệ quy tràn stack với ảnh lớn).
function findComponents(imageData, width, height) {
  const { data } = imageData;
  const total = width * height;
  const visited = new Uint8Array(total);
  const stack = new Int32Array(total);
  const boxes = [];

  for (let start = 0; start < total; start++) {
    if (visited[start]) continue;
    const si = start * 4;
    if (isBackground(data[si], data[si + 1], data[si + 2], data[si + 3])) {
      visited[start] = 1;
      continue;
    }
    let sp = 0;
    stack[sp++] = start;
    visited[start] = 1;
    let minX = start % width, maxX = minX;
    let minY = (start / width) | 0, maxY = minY;
    let area = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % width;
      const y = (idx / width) | 0;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0) {
        const n = idx - 1;
        if (!visited[n]) {
          visited[n] = 1;
          const pi = n * 4;
          if (!isBackground(data[pi], data[pi + 1], data[pi + 2], data[pi + 3])) stack[sp++] = n;
        }
      }
      if (x < width - 1) {
        const n = idx + 1;
        if (!visited[n]) {
          visited[n] = 1;
          const pi = n * 4;
          if (!isBackground(data[pi], data[pi + 1], data[pi + 2], data[pi + 3])) stack[sp++] = n;
        }
      }
      if (y > 0) {
        const n = idx - width;
        if (!visited[n]) {
          visited[n] = 1;
          const pi = n * 4;
          if (!isBackground(data[pi], data[pi + 1], data[pi + 2], data[pi + 3])) stack[sp++] = n;
        }
      }
      if (y < height - 1) {
        const n = idx + width;
        if (!visited[n]) {
          visited[n] = 1;
          const pi = n * 4;
          if (!isBackground(data[pi], data[pi + 1], data[pi + 2], data[pi + 3])) stack[sp++] = n;
        }
      }
    }
    boxes.push({ minX, minY, maxX, maxY, area });
  }
  return boxes;
}

// Nhóm các hộp bao theo hàng (trên→dưới), trong hàng sắp trái→phải.
function orderReadingWise(boxes) {
  const sorted = [...boxes].sort((a, b) => a.minY - b.minY);
  const rows = [];
  for (const box of sorted) {
    const h = box.maxY - box.minY + 1;
    const row = rows.find(r => {
      const overlap = Math.min(r.maxY, box.maxY) - Math.max(r.minY, box.minY) + 1;
      const rh = r.maxY - r.minY + 1;
      return overlap > 0 && overlap >= ROW_OVERLAP_RATIO * Math.min(h, rh);
    });
    if (row) {
      row.boxes.push(box);
      row.minY = Math.min(row.minY, box.minY);
      row.maxY = Math.max(row.maxY, box.maxY);
    } else {
      rows.push({ minY: box.minY, maxY: box.maxY, boxes: [box] });
    }
  }
  rows.sort((a, b) => a.minY - b.minY);
  const ordered = [];
  for (const row of rows) {
    row.boxes.sort((a, b) => a.minX - b.minX);
    ordered.push(...row.boxes);
  }
  return ordered;
}

// Trả về [{ index, dataUrl, width, height }] theo đúng thứ tự đọc trong ảnh gốc.
export async function splitFramedImages(file) {
  const img = await loadImage(file);
  const fullW = img.naturalWidth;
  const fullH = img.naturalHeight;
  if (!fullW || !fullH) throw new Error("Ảnh không hợp lệ.");

  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = fullW;
  fullCanvas.height = fullH;
  fullCanvas.getContext("2d").drawImage(img, 0, 0);

  const scale = Math.min(1, DETECT_MAX_SIDE / Math.max(fullW, fullH));
  const dw = Math.max(1, Math.round(fullW * scale));
  const dh = Math.max(1, Math.round(fullH * scale));
  const detectCanvas = document.createElement("canvas");
  detectCanvas.width = dw;
  detectCanvas.height = dh;
  const detectCtx = detectCanvas.getContext("2d");
  detectCtx.drawImage(img, 0, 0, dw, dh);
  const imageData = detectCtx.getImageData(0, 0, dw, dh);

  const floorArea = dw * dh * MIN_AREA_RATIO;
  const rawBoxes = findComponents(imageData, dw, dh).filter(b => b.area >= floorArea);
  if (!rawBoxes.length) throw new Error("Không tìm thấy ảnh khung nào trên nền trắng trong ảnh này.");
  const maxArea = Math.max(...rawBoxes.map(b => b.area));
  const boxes = rawBoxes.filter(b => b.area >= maxArea * MIN_AREA_VS_MAX);
  const ordered = orderReadingWise(boxes);

  const inv = 1 / scale;
  return ordered.map((b, i) => {
    const minX = Math.max(0, Math.floor(b.minX * inv) - PAD_PX);
    const minY = Math.max(0, Math.floor(b.minY * inv) - PAD_PX);
    const maxX = Math.min(fullW, Math.ceil((b.maxX + 1) * inv) + PAD_PX);
    const maxY = Math.min(fullH, Math.ceil((b.maxY + 1) * inv) + PAD_PX);
    const w = maxX - minX;
    const h = maxY - minY;
    const outCanvas = document.createElement("canvas");
    outCanvas.width = w;
    outCanvas.height = h;
    outCanvas.getContext("2d").drawImage(fullCanvas, minX, minY, w, h, 0, 0, w, h);
    return { index: i + 1, dataUrl: outCanvas.toDataURL("image/png"), width: w, height: h };
  });
}
