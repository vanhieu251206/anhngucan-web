import { createContext, useCallback, useContext, useRef, useState } from "react";

// Thay window.confirm() mặc định của trình duyệt (xấu, không theo được theme/màu accent app) bằng
// modal tự thiết kế — vẫn giữ API dùng như cũ (gọi hàm, await kết quả true/false) để thay thế gọn
// tại chỗ, không phải viết lại logic gọi. Mount 1 lần ở DashboardPage, dùng useConfirm() ở bất kỳ
// đâu bên trong (CreateLessonPage, TestStudio...).
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { message, danger }
  const resolveRef = useRef(null);

  const confirm = useCallback((message, { danger = false } = {}) => {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setState({ message, danger });
    });
  }, []);

  function handle(result) {
    setState(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="confirm-overlay" role="presentation" onClick={() => handle(false)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            <p className="confirm-dialog-message">{state.message}</p>
            <div className="confirm-dialog-actions">
              <button type="button" className="admin-pill-btn" onClick={() => handle(false)}>
                Huỷ
              </button>
              <button
                type="button"
                className={`admin-btn-primary${state.danger ? " confirm-dialog-danger" : ""}`}
                onClick={() => handle(true)}
                autoFocus
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm() phải dùng trong <ConfirmProvider>");
  return confirm;
}
