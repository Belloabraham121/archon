import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  compact?: boolean;
  inverse?: boolean;
  priority?: boolean;
};

export function BrandLogo({
  compact = false,
  inverse = false,
  priority = false,
}: BrandLogoProps) {
  const dimensions = compact
    ? { width: 40, height: 40 }
    : { width: 156, height: 56 };

  return (
    <Link
      href="/"
      aria-label="Archon home"
      className="inline-flex shrink-0 items-center rounded-sm"
    >
      <Image
        src={compact ? "/brand/archon-mark.svg" : "/brand/archon-wordmark.svg"}
        alt=""
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        className={`${compact ? "size-10" : "h-auto w-[8.75rem]"} ${inverse ? "brightness-0 invert" : ""}`}
      />
    </Link>
  );
}
