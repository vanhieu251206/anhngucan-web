import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Cấu hình Firebase Web SDK KHÔNG phải bí mật (chính Firebase khuyến cáo có thể để lộ công khai
// trong code client — bảo mật thật sự nằm ở Firestore/Auth Security Rules, không phải ở việc giấu
// các giá trị này). Vẫn nạp qua biến môi trường (VITE_FIREBASE_*, xem .env.example) để dễ đổi giữa
// các môi trường (dev/production) mà không sửa code.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// ignoreUndefinedProperties: các form CMS (scene-forms/*.jsx) hay set field = undefined khi bỏ
// chọn 1 tuỳ chọn (vd expectedKeyword: undefined) — mặc định Firestore từ chối ghi cả document
// khi gặp undefined ("Unsupported field value: undefined"), khiến "Xuất bản" báo lỗi/không lưu
// được mà không rõ nguyên nhân. Bật cờ này để field undefined tự bị bỏ qua khi ghi, thay vì phải
// sửa từng nơi set undefined trong toàn bộ scene-forms.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
