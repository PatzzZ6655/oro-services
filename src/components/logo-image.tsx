import Image from "next/image";

type LogoImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
};

export function LogoImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
}: LogoImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
