import Image from "next/image";

type BrandProps = {
  className?: string;
};

export function Brand({ className = "brand-small" }: BrandProps) {
  return (
    <span className={`brand ${className}`}>
      <Image
        className="brand-logo"
        src="/brand.svg"
        width="121"
        height="32"
        alt="fly.ae"
        unoptimized
      />
    </span>
  );
}
