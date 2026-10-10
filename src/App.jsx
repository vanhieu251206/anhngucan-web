import { Suspense, lazy, useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import HomePage from "./pages/HomePage.jsx";
import LessonsPage from "./pages/LessonsPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import KetPetPage from "./pages/KetPetPage.jsx";
import KidsPage from "./pages/KidsPage.jsx";
import MyWorkPage from "./pages/MyWorkPage.jsx";
import { useAuth } from "./lib/authContext.jsx";
import { readParams, setParams } from "./lib/urlState.js";
import ForceChangePassword from "./components/ForceChangePassword.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
import ChangePasswordPage from "./pages/ChangePasswordPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import { trackPage } from "./lib/analytics.js";

// Dashboard (CMS quản trị) chỉ admin/teacher dùng, học sinh không bao giờ vào — tách thành chunk
// riêng (React.lazy) để 100 học sinh không phải tải kèm code CMS lúc mở app (xem audit P2).
// Tab cũ sau deploy mới → chunk cũ 404: lúc mới chuyển trang chưa dở thao tác gì nên tự tải lại 1 lần (cờ chống lặp).
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage.jsx").then(
    m => { try { sessionStorage.removeItem("chunkReload"); } catch {} return m; },
    err => {
      let reloaded = false;
      try { reloaded = sessionStorage.getItem("chunkReload") === "1"; sessionStorage.setItem("chunkReload", "1"); } catch {}
      if (!reloaded) { window.location.reload(); return new Promise(() => {}); }
      throw err;
    }
  )
);

// Tiêu đề tab riêng cho từng trang (SEO + dễ phân biệt khi mở nhiều tab). Trang không có trong danh sách = 404.
const SITE_NAME = "Anh Ngữ C.A.N";
const PAGE_TITLES = {
  home: `${SITE_NAME} — Học tiếng Anh vui vẻ cho bé`,
  lessons: `Bài học — ${SITE_NAME}`,
  "my-work": `Bài của con — ${SITE_NAME}`,
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
// Mỗi lần navigateApp() (lib/urlState.js) tăng số này để trang Bài học dựng lại từ đầu theo URL mới.
let navSeq = 0;

export default function App() {
  const [{ page, lessonSeriesId, key: navKey = 0 }, setNav] = useState(initialNavFromUrl);
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
    function onAppNavigate() {
      navSeq += 1;
      setNav({ ...initialNavFromUrl(), key: navSeq });
    }
    window.addEventListener("popstate", onPopState);
    window.addEventListener("app:navigate", onAppNavigate);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("app:navigate", onAppNavigate);
    };
  }, []);

  // Vào thẳng ?page=login khi đã đăng nhập rồi (F5, mở lại tab cũ...) — tự đá sang khu vực đúng
  // thay vì hiện lại form đăng nhập.
  useEffect(() => {
    if (page === "login" && !loading && user) {
      setPage(isStaff ? "dashboard" : "lessons");
    }
  }, [page, loading, user, isStaff]);

  // Đăng nhập BẮT BUỘC cho TOÀN BỘ web (chốt 2026-10-10): người lạ chỉ thấy form đăng nhập, kể cả Trang chủ.
  // Chờ `loading` xong mới quyết định — Firebase Auth cần chút thời gian khôi phục phiên, tránh chớp qua
  // form đăng nhập lúc F5.
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

  // Tài khoản mới (học sinh/giáo viên): bắt buộc đặt mật khẩu mới trước khi dùng bất kỳ trang nào — đặt TRƯỚC
  // nhánh Dashboard để giáo viên không đi vòng qua khu vực quản trị (lỗi 2026-09-27).
  if (profile?.mustChangePassword) {
    return <ForceChangePassword />;
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
    // KET/PET dùng khung điều hướng riêng (Grade/Unit, xem KetPetPage.jsx) thay vì
    // Level/Test/Part của LessonsPage.jsx — cấu trúc dữ liệu khác hẳn (chốt 2026-09-14).
    if (lessonSeriesId === "ket-pet") {
      return <KetPetPage key={navKey} onNavigate={setPage} />;
    }
    // Kids dùng khung điều hướng riêng (Sách online/Listening/Speaking, xem KidsPage.jsx) — chưa
    // theo cấu trúc Level/Test/Part của LessonsPage.jsx (chốt 2026-09-23).
    if (lessonSeriesId === "kids") {
      return <KidsPage key={navKey} onNavigate={setPage} />;
    }
    return <LessonsPage key={navKey} initialSeriesId={lessonSeriesId} onNavigate={setPage} />;
  }

  // "Bài của con" (học sinh): danh sách bài giáo viên mở cho lớp.
  if (page === "my-work") {
    return <MyWorkPage onNavigate={setPage} />;
  }

  return (
    <>
      <Header page={page} onNavigate={setPage} />

      <main id="app">
        {page === "about" && <AboutPage onNavigate={setPage} />}
        {page === "contact" && <ContactPage onNavigate={setPage} />}
        {page === "privacy" && <PrivacyPage />}
        {page === "change-password" && <ChangePasswordPage onNavigate={setPage} />}
        {/* dashboard/settings bằng tài khoản không phải quản trị → 404. */}
        {(page === "dashboard" || page === "settings") && <NotFoundPage onNavigate={setPage} />}
        {!PAGE_TITLES[page] && <NotFoundPage onNavigate={setPage} />}
      </main>
    </>
  );
}
