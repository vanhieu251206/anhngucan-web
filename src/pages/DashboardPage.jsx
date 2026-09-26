import { useEffect, useState } from "react";
import { useAuth } from "../lib/authContext.jsx";
import { purgeExpiredResults } from "../lib/testResults.js";
import Sidebar from "../components/Sidebar.jsx";
import OverviewPage from "./dashboard/OverviewPage.jsx";
import CreateLessonPage from "./dashboard/CreateLessonPage.jsx";
import TeacherAccountsPage from "./dashboard/TeacherAccountsPage.jsx";
import TesterAccountsPage from "./dashboard/TesterAccountsPage.jsx";
import StudentAccountsPage from "./dashboard/StudentAccountsPage.jsx";
import OpeningsPage from "./dashboard/OpeningsPage.jsx";
import StudentResultsPage from "./dashboard/StudentResultsPage.jsx";
import SpeechLogsPage from "./dashboard/SpeechLogsPage.jsx";
import ImageSplitterPage from "./dashboard/ImageSplitterPage.jsx";
import { ConfirmProvider } from "../components/dashboard/ConfirmDialog.jsx";
import { readParams, setParams } from "../lib/urlState.js";

const ADMIN_ITEMS = [
  { key: "overview", label: "Tổng quan" },
  { key: "create-lesson", label: "Tạo bài" },
  { key: "image-splitter", label: "Tách ảnh" },
  { key: "students", label: "Quản lý học sinh" },
  { key: "openings", label: "Mở bài" },
  { key: "results", label: "Kết quả học sinh" },
  { key: "teachers", label: "Cấu hình tài khoản giáo viên" },
  { key: "testers", label: "Tài khoản đặc biệt" },
  { key: "speech-logs", label: "Log phát âm" },
];
// Giáo viên cũng được soạn bài (create-lesson) như admin, chỉ không có "Cấu hình tài khoản giáo
// viên" (chỉ admin mới tạo/quản được tài khoản giáo viên khác).
// Học sinh học bằng tài khoản theo LỚP (mục "Quản lý học sinh", 2026-09-25) — cơ chế mật khẩu theo bộ đề cũ
// (SeriesPasswordGate/SeriesPasswordsPage) đã xoá hẳn.
// Giáo viên KHÔNG bị giới hạn (mặc định, chưa bật `restricted`) — thêm mục "Phân quyền giáo viên
// phụ" để tự phân công phạm vi cho người dạy ngắn hạn, không cần đợi admin (chốt 2026-09-22).
const TEACHER_ITEMS = [
  { key: "overview", label: "Tổng quan" },
  { key: "create-lesson", label: "Tạo bài" },
  { key: "students", label: "Quản lý học sinh" },
  { key: "openings", label: "Mở bài" },
  { key: "results", label: "Kết quả học sinh" },
  { key: "teachers", label: "Phân quyền giáo viên phụ" },
];
// Giáo viên BỊ GIỚI HẠN (restricted=true, vd người dạy ngắn hạn/vài lớp) — không thấy "Tài khoản
// học sinh" (không được xem/tạo học sinh) và không tự phân quyền cho ai khác.
const RESTRICTED_TEACHER_ITEMS = [
  { key: "create-lesson", label: "Tạo bài" },
  { key: "openings", label: "Mở bài" },
  { key: "results", label: "Kết quả học sinh" },
];

// Khu vực quản trị — layout TÁCH BIỆT hoàn toàn khỏi giao diện học sinh (không dùng
// Header/Footer công khai, không dùng tông cam/xanh ngọc), xem class .admin-* trong index.css.
export default function DashboardPage({ onNavigate }) {
  const { user, isAdmin, isTeacher, profile, logout } = useAuth();
  const isRestrictedTeacher = isTeacher && !!profile?.restricted;
  const items = isAdmin ? ADMIN_ITEMS : isRestrictedTeacher ? RESTRICTED_TEACHER_ITEMS : isTeacher ? TEACHER_ITEMS : [];
  // Mỗi lần admin/giáo viên vào khu vực quản trị: xoá hẳn kết quả làm bài đã quá 48h sau hạn chót (không có server
  // chạy định kỳ — xem lib/testResults.js purgeExpiredResults).
  useEffect(() => {
    if (isAdmin || isTeacher) purgeExpiredResults();
  }, [isAdmin, isTeacher]);
  // Mục sidebar đang mở: ưu tiên URL (?section=... — để F5 quay lại đúng tab thay vì luôn về
  // "Tổng quan", phản hồi người dùng 2026-08-23), cuối cùng mới tới mục đầu tiên của role.
  const [section, setSectionState] = useState(
    () => readParams().get("section") ?? items[0]?.key ?? "overview"
  );
  function setSection(key) {
    setSectionState(key);
    setParams({ section: key }, { replace: true });
  }

  // Phòng hờ: nếu section hiện tại không hợp lệ với role (vd role đổi giữa chừng), rơi về
  // mục đầu tiên hợp lệ của role đó — không để lọt vào trang không thuộc quyền.
  useEffect(() => {
    if (!items.some(i => i.key === section)) {
      setSection(items[0]?.key ?? "overview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isTeacher, isRestrictedTeacher]);

  function handleLogout() {
    logout();
    onNavigate("home");
  }

  return (
    <ConfirmProvider>
      <div className="admin-shell">
        <Sidebar
          items={items}
          activeKey={section}
          onSelect={setSection}
          userEmail={profile?.username ?? user?.email}
          roleLabel={isAdmin ? "Admin" : "Giáo viên"}
          onGoHome={() => onNavigate("home")}
          onChangePassword={() => onNavigate("change-password")}
          onLogout={handleLogout}
        />
        <div className="admin-main">
          <div className="admin-topbar">
            <strong>{items.find(i => i.key === section)?.label ?? ""}</strong>
          </div>
          <div className="admin-content">
            {section === "overview" && (isAdmin || (isTeacher && !isRestrictedTeacher)) && <OverviewPage />}
            {section === "create-lesson" && (isAdmin || isTeacher) && <CreateLessonPage />}
            {section === "image-splitter" && isAdmin && <ImageSplitterPage />}
            {section === "students" && (isAdmin || (isTeacher && !isRestrictedTeacher)) && <StudentAccountsPage />}
            {section === "openings" && (isAdmin || isTeacher) && <OpeningsPage />}
            {section === "teachers" && (isAdmin || (isTeacher && !isRestrictedTeacher)) && <TeacherAccountsPage />}
            {section === "testers" && isAdmin && <TesterAccountsPage />}
            {section === "speech-logs" && isAdmin && <SpeechLogsPage />}
            {section === "results" && (isAdmin || isTeacher) && <StudentResultsPage />}
          </div>
        </div>
      </div>
    </ConfirmProvider>
  );
}
