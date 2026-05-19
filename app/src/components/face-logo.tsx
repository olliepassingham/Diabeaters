import { BRAND_MARK_IMAGE_SRC } from "@/lib/brand-mark";

interface FaceLogoProps {
  size?: number;
  className?: string;
}

export function FaceLogo({ 
  size = 32, 
  className = ""
}: FaceLogoProps) {
  return (
    <img
      src={BRAND_MARK_IMAGE_SRC}
      alt="Diabeaters logo"
      width={size}
      height={size}
      className={`object-contain dark:invert ${className}`}
    />
  );
}

export function FaceLogoWatermark({ className = "" }: { className?: string }) {
  return null;
}
