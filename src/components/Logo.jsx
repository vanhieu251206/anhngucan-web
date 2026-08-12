export default function Logo({ size = 40 }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="20" fill="#FF7A45" />
        <circle cx="11" cy="14" r="3" fill="#FFC94A" />
        <circle cx="29" cy="27" r="2.4" fill="#2FB6C4" />
        <text
          x="20" y="24"
          textAnchor="middle"
          fontFamily="'Baloo 2', sans-serif"
          fontWeight="700"
          fontSize="14"
          fill="#ffffff"
        >
          C.A.N
        </text>
      </svg>
      <span className="logo-text">
        Anh Ngữ <strong>C.A.N</strong>
      </span>
    </span>
  );
}
