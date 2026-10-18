import Image from "next/image";

export function CatalogueImage({
  src,
  alt,
  size,
  priority = false,
}: {
  src: string | null;
  alt: string;
  size: number;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <span
        className="grid place-items-center rounded-box bg-base-200 px-2 text-center text-xs text-base-content/50"
        style={{ width: size, height: size }}
      >
        Image indisponible
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}
