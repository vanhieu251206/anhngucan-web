import PaperTestStudio from "./PaperTestStudio.jsx";
import KetPetPracticeTestQuiz from "../KetPetPracticeTestQuiz.jsx";
import { answerSheetGroup } from "../../lib/ketPetPracticeTest.js";
import { validatePaperTest } from "../../lib/lessonValidation.js";

// Practice Test KET/PET — cách soạn "Đề tải lên" (2026-10-23, yêu cầu của cô): tải đề PDF/Word lên, bên phải là
// phiếu trả lời 1..N — mỗi câu là nút chọn A/B/C/D hoặc ô gõ, cô chỉ nhập đáp án. Mỗi câu 1 điểm. Phần soạn dùng
// chung với IELTS (PaperTestStudio.jsx).
export default function KetPetPaperTestStudio({ accent, unitTitle, gradeTitle, testNumber, paper, onPaperChange, groups, onGroupsChange, onBack, onSave, saving, saved }) {
  const questions = groups[0]?.questions ?? [];
  return (
    <PaperTestStudio
      accent={accent}
      label={`${unitTitle} — Practice Test ${testNumber}`}
      backLabel={`← Quay lại ${gradeTitle}`}
      onBack={onBack}
      paper={paper}
      onPaperChange={onPaperChange}
      questions={questions}
      onQuestionsChange={qs => onGroupsChange([answerSheetGroup(qs)])}
      warnings={validatePaperTest(paper, questions)}
      onSave={onSave}
      saving={saving}
      saved={saved}
      renderPreview={onClose => (
        <div className="admin-preview-overlay">
          <div className="admin-preview-overlay-head">
            <button type="button" className="admin-pill-btn" onClick={onClose}>← Đóng Preview</button>
            <strong>{unitTitle} — Practice Test {testNumber} (xem trước)</strong>
          </div>
          <div className="admin-preview-overlay-body">
            <KetPetPracticeTestQuiz groups={groups} paper={paper} revealAnswers />
          </div>
        </div>
      )}
    />
  );
}
