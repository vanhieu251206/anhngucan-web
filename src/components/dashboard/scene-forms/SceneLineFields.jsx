import AudioUploadField from "../AudioUploadField.jsx";

// Cặp field lặp lại ở ĐẦU mọi loại scene (câu thoại giám khảo + audio đọc câu đó) — gộp thành
// 1 fieldset dùng chung để cả 5 form scene-forms/*.jsx đọc cùng 1 bố cục, thay vì mỗi form tự
// lặp lại 2 dòng input rời rạc (rối mắt, không rõ đây là 1 nhóm).
export default function SceneLineFields({ scene, onChange }) {
  return (
    <fieldset className="admin-fieldset">
      <legend>🗣️ Câu thoại giám khảo</legend>
      <label className="admin-mini-field">
        <span>Nội dung câu thoại</span>
        <input
          className="admin-input"
          placeholder="vd: Hello. My name's Jane."
          value={scene.examinerLine ?? ""}
          onChange={e => onChange({ examinerLine: e.target.value })}
        />
      </label>
      <AudioUploadField label="Audio đọc câu trên" value={scene.audioUrl} onChange={audioUrl => onChange({ audioUrl })} />
    </fieldset>
  );
}
