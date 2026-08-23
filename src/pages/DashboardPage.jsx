import { useEffect, useState } from "react";
import { useAuth } from "../lib/authContext.jsx";
import Sidebar from "../components/Sidebar.jsx";
import OverviewPage from "./dashboard/OverviewPage.jsx";
import CreateLessonPage from "./dashboard/CreateLessonPage.jsx";
import TeacherAccountsPage from "./dashboard/TeacherAccountsPage.jsx";
import StudentResultsPage from "./dashboard/StudentResultsPage.jsx";
import SettingsPage from "./SettingsPage.jsx";
import { ConfirmProvider } from "../components/dashboard/ConfirmDialog.jsx";
import { readParams, setParams } from "../lib/urlState.js";

const ADMIN_ITEMS = [
  { key: "overview", label: "Tổng quan" },
  { key: "create-lesson", label: "Tạo bài" },
  { key: "teachers", label: "Cấu hình tài khoản giáo viên" },
  { key: "settings", label: "Cài đặt" },
];
// Giáo viên cũng được soạn bài (create-lesson) như admin, chỉ không có "Cấu hình tài khoản
// giáo viên" (chỉ admin mới tạo/quản được tài khoản giáo viên khác).
const TEACHER_ITEMS = [
  { key: "create-lesson", label: "Tạo bài" },
  { key: "results", label: "Kết quả học sinh" },
  { key: "settings", label: "Cài đặt" },
];

// Khu vực quản trị — layout TÁCH BIỆT hoàn toàn khỏi giao diện học sinh (không dùng
// Header/Footer công khai, không dùng tông cam/xanh ngọc), xem class .admin-* trong index.css.
export default function DashboardPage({ onNavigate, initialSection }) {
  const { user, isAdmin, isTeacher, logout } = useAuth();
  const items = isAdmin ? ADMIN_ITEMS : isTeacher ? TEACHER_ITEMS : [];
  // Mục sidebar đang mở: ưu tiên initialSection (link ?page=settings cũ), rồi tới URL (?section=...
  // — để F5 quay lại đúng tab thay vì luôn về "Tổng quan", phản hồi người dùng 2026-08-23), cuối
  // cùng mới tới mục đầu tiên của role.
  const [section, setSectionState] = useState(
    () => initialSection ?? readParams().get("section") ?? items[0]?.key ?? "overview"
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
  }, [isAdmin, isTeacher]);

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
          userEmail={user?.email}
          roleLabel={`${isAdmin ? "Admin" : "Giáo viên"} · UID: ${user?.uid}`}
          onGoHome={() => onNavigate("home")}
          onLogout={handleLogout}
        />
        <div className="admin-main">
          <div className="admin-topbar">
            <strong>{items.find(i => i.key === section)?.label ?? ""}</strong>
          </div>
          <div className="admin-content">
            {section === "overview" && isAdmin && <OverviewPage />}
            {section === "create-lesson" && (isAdmin || isTeacher) && <CreateLessonPage />}
            {section === "teachers" && isAdmin && <TeacherAccountsPage />}
            {section === "results" && isTeacher && <StudentResultsPage />}
            {section === "settings" && (isAdmin || isTeacher) && <SettingsPage />}
          </div>
        </div>
      </div>
    </ConfirmProvider>
  );
}
