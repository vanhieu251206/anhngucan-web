export default function Logo({ size = 40 }) {
  return (
    <span className="logo">
      <img
        src="assets/img/logo.png"
        alt="Anh Ngữ C.A.N"
        width={size}
        height={size}
        className="logo-mark"
      />
      <span className="logo-text">
        Anh Ngữ <strong>C.A.N</strong>
      </span>
    </span>
  );
}
