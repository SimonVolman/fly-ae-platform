import Image from "next/image";

type BrandProps = {
  className?: string;
};

export function Brand({ className = "brand-small" }: BrandProps) {
  return (
    <span className={`brand ${className}`}>
      <Image
        className="brand-logo"
        src="/brand_flyae.svg"
        width="91"
        height="24"
        alt="fly.ae"
        unoptimized
      />
    </span>
  );
}
