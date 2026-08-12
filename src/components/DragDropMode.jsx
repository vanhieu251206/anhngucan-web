import { useMemo, useState } from "react";

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function DragDropMode({ lesson }) {
  const items = useMemo(() => shuffle(lesson.dragdrop), [lesson]);
  const targets = useMemo(() => shuffle(lesson.dragdrop), [lesson]);
  const [filled, setFilled] = useState({}); // target -> matched item data
  const [wrongMsg, setWrongMsg] = useState("");

  const done = targets.length > 0 && targets.every(t => filled[t.target]);

  function handleDrop(e, target) {
    e.preventDefault();
    if (filled[target.target]) return;
    const dragged = e.dataTransfer.getData("text/plain");
    if (dragged === target.target) {
      const matched = lesson.dragdrop.find(x => x.item === dragged);
      setFilled(prev => ({ ...prev, [target.target]: matched }));
      setWrongMsg("");
    } else {
      setWrongMsg("Sai rồi, thử lại nhé!");
    }
  }

  return (
    <>
      <div id="dragdrop-items" className="dragdrop-row">
        {items.map((d, i) => (
          <div
            key={i}
            className="drag-item"
            draggable
            onDragStart={e => e.dataTransfer.setData("text/plain", d.item)}
          >
            <img src={d.image} onError={e => (e.currentTarget.style.display = "none")} />
            <span>{d.item}</span>
          </div>
        ))}
      </div>

      <div id="dragdrop-targets" className="dragdrop-row">
        {targets.map((d, i) => {
          const match = filled[d.target];
          return (
            <div
              key={i}
              className={`drop-target${match ? " correct filled" : ""}`}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, d)}
            >
              {match ? (
                <>
                  <img src={match.image} onError={e => (e.currentTarget.style.display = "none")} />
                  <span>{match.item}</span>
                </>
              ) : (
                <span>{d.target}</span>
              )}
            </div>
          );
        })}
      </div>

      <p id="dragdrop-result" className={done ? "result-ok" : wrongMsg ? "result-bad" : ""}>
        {done ? "🎉 Hoàn thành! Giỏi quá!" : wrongMsg}
      </p>
    </>
  );
}
