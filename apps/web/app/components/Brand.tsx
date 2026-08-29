import Image from "next/image";

type BrandProps = {
  className?: string;
};

export function Brand({ className = "brand-small" }: BrandProps) {
  return (
    <span className={`brand ${className}`}>
      <Image
        className="brand-logo"
        src="/brand-v2.svg"
        width="418"
        height="144"
        alt="fly.ae"
        unoptimized
      />
    </span>
  );
}
