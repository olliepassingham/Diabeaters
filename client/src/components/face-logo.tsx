import logoImage from "@assets/image_1766853776303.png";

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
      src={logoImage}
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
