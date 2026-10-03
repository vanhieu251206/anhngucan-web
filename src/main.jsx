import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ExamFocusOverlay from "./components/ExamFocusOverlay.jsx";
import { AuthProvider } from "./lib/authContext.jsx";
import { initAnalytics } from "./lib/analytics.js";

initAnalytics();

// Tab mở từ trước lần deploy mới: file JS tách riêng (jspdf, Dashboard...) đã đổi tên hash → 404 khi tải động.
// Không tự tải lại trang (có thể đang dở thao tác, vd vừa tạo tài khoản học sinh) — đổi lỗi thành lời nhắc dễ hiểu.
window.addEventListener("vite:preloadError", e => {
  if (e.payload instanceof Error) e.payload.message = "Trang web vừa được cập nhật phiên bản mới — bấm F5 tải lại trang rồi thử lại.";
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <ExamFocusOverlay />
    </AuthProvider>
  </StrictMode>
);
