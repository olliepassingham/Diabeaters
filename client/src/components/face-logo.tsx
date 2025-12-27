interface FaceLogoProps {
  size?: number;
  opacity?: number;
  className?: string;
  variant?: "header" | "nav" | "watermark";
}

export function FaceLogo({ 
  size = 120, 
  opacity = 0.06, 
  className = "",
  variant = "header"
}: FaceLogoProps) {
  const variantStyles = {
    header: { size: size, opacity: opacity },
    nav: { size: 32, opacity: 0.8 },
    watermark: { size: size, opacity: 0.04 },
  };

  const { size: finalSize, opacity: finalOpacity } = variantStyles[variant];

  return (
    <svg
      width={finalSize}
      height={finalSize}
      viewBox="0 0 200 280"
      fill="none"
      className={className}
      style={{ opacity: finalOpacity }}
      aria-hidden="true"
    >
      <path
        d="M100 20
           C70 20, 50 50, 48 80
           C46 100, 50 120, 55 140
           C45 145, 40 155, 42 165
           C44 175, 52 180, 60 178
           C65 200, 75 220, 90 240
           C95 248, 100 255, 105 260
           
           M95 75
           C90 72, 82 73, 80 78
           C78 83, 82 88, 88 88
           
           M130 85
           C125 82, 117 83, 115 88
           C113 93, 117 98, 123 98
           
           M100 100
           C100 100, 98 120, 100 135
           C102 140, 105 142, 108 140
           
           M85 165
           C90 172, 100 175, 110 172
           C115 170, 118 165, 115 162
           
           M105 260
           C115 250, 125 235, 130 215
           C140 185, 145 155, 142 125
           C140 100, 135 75, 125 55
           C115 35, 105 25, 100 20
           
           M155 80
           C158 95, 160 110, 158 125
           C162 130, 168 135, 172 132
           C178 128, 180 120, 175 115
           C172 105, 165 90, 155 80
           
           M130 175
           C135 180, 142 185, 145 190
           C148 195, 148 202, 145 208
           C142 215, 135 220, 128 222"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function FaceLogoWatermark({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 flex items-start justify-center pointer-events-none overflow-hidden ${className}`}>
      <div className="relative -top-8 opacity-[0.035]">
        <svg
          width="280"
          height="380"
          viewBox="0 0 200 280"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M100 20
               C70 20, 50 50, 48 80
               C46 100, 50 120, 55 140
               C45 145, 40 155, 42 165
               C44 175, 52 180, 60 178
               C65 200, 75 220, 90 240
               C95 248, 100 255, 105 260
               
               M95 75
               C90 72, 82 73, 80 78
               C78 83, 82 88, 88 88
               
               M130 85
               C125 82, 117 83, 115 88
               C113 93, 117 98, 123 98
               
               M100 100
               C100 100, 98 120, 100 135
               C102 140, 105 142, 108 140
               
               M85 165
               C90 172, 100 175, 110 172
               C115 170, 118 165, 115 162
               
               M105 260
               C115 250, 125 235, 130 215
               C140 185, 145 155, 142 125
               C140 100, 135 75, 125 55
               C115 35, 105 25, 100 20
               
               M155 80
               C158 95, 160 110, 158 125
               C162 130, 168 135, 172 132
               C178 128, 180 120, 175 115
               C172 105, 165 90, 155 80
               
               M130 175
               C135 180, 142 185, 145 190
               C148 195, 148 202, 145 208
               C142 215, 135 220, 128 222"
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
