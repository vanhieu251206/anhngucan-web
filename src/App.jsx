import { Suspense, lazy, useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import HomePage from "./pages/HomePage.jsx";
import LessonsPage from "./pages/LessonsPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import KetPetPage from "./pages/KetPetPage.jsx";
import KidsPage from "./pages/KidsPage.jsx";
import { useAuth } from "./lib/authContext.jsx";
import { readParams, setParams } from "./lib/urlState.js";
import ForceChangePassword from "./components/ForceChangePassword.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
import ChangePasswordPage from "./pages/ChangePasswordPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import { trackPage } from "./lib/analytics.js";

// Dashboard (CMS quản trị) chỉ admin/teacher dùng, học sinh không bao giờ vào — tách thành chunk
// riêng (React.lazy) để 100 học sinh không phải tải kèm code CMS lúc mở app (xem audit P2).
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));

// Tiêu đề tab riêng cho từng trang (SEO + dễ phân biệt khi mở nhiều tab). Trang không có trong danh sách = 404.
const SITE_NAME = "Anh Ngữ C.A.N";
const PAGE_TITLES = {
  home: `${SITE_NAME} — Học tiếng Anh vui vẻ cho bé`,
  lessons: `Bài học — ${SITE_NAME}`,
  about: `Giới thiệu — ${SITE_NAME}`,
  contact: `Liên hệ — ${SITE_NAME}`,
  login: `Đăng nhập — ${SITE_NAME}`,
  privacy: `Chính sách bảo mật — ${SITE_NAME}`,
  "change-password": `Đổi mật khẩu — ${SITE_NAME}`,
  dashboard: `Quản trị — ${SITE_NAME}`,
  settings: `Quản trị — ${SITE_NAME}`,
};

// Đọc trang + bộ đề ban đầu từ URL (?page=...&series=...) — để F5/mở lại URL đã chia sẻ vào
// đúng trang thay vì luôn bật về Trang chủ. Xem src/lib/urlState.js.
function initialNavFromUrl() {
  const p = readParams();
  return { page: p.get("page") || "home", lessonSeriesId: p.get("series") || null };
}

export default function App() {
  const [{ page, lessonSeriesId }, setNav] = useState(initialNavFromUrl);
  const { user, profile, isStaff, loading } = useAuth();
  function setPage(next) {
    setNav(n => ({ ...n, page: next }));
  }

  function goToLessons(seriesId = null) {
    // Xoá sạch level/test còn sót trên URL từ lần vào Lessons trước — nếu không, bấm thẻ bộ đề ở
    // Trang chủ sẽ nhảy thẳng vào đúng cấp độ/bài cũ thay vì hiện lại bước "Chọn cấp độ" (bug phát
    // hiện 2026-09-11: bấm thẻ IELTS ở Trang chủ vào thẳng IELTS 8 vì URL còn ?level=8 cũ).
    setParams({ level: null, test: null });
    setNav({ page: "lessons", lessonSeriesId: seriesId });
  }

  // Ghi lại URL mỗi khi đổi trang/bộ đề — page "home" không cần query string cho gọn.
  useEffect(() => {
    setParams({
      page: page === "home" ? null : page,
      series: page === "lessons" ? lessonSeriesId : null,
    });
  }, [page, lessonSeriesId]);

  useEffect(() => {
    document.title = PAGE_TITLES[page] ?? `Không tìm thấy trang — ${SITE_NAME}`;
    trackPage(page, document.title);
  }, [page]);

  // Nút Back/Forward của trình duyệt — đọc lại URL, KHÔNG tự push thêm history entry mới.
  useEffect(() => {
    function onPopState() {
      setNav(initialNavFromUrl());
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Vào thẳng ?page=login khi đã đăng nhập rồi (F5, mở lại tab cũ...) — tự đá sang khu vực đúng
  // thay vì hiện lại form đăng nhập.
  useEffect(() => {
    if (page === "login" && !loading && user) {
      setPage(isStaff ? "dashboard" : "lessons");
    }
  }, [page, loading, user, isStaff]);

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

  // Học sinh vừa nhận tài khoản: bắt buộc đặt mật khẩu mới trước khi dùng bất kỳ trang nào.
  if (!loading && user && profile?.mustChangePassword) {
    return <ForceChangePassword />;
  }

  // Trang chủ và Bài học dùng chung 1 kiểu màn hình riêng (logo + nút riêng, không Header/Footer
  // của site) để liền mạch — xem HomePage.jsx / LessonsPage.jsx (đều dùng class .home-screen).
  if (page === "home") {
    return <HomePage onNavigate={setPage} onSelectSeries={goToLessons} />;
  }

  if (page === "lessons") {
    // Đăng nhập BẮT BUỘC để vào bài học (chốt 2026-09-20, thay mật khẩu theo bộ đề): học sinh dùng tài khoản
    // giáo viên cấp. Chờ `loading` xong mới quyết định, tránh chớp qua màn đăng nhập lúc Auth khôi phục phiên.
    if (loading) return null;
    if (!user) {
      return (
        <>
          <Header page="login" onNavigate={setPage} />
          <main id="app">
            <LoginPage onNavigate={setPage} />
          </main>
        </>
      );
    }
    // KET/PET dùng khung điều hướng riêng (Grade/Unit, xem KetPetPage.jsx) thay vì
    // Level/Test/Part của LessonsPage.jsx — cấu trúc dữ liệu khác hẳn (chốt 2026-09-14).
    if (lessonSeriesId === "ket-pet") {
      return <KetPetPage onNavigate={setPage} />;
    }
    // Kids dùng khung điều hướng riêng (Sách online/Listening/Speaking, xem KidsPage.jsx) — chưa
    // theo cấu trúc Level/Test/Part của LessonsPage.jsx (chốt 2026-09-23).
    if (lessonSeriesId === "kids") {
      return <KidsPage onNavigate={setPage} />;
    }
    return <LessonsPage initialSeriesId={lessonSeriesId} onNavigate={setPage} />;
  }

  if ((page === "login" || page === "change-password") && loading) {
    return null;
  }

  return (
    <>
      <Header page={page} onNavigate={setPage} />

      <main id="app">
        {page === "about" && <AboutPage onNavigate={setPage} />}
        {page === "contact" && <ContactPage onNavigate={setPage} />}
        {page === "login" && <LoginPage onNavigate={setPage} />}
        {page === "privacy" && <PrivacyPage />}
        {page === "change-password" && (user ? <ChangePasswordPage onNavigate={setPage} /> : <LoginPage onNavigate={setPage} />)}
        {/* dashboard/settings khi chưa đăng nhập bằng tài khoản quản trị → về form đăng nhập thay vì trang trắng. */}
        {(page === "dashboard" || page === "settings") &&
          (user ? <NotFoundPage onNavigate={setPage} /> : <LoginPage onNavigate={setPage} />)}
        {!PAGE_TITLES[page] && <NotFoundPage onNavigate={setPage} />}
      </main>
    </>
  );
}
