import { useEffect, useState } from "react";
import Header from "./Header.jsx";
import KetPetVocabularyQuiz from "./KetPetVocabularyQuiz.jsx";
import { getVocabularyUnit } from "../lib/adminLessons.js";

// Màn học sinh làm Vocabulary 1 Unit KET/PET — tải nội dung từ Firestore rồi giao phần tương tác
// cho KetPetVocabularyQuiz.jsx (dùng chung với Preview trong CMS). Cho làm lại thoải mái (không
// giới hạn lượt, không qua attempts.js) — chốt người dùng 2026-09-14.
export default function KetPetVocabularyRunner({ grade, unit, onNavigate, onBack }) {
  const [doc, setDoc] = useState(undefined); // undefined = đang tải, null = chưa có nội dung

  useEffect(() => {
    let cancelled = false;
    getVocabularyUnit(grade, unit).then(d => {
      if (!cancelled) setDoc(d?.questions?.length ? d : null);
    });
    return () => { cancelled = true; };
  }, [grade, unit]);

  return (
    <div className="home-v2 lessons-screen-v2">
      <Header page="lessons" onNavigate={onNavigate} />
      <div className="dark-hero-band dark-hero-band-sm">
        <div className="dark-hero-inner dark-hero-inner-row">
          <div className="dark-hero-text dark-hero-text-row">
            <button className="lesson-back-link" onClick={onBack}>⬅ {`Grade ${grade} — Unit ${unit}`}</button>
            <div className="dark-hero-titles">
              <h1 className="dark-hero-title">Vocabulary</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="content-grid-section content-grid-section-dark">
        {doc === undefined && <p className="vocab-empty">Đang tải...</p>}
        {doc === null && <p className="vocab-empty">Chưa có nội dung — quay lại sau nhé.</p>}
        {doc && <KetPetVocabularyQuiz questions={doc.questions} />}
      </div>
    </div>
  );
}
