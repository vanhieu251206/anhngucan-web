import { useRef, useState } from "react";
import { ExaminerLine, SceneStage, MIC_ICON } from "../sceneVisuals.jsx";
import { useFitBoxSize } from "../../lib/useFitBoxSize.js";

// Kích thước GỐC của thẻ trắng thật ở màn Speaking học sinh (`.sentence-box`:
// width: min(600px,94vw); height: min(640px,88vh)) — render nội dung preview LUÔN ở đúng kích
// thước gốc 600×640px này (font-size, nút mic, khoảng cách... y hệt bản thật), rồi zoom nguyên
// khối bằng transform: scale() theo hệ số đo được (useFitBoxSize) để vừa khít khoảng trống hiện
// có — mọi thành phần bên trong co giãn ĐỒNG BỘ theo đúng 1 tỉ lệ (giống phóng to/thu nhỏ cả bản
// thiết kế), không còn cảnh chữ/nút giữ nguyên cỡ mà ảnh phải co làm tràn khung (phát hiện
// 2026-08-23: co lệch từng phần riêng lẻ theo flexbox làm nội dung vẫn tràn/phải cuộn).
const CARD_WIDTH = 600;
const CARD_HEIGHT = 640;
const CARD_RATIO = CARD_WIDTH / CARD_HEIGHT;

// Xem trước Y HỆT giao diện thật học sinh sẽ thấy (dùng chung component/CSS với SceneRunner.jsx,
// xem sceneVisuals.jsx) — vùng toạ độ (target/highlight/demoCard.target) sửa được TRỰC TIẾP bằng
// cách kéo chuột ngay trên ảnh preview này, không qua ô nhập số riêng.
function useRectDraw(onCommit) {
  const [drag, setDrag] = useState(null);
  const stageRef = useRef(null);

  function posToPercent(e) {
    const rect = stageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
  }
  function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    const p = posToPercent(e);
    setDrag({ startX: p.x, startY: p.y, curX: p.x, curY: p.y });
  }
  function onPointerMove(e) {
    if (!drag) return;
    const p = posToPercent(e);
    setDrag(d => ({ ...d, curX: p.x, curY: p.y }));
  }
  function onPointerUp() {
    if (!drag) return;
    const x = Math.min(drag.startX, drag.curX);
    const y = Math.min(drag.startY, drag.curY);
    const w = Math.abs(drag.curX - drag.startX);
    const h = Math.abs(drag.curY - drag.startY);
    setDrag(null);
    if (w < 1 || h < 1) return;
    onCommit({ x, y, w, h });
  }

  const liveRect = drag
    ? {
        x: Math.min(drag.startX, drag.curX),
        y: Math.min(drag.startY, drag.curY),
        w: Math.abs(drag.curX - drag.startX),
        h: Math.abs(drag.curY - drag.startY),
      }
    : null;

  return { stageRef, liveRect, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerLeave: onPointerUp } };
}

function RectOverlay({ rect, className = "part1-highlight" }) {
  if (!rect) return null;
  return (
    <div
      className={className}
      style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
    />
  );
}

// SceneStage + 1 vùng toạ độ sửa được bằng kéo chuột (dùng chung cho target/highlight/demoCard.target).
function EditableSceneStage({ sceneImage, rect, onRectChange, overlayClassName }) {
  const { stageRef, liveRect, handlers } = useRectDraw(onRectChange);
  const shown = liveRect ?? rect;
  return (
    <SceneStage innerRef={stageRef} cursor="crosshair">
      <div {...handlers} style={{ position: "absolute", inset: 0 }}>
        <img className="part1-scene-img" src={sceneImage} onError={e => (e.currentTarget.style.display = "none")} draggable={false} />
        <RectOverlay rect={shown} className={overlayClassName} />
      </div>
    </SceneStage>
  );
}

export default function ScenePreview({ scene, onChange }) {
  const wrapRef = useRef(null);
  const size = useFitBoxSize(wrapRef, CARD_RATIO);
  const scale = size ? size.width / CARD_WIDTH : 1;

  if (!scene.type) return null;

  return (
    <div ref={wrapRef} className="scene-preview-wrap">
      <div className="scene-preview-scale-box" style={size ? { width: size.width, height: size.height } : undefined}>
      <div
        className="scene-preview"
        style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
      <div className="scene-preview-inner">
        <ExaminerLine text={scene.examinerLine || "(chưa có câu thoại)"} />

        {scene.type === "mic" && (
          <>
            {scene.sceneImage && (
              <EditableSceneStage
                sceneImage={scene.sceneImage}
                rect={scene.highlight}
                overlayClassName="part1-highlight"
                onRectChange={highlight => onChange({ highlight })}
              />
            )}
            {scene.card?.image && <img className="part1-single-card" src={scene.card.image} alt="" />}
            {scene.answerTemplate && (
              <div className="answer-template">💡 Gợi ý: <strong>{scene.answerTemplate}</strong></div>
            )}
            <button className="mic-btn" type="button" disabled>
              <img src={MIC_ICON} alt="" />
            </button>
          </>
        )}

        {scene.type === "narration" && scene.sceneImage && (
          <EditableSceneStage
            sceneImage={scene.sceneImage}
            rect={scene.demoCard?.target ?? scene.highlight}
            overlayClassName="part1-highlight"
            onRectChange={rect =>
              scene.demoCard ? onChange({ demoCard: { ...scene.demoCard, target: rect } }) : onChange({ highlight: rect })
            }
          />
        )}
        {scene.type === "narration" && scene.demoCard?.card?.image && scene.demoCard?.target && (
          <img
            className="dropped-card"
            src={scene.demoCard.card.image}
            style={{
              left: `${scene.demoCard.target.x + scene.demoCard.target.w / 2}%`,
              top: `${scene.demoCard.target.y + scene.demoCard.target.h / 2}%`,
            }}
          />
        )}

        {scene.type === "scene-click" && scene.sceneImage && (
          <EditableSceneStage
            sceneImage={scene.sceneImage}
            rect={scene.target}
            overlayClassName="part1-highlight"
            onRectChange={rect => onChange({ target: { ...scene.target, ...rect } })}
          />
        )}

        {scene.type === "drag-drop" && scene.sceneImage && (
          <EditableSceneStage
            sceneImage={scene.sceneImage}
            rect={scene.target}
            overlayClassName="part1-highlight"
            onRectChange={rect => onChange({ target: { ...scene.target, ...rect } })}
          />
        )}
        {scene.type === "drag-drop" && scene.card?.image && (
          <img className="drag-card" src={scene.card.image} alt="" draggable={false} />
        )}

        {scene.type === "card-select" && (
          <div className="part1-options">
            {(() => {
              const correctIds = scene.correctIds ?? (scene.correctId ? [scene.correctId] : []);
              return (scene.options ?? []).map((opt, i) => (
                <div key={i} className={`part1-option${opt.id && correctIds.includes(opt.id) ? " is-correct" : ""}`}>
                  {opt.image && <img src={opt.image} alt="" />}
                </div>
              ));
            })()}
          </div>
        )}
      </div>
      <p className="admin-muted-text scene-preview-hint">
        Kéo chuột trực tiếp trên ảnh để chỉnh vùng toạ độ (nếu có).
      </p>
      </div>
      </div>
    </div>
  );
}
