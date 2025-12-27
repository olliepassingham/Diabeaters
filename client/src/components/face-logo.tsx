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
      alt="Diabeater logo"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ filter: "invert(var(--logo-invert, 0))" }}
    />
  );
}

export function FaceLogoWatermark({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 flex items-start justify-center pointer-events-none overflow-hidden ${className}`}>
      <div className="relative -top-4">
        <img
          src={logoImage}
          alt=""
          width={200}
          height={280}
          className="object-contain opacity-[0.04] dark:opacity-[0.06]"
          style={{ filter: "var(--logo-filter, invert(0))" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
