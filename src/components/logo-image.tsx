import Image from "next/image";

type LogoImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  className?: string;
  preload?: boolean;
};

export function LogoImage({
  src,
  alt,
  width,
  height,
  sizes,
  className,
  preload = false,
}: LogoImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      preload={preload}
      className={className}
    />
  );
}
