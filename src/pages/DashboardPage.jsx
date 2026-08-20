import { useEffect, useState } from "react";
import { useAuth } from "../lib/authContext.jsx";
import Sidebar from "../components/Sidebar.jsx";
import OverviewPage from "./dashboard/OverviewPage.jsx";
import CreateLessonPage from "./dashboard/CreateLessonPage.jsx";
import TeacherAccountsPage from "./dashboard/TeacherAccountsPage.jsx";
import StudentResultsPage from "./dashboard/StudentResultsPage.jsx";

const ADMIN_ITEMS = [
  { key: "overview", label: "Tổng quan" },
  { key: "create-lesson", label: "Tạo bài" },
  { key: "teachers", label: "Cấu hình tài khoản giáo viên" },
];
// Giáo viên cũng được soạn bài (create-lesson) như admin, chỉ không có "Cấu hình tài khoản
// giáo viên" (chỉ admin mới tạo/quản được tài khoản giáo viên khác).
const TEACHER_ITEMS = [
  { key: "create-lesson", label: "Tạo bài" },
  { key: "results", label: "Kết quả học sinh" },
];

// Khu vực quản trị — layout TÁCH BIỆT hoàn toàn khỏi giao diện học sinh (không dùng
// Header/Footer công khai, không dùng tông cam/xanh ngọc), xem class .admin-* trong index.css.
export default function DashboardPage({ onNavigate }) {
  const { user, isAdmin, isTeacher, logout } = useAuth();
  const items = isAdmin ? ADMIN_ITEMS : isTeacher ? TEACHER_ITEMS : [];
  const [section, setSection] = useState(items[0]?.key ?? "overview");

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
    <div className="admin-shell">
      <Sidebar
        items={items}
        activeKey={section}
        onSelect={setSection}
        userEmail={user?.email}
        roleLabel={isAdmin ? "Admin" : "Giáo viên"}
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
        </div>
      </div>
    </div>
  );
}
