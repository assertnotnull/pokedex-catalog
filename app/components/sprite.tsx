import Image from "next/image";

export function Sprite({
  src,
  size = 96,
}: {
  src: string | null;
  size?: number;
}) {
  if (!src) {
    return (
      <div
        className="grid place-items-center rounded-box bg-base-200 text-center text-xs text-base-content/60"
        style={{ width: size, height: size }}
      >
        Image absente
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}
