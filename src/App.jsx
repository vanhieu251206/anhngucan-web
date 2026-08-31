import { Suspense, lazy, useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import HomePage from "./pages/HomePage.jsx";
import LessonsPage from "./pages/LessonsPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { useAuth } from "./lib/authContext.jsx";
import { readParams, setParams } from "./lib/urlState.js";

// Dashboard (CMS quản trị) chỉ admin/teacher dùng, học sinh không bao giờ vào — tách thành chunk
// riêng (React.lazy) để 100 học sinh không phải tải kèm code CMS lúc mở app (xem audit P2).
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));

// Đọc trang + bộ đề ban đầu từ URL (?page=...&series=...) — để F5/mở lại URL đã chia sẻ vào
// đúng trang thay vì luôn bật về Trang chủ. Xem src/lib/urlState.js.
function initialNavFromUrl() {
  const p = readParams();
  return { page: p.get("page") || "home", lessonSeriesId: p.get("series") || null };
}

export default function App() {
  const [{ page, lessonSeriesId }, setNav] = useState(initialNavFromUrl);
  const { user, isStaff, loading } = useAuth();

  function setPage(next) {
    setNav(n => ({ ...n, page: next }));
  }

  function goToLessons(seriesId = null) {
    setNav({ page: "lessons", lessonSeriesId: seriesId });
  }

  // Ghi lại URL mỗi khi đổi trang/bộ đề — page "home" không cần query string cho gọn.
  useEffect(() => {
    setParams({
      page: page === "home" ? null : page,
      series: page === "lessons" ? lessonSeriesId : null,
    });
  }, [page, lessonSeriesId]);

  // Nút Back/Forward của trình duyệt — đọc lại URL, KHÔNG tự push thêm history entry mới.
  useEffect(() => {
    function onPopState() {
      setNav(initialNavFromUrl());
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // F5 vào thẳng trang quản trị: Firebase Auth cần chút thời gian xác thực lại (loading=true lúc
  // đầu, isStaff tạm thời false) — chặn render ở đây thay vì để rớt xuống nhánh trang công khai
  // bên dưới rồi lại nhảy sang Dashboard ngay khi auth xong (gây "chớp" qua giao diện Trang chủ,
  // phản hồi người dùng 2026-08-23).
  if ((page === "dashboard" || page === "settings") && loading) {
    return null;
  }

  // "Cài đặt" (đổi mật khẩu chung mở khoá bài học) đã BỎ HẲN cùng lối vào guest cũ (chốt
  // 2026-08-27, xem StudentAccountsPage.jsx thay thế bằng mật khẩu chung cho tài khoản học sinh
  // thật) — link/URL cũ (?page=settings) chuyển thẳng vào Dashboard mặc định thay vì trang trống.
  if (page === "settings" && isStaff) {
    return (
      <Suspense fallback={null}>
        <DashboardPage onNavigate={setPage} />
      </Suspense>
    );
  }

  // Khu vực quản trị (dashboard) có layout TÁCH BIỆT hoàn toàn khỏi web công khai — không
  // bọc Header/Footer, giống cách SceneRunner render fullscreen riêng trong LessonsPage.jsx.
  if (page === "dashboard" && isStaff) {
    return (
      <Suspense fallback={null}>
        <DashboardPage onNavigate={setPage} />
      </Suspense>
    );
  }

  // Trang chủ và Bài học dùng chung 1 kiểu màn hình riêng (logo + nút riêng, không Header/Footer
  // của site) để liền mạch — xem HomePage.jsx / LessonsPage.jsx (đều dùng class .home-screen).
  if (page === "home") {
    return <HomePage onNavigate={setPage} onSelectSeries={goToLessons} />;
  }

  if (page === "lessons") {
    // Đăng nhập bắt buộc mới (chốt 2026-08-27) — không còn lối vào bằng mật khẩu chung (guest),
    // chỉ tài khoản đã được cấp (admin/teacher/học sinh) mới xem được nội dung bài học. Chờ
    // `loading` xong mới quyết định, tránh chớp qua LoginPage rồi lại nhảy vào Lessons khi Auth
    // vừa xác thực lại phiên cũ lúc F5 (giống cách chặn "dashboard"/"settings" phía trên).
    if (loading) return null;
    if (!user) {
      // LoginPage vốn được thiết kế để đặt DƯỚI Header (.login-screen trừ sẵn 72px chiều cao
      // Header trong CSS) — thiếu Header ở đây từng để lộ khoảng trống trắng bên dưới màn đăng
      // nhập (lỗi thực tế 2026-08-27), phải bọc y hệt route ?page=login gốc bên dưới.
      return (
        <>
          <Header page="login" onNavigate={setPage} />
          <main id="app">
            <LoginPage onNavigate={setPage} />
          </main>
        </>
      );
    }
    return <LessonsPage initialSeriesId={lessonSeriesId} onNavigate={setPage} />;
  }

  return (
    <>
      <Header page={page} onNavigate={setPage} />

      <main id="app">
        {page === "about" && <AboutPage onNavigate={setPage} />}
        {page === "contact" && <ContactPage />}
        {page === "login" && <LoginPage onNavigate={setPage} />}
      </main>
    </>
  );
}
