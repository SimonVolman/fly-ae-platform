import Image from "next/image";

type BrandProps = {
  className?: string;
  figmaTopbar?: boolean;
};

export function Brand({
  className = "brand-small",
  figmaTopbar = false,
}: BrandProps) {
  const src = figmaTopbar ? "/brand-dark-blue.svg" : "/brand-v2.svg";
  const dimensions = figmaTopbar
    ? { width: 84.1397, height: 29.4453 }
    : { width: 418, height: 144 };

  return (
    <span
      className={figmaTopbar ? "brand brand-figma-topbar" : `brand ${className}`}
    >
      <Image
        className="brand-logo"
        src={src}
        width={dimensions.width}
        height={dimensions.height}
        alt="fly.ae"
        unoptimized
      />
    </span>
  );
}
