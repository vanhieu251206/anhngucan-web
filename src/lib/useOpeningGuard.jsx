import { useState } from "react";
import { useAuth } from "./authContext.jsx";
import { checkOpening } from "./openings.js";
import OpeningPasswordScreen from "../components/OpeningPasswordScreen.jsx";

// Hook dùng chung cho các trang ngoài LessonsPage (vd KetPetPage): bài MẶC ĐỊNH KHOÁ, học sinh chỉ vào được khi
// giáo viên đã mở cho lớp (còn hạn, còn lượt) + nhập đúng mật khẩu (nếu có). Xem lib/openings.js.
// guardStart(kind, test{ id, title }, { seriesId, level }, launch(opening|null)).
// `screen` khác null khi cần chặn cả trang bằng màn nhập mật khẩu/màn báo bị khoá — trang gọi phải return nó.
export function useOpeningGuard() {
  const { user, profile, isStaff, isTester } = useAuth();
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState(null);
  const [gate, setGate] = useState(null);
  const [activeOpening, setActiveOpening] = useState(null);

  async function guardStart(kind, test, { seriesId, level }, launch) {
    if (isStaff || isTester) {
      setActiveOpening(null);
      launch(null);
      return;
    }
    setChecking(true);
    let result;
    try {
      result = await checkOpening({ uid: user?.uid, className: profile?.className }, { seriesId, level, kind, testId: test.id });
    } catch {
      setBlocked({ title: "Không kiểm tra được 🐝", message: "Có vẻ mạng đang lỗi — con thử lại sau nhé." });
      return;
    } finally {
      setChecking(false);
    }
    if (!result.ok) {
      setBlocked({ title: result.title, message: result.message });
      return;
    }
    if (result.opening.passwordHash) setGate({ opening: result.opening, title: test.title, launch });
    else {
      setActiveOpening(result.opening);
      launch(result.opening);
    }
  }

  let screen = null;
  if (blocked) {
    screen = (
      <div className="home-v2 lessons-screen-v2">
        <div className="name-prompt-shell">
          <div className="name-prompt-card">
            <h2>{blocked.title}</h2>
            <p className="admin-muted-text">{blocked.message}</p>
            <div className="name-prompt-actions">
              <button type="button" className="btn btn-primary" onClick={() => setBlocked(null)}>Quay lại</button>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (gate) {
    screen = (
      <OpeningPasswordScreen
        opening={gate.opening}
        title={gate.title}
        onBack={() => setGate(null)}
        onSuccess={() => {
          const { opening, launch } = gate;
          setGate(null);
          setActiveOpening(opening);
          launch(opening);
        }}
      />
    );
  }

  return { guardStart, checking, screen, activeOpening };
}
