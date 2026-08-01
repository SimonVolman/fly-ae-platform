type BrandProps = {
  className?: string;
};

export function Brand({ className = "brand-small" }: BrandProps) {
  return (
    <span className={`brand ${className}`}>
      <svg
        className="brand-mark"
        viewBox="0 0 88 50"
        fill="none"
        aria-hidden="true"
      >
        <path
          className="brand-mark-wing"
          d="M44 26C34 19.5 18 19 7.5 25.5C.5 29.8.5 37.7 6.5 41.8C14.5 47.3 29 39.3 44 29.4C59 39.3 73.5 47.3 81.5 41.8C87.5 37.7 87.5 29.8 80.5 25.5C70 19 54 19.5 44 26Z"
        />
        <circle className="brand-mark-head" cx="44" cy="15" r="6" />
        <path className="brand-mark-antenna" d="M35 7L30 2M53 7L58 2" />
      </svg>
      <span className="brand-word">fly.ae</span>
    </span>
  );
}
