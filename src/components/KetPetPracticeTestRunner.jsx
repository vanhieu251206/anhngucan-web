import { useEffect, useState } from "react";
import Header from "./Header.jsx";
import KetPetPracticeTestQuiz from "./KetPetPracticeTestQuiz.jsx";
import { getKetPetPracticeTest } from "../lib/adminLessons.js";

// Màn học sinh làm 1 Practice Test (1-4) của 1 Unit KET/PET — cùng khung với
// KetPetVocabularyRunner.jsx: tải nội dung từ Firestore rồi giao phần tương tác cho
// KetPetPracticeTestQuiz.jsx (dùng chung với Preview trong CMS). Cho làm lại thoải mái (không giới
// hạn lượt, không qua attempts.js).
export default function KetPetPracticeTestRunner({ grade, unit, testNumber, onNavigate, onBack }) {
  const [doc, setDoc] = useState(undefined); // undefined = đang tải, null = chưa có nội dung

  useEffect(() => {
    let cancelled = false;
    getKetPetPracticeTest(grade, unit, testNumber).then(d => {
      if (!cancelled) setDoc(d?.groups?.length ? d : null);
    });
    return () => { cancelled = true; };
  }, [grade, unit, testNumber]);

  return (
    <div className="home-v2 lessons-screen-v2">
      <Header page="lessons" onNavigate={onNavigate} />
      <div className="dark-hero-band dark-hero-band-sm">
        <div className="dark-hero-inner dark-hero-inner-row">
          <div className="dark-hero-text dark-hero-text-row">
            <button className="lesson-back-link" onClick={onBack}>⬅ {`Grade ${grade} — Unit ${unit} — Practice Test`}</button>
            <div className="dark-hero-titles">
              <h1 className="dark-hero-title">{`Test ${testNumber}`}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="content-grid-section content-grid-section-dark">
        {doc === undefined && <p className="vocab-empty">Đang tải...</p>}
        {doc === null && <p className="vocab-empty">Chưa có nội dung — quay lại sau nhé.</p>}
        {doc && <KetPetPracticeTestQuiz groups={doc.groups} />}
      </div>
    </div>
  );
}
