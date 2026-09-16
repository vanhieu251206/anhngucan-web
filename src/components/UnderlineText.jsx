// Hiển thị lại chuỗi có tag <u>...</u> (soạn bằng UnderlineTextInput.jsx) thành React element thật —
// tự parse thủ công, KHÔNG dùng dangerouslySetInnerHTML, chỉ nhận diện đúng cặp <u></u> nên an toàn.
export default function UnderlineText({ text }) {
  const str = text ?? "";
  const parts = [];
  const regex = /<u>(.*?)<\/u>/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) parts.push(str.slice(lastIndex, match.index));
    parts.push(<u key={key++}>{match[1]}</u>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < str.length) parts.push(str.slice(lastIndex));
  return <>{parts}</>;
}
