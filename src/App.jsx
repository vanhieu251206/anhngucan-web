import { Suspense, lazy, useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import HomePage from "./pages/HomePage.jsx";
import LessonsPage from "./pages/LessonsPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import KetPetPage from "./pages/KetPetPage.jsx";
import { useAuth } from "./lib/authContext.jsx";
import { readParams, setParams } from "./lib/urlState.js";
import { YLE_SERIES } from "./lib/yleData.js";
import { isUnlockedInSession } from "./lib/seriesAccess.js";
import SeriesPasswordGate from "./components/SeriesPasswordGate.jsx";

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
  // Bộ đề đã mở khoá bằng mật khẩu trong PHIÊN này (chốt 2026-09-17: bỏ tài khoản học sinh, quay
  // lại mật khẩu như PasswordGate cũ nhưng tách riêng theo từng bộ đề — xem lib/seriesAccess.js).
  // Lưu bằng số đếm (không phải Set) để ép re-render khi SeriesPasswordGate mở khoá xong.
  const [unlockTick, setUnlockTick] = useState(0);
  const effectiveSeriesId = page === "lessons" ? lessonSeriesId || "starters" : null;
  const gateSeries = effectiveSeriesId ? YLE_SERIES.find(s => s.id === effectiveSeriesId) : null;
  // `unlockTick` không được đọc trong biểu thức dưới nhưng phải có trong closure để re-render sau
  // khi setUnlockTick chạy (isUnlockedInSession() đọc sessionStorage, không phải state React).
  void unlockTick;
  const seriesUnlocked = effectiveSeriesId ? isUnlockedInSession(effectiveSeriesId) : true;

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

  // Trang chủ và Bài học dùng chung 1 kiểu màn hình riêng (logo + nút riêng, không Header/Footer
  // của site) để liền mạch — xem HomePage.jsx / LessonsPage.jsx (đều dùng class .home-screen).
  if (page === "home") {
    return <HomePage onNavigate={setPage} onSelectSeries={goToLessons} />;
  }

  if (page === "lessons") {
    // Bỏ đăng nhập bắt buộc (chốt 2026-09-17) — quay lại mật khẩu như PasswordGate cũ, nhưng tách
    // riêng theo TỪNG BỘ ĐỀ (Starters/Movers/Flyers/...) thay vì 1 mật khẩu chung toàn trung tâm,
    // xem lib/seriesAccess.js. Admin/teacher đã đăng nhập (isStaff) bỏ qua hẳn màn này. Chờ
    // `loading` xong mới quyết định để không chớp qua màn nhập mật khẩu ngay lúc Auth vừa xác thực
    // lại phiên admin/teacher cũ lúc F5.
    if (loading) return null;
    if (!isStaff && !seriesUnlocked && gateSeries) {
      return (
        <SeriesPasswordGate
          seriesId={gateSeries.id}
          seriesTitle={gateSeries.title}
          seriesColor={gateSeries.color}
          onUnlock={() => setUnlockTick(t => t + 1)}
          onBack={() => setPage("home")}
        />
      );
    }
    // KET/PET dùng khung điều hướng riêng (Grade/Unit, xem KetPetPage.jsx) thay vì
    // Level/Test/Part của LessonsPage.jsx — cấu trúc dữ liệu khác hẳn (chốt 2026-09-14).
    if (lessonSeriesId === "ket-pet") {
      return <KetPetPage onNavigate={setPage} />;
    }
    return <LessonsPage initialSeriesId={lessonSeriesId} onNavigate={setPage} />;
  }

  if (page === "login" && loading) {
    return null;
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
