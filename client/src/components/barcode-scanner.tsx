import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ScanLine, AlertCircle } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onClose }: BarcodeScannerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Scan Barcode</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-scanner">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Barcode scanning is coming soon!
            </p>
            <p className="text-xs text-muted-foreground">
              You can manually enter the barcode in the supply form.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
