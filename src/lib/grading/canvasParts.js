// Hàm thuần của Part 4 tô màu (Starters) / Part 5 (Movers) — tách khỏi StartersListeningPart4.jsx (React) để Worker
// chấm bài (worker/src/submit.js) import được mà không kéo theo React.
export const isWriteItem = it => it.kind === "write";

// Câu tô màu hợp lệ = có màu + vùng đã tô; câu viết chữ hợp lệ = có khung + đáp án.
export const itemReady = it => (isWriteItem(it) ? !!it.box && !!it.answer?.trim() : !!it.ops?.length && !!it.color);
