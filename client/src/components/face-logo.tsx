interface FaceLogoProps {
  size?: number;
  className?: string;
  variant?: "nav" | "watermark";
}

export function FaceLogo({ 
  size = 32, 
  className = "",
  variant = "nav"
}: FaceLogoProps) {
  if (variant === "nav") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        className={`text-primary ${className}`}
        aria-hidden="true"
      >
        <path
          d="M50 10
             C35 10, 25 25, 24 40
             C23 50, 25 60, 28 70
             C23 72, 20 77, 21 82
             C22 87, 26 90, 30 89
             C33 100, 40 108, 50 115
             
             M45 35
             C42 33, 38 34, 37 37
             C36 40, 38 43, 42 43
             
             M62 38
             C59 36, 55 37, 54 40
             C53 43, 55 46, 59 46
             
             M50 48
             C50 48, 49 58, 50 65
             C51 68, 53 69, 55 68
             
             M42 78
             C45 82, 50 84, 55 82
             C58 80, 60 78, 58 76
             
             M50 115
             C60 108, 67 100, 70 90
             C76 75, 77 60, 76 45
             C75 35, 70 25, 62 18
             C55 12, 52 10, 50 10
             
             M78 40
             C80 48, 81 55, 80 62
             C82 65, 85 67, 87 65
             C90 63, 91 58, 88 55
             C86 50, 82 42, 78 40"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  return null;
}

export function FaceLogoWatermark({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 flex items-start justify-center pointer-events-none overflow-hidden ${className}`}>
      <div className="relative -top-8">
        <svg
          width="280"
          height="320"
          viewBox="0 0 100 115"
          fill="none"
          aria-hidden="true"
          className="text-foreground opacity-[0.03]"
        >
          <path
            d="M50 10
               C35 10, 25 25, 24 40
               C23 50, 25 60, 28 70
               C23 72, 20 77, 21 82
               C22 87, 26 90, 30 89
               C33 100, 40 108, 50 115
               
               M45 35
               C42 33, 38 34, 37 37
               C36 40, 38 43, 42 43
               
               M62 38
               C59 36, 55 37, 54 40
               C53 43, 55 46, 59 46
               
               M50 48
               C50 48, 49 58, 50 65
               C51 68, 53 69, 55 68
               
               M42 78
               C45 82, 50 84, 55 82
               C58 80, 60 78, 58 76
               
               M50 115
               C60 108, 67 100, 70 90
               C76 75, 77 60, 76 45
               C75 35, 70 25, 62 18
               C55 12, 52 10, 50 10
               
               M78 40
               C80 48, 81 55, 80 62
               C82 65, 85 67, 87 65
               C90 63, 91 58, 88 55
               C86 50, 82 42, 78 40"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}
