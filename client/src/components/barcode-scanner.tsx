import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Camera, ScanLine } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      setError(null);
      setIsScanning(false);
      const scannerId = "barcode-scanner-container";
      
      if (!document.getElementById(scannerId)) {
        return;
      }

      scannerRef.current = new Html5Qrcode(scannerId);
      
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          onScan(decodedText);
          stopScanner();
        },
        () => {}
      );
      
      setIsScanning(true);
    } catch (err) {
      console.error("Failed to start scanner:", err);
      setIsScanning(false);
      setError("Unable to access camera. Please ensure camera permissions are granted.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Scan Barcode</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} data-testid="button-close-scanner">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {error ? (
            <div className="text-center py-8">
              <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button onClick={startScanner} data-testid="button-retry-scanner">
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div 
                id="barcode-scanner-container" 
                ref={containerRef}
                className="w-full aspect-[4/3] bg-muted rounded-lg overflow-hidden"
                data-testid="barcode-scanner-view"
              />
              <p className="text-xs text-muted-foreground text-center mt-4">
                Point your camera at the barcode on your supply packaging
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
