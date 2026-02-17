import { useState } from "react";
import { User, Crown, HelpCircle, Sparkles, Shield, FileText, Moon, Sun, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";

type DialogType = "plan" | "question" | "whats-new" | "privacy" | "terms" | null;

export function ProfileMenu() {
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const handleSubmitFeedback = () => {
    if (feedbackText.trim()) {
      toast({
        title: "Thank you!",
        description: "Your feedback has been submitted.",
      });
      setFeedbackText("");
      setActiveDialog(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" data-testid="button-profile-menu">
            <User className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem 
            onClick={() => setActiveDialog("plan")}
            data-testid="menu-item-plan"
            className="cursor-pointer"
          >
            <Crown className="mr-2 h-4 w-4" />
            View my Plan
            <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => setActiveDialog("question")}
            data-testid="menu-item-question"
            className="cursor-pointer"
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            Got a question?
            <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => setActiveDialog("whats-new")}
            data-testid="menu-item-whats-new"
            className="cursor-pointer"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            What's new
            <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={() => setActiveDialog("privacy")}
            data-testid="menu-item-privacy"
            className="cursor-pointer"
          >
            <Shield className="mr-2 h-4 w-4" />
            Privacy Policy
            <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => setActiveDialog("terms")}
            data-testid="menu-item-terms"
            className="cursor-pointer"
          >
            <FileText className="mr-2 h-4 w-4" />
            Terms & Conditions
            <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2">
              {theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
              <Label htmlFor="dark-mode" className="text-sm font-normal">
                Dark mode
              </Label>
            </div>
            <Switch
              id="dark-mode"
              checked={theme === "dark"}
              onCheckedChange={toggleTheme}
              data-testid="switch-dark-mode"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={activeDialog === "plan"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Your Plan
            </DialogTitle>
            <DialogDescription>
              Manage your Diabeaters subscription
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-lg">Free Plan</span>
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Current</span>
              </div>
              <p className="text-sm text-muted-foreground">
                You have access to all core features including supply tracking, activity adviser, and community.
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-lg">Premium</span>
                <span className="text-sm text-muted-foreground">Coming soon</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Enhanced features including advanced analytics, unlimited AI queries, and priority support.
              </p>
              <Button variant="outline" disabled className="w-full">
                Notify me when available
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "question"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-500" />
              Got a question?
            </DialogTitle>
            <DialogDescription>
              Share feedback, suggest features, or report issues
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Textarea
              placeholder="Tell us what's on your mind... We'd love to hear your suggestions, questions, or any issues you've encountered."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="min-h-[120px]"
              data-testid="textarea-feedback"
            />
            <Button 
              onClick={handleSubmitFeedback}
              disabled={!feedbackText.trim()}
              className="w-full"
              data-testid="button-submit-feedback"
            >
              Submit Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "whats-new"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              What's New
            </DialogTitle>
            <DialogDescription>
              Latest updates and improvements
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">Unit Standardisation</span>
                  <span className="text-xs text-muted-foreground">Latest</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  All blood glucose and carb values now display in your selected units throughout the entire app, including AI responses.
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">Activity Adviser</span>
                  <span className="text-xs text-muted-foreground">New</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Personalised recommendations based on your diabetes settings, carb ratios, and correction factors.
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">Travel Mode</span>
                  <span className="text-xs text-muted-foreground">New</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Plan trips with automatic supply calculations, packing lists, and timezone guidance.
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">Community Features</span>
                  <span className="text-xs text-muted-foreground">New</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect with others, share experiences, and get peer support through our community forum.
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">Help Now</span>
                  <span className="text-xs text-muted-foreground">New</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Emergency mode with bystander instructions and automatic escalation for hypo events.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "privacy"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              Privacy Policy
            </DialogTitle>
            <DialogDescription>
              Last updated: January 2025
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">1. Information We Collect</h3>
              <p className="text-muted-foreground">
                Diabeaters collects health-related information you provide, including your name, diabetes type, insulin settings, and supply inventory. All data is stored locally on your device and is never uploaded to our servers.
              </p>
            </section>
            
            <section>
              <h3 className="font-semibold mb-2">2. How We Use Your Data</h3>
              <p className="text-muted-foreground">
                Your data is used solely to provide personalised diabetes management features. We do not sell your personal health information to third parties.
              </p>
            </section>
            
            <section>
              <h3 className="font-semibold mb-2">3. Data Storage</h3>
              <p className="text-muted-foreground">
                All your data is stored locally on your device. Nothing is sent to or stored on our servers. This means your health information stays private and under your control at all times.
              </p>
            </section>
            
            <section>
              <h3 className="font-semibold mb-2">4. Third-Party Services</h3>
              <p className="text-muted-foreground">
                We use OpenAI's API to provide AI-powered recommendations. Queries sent to the AI do not include personally identifiable information beyond your diabetes settings.
              </p>
            </section>
            
            <section>
              <h3 className="font-semibold mb-2">5. Your Rights</h3>
              <p className="text-muted-foreground">
                You can delete your data at any time through the Settings page. Under UK GDPR, you have the right to access, correct, or delete your personal data.
              </p>
            </section>
            
            <section>
              <h3 className="font-semibold mb-2">6. Contact</h3>
              <p className="text-muted-foreground">
                For privacy-related enquiries, please use the "Got a question?" feature in this menu.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "terms"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-500" />
              Terms & Conditions
            </DialogTitle>
            <DialogDescription>
              Last updated: January 2025
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">1. Acceptance of Terms</h3>
              <p className="text-muted-foreground">
                By using Diabeaters, you agree to these Terms & Conditions. If you do not agree, please do not use the application.
              </p>
            </section>
            
            <section>
              <h3 className="font-semibold mb-2 text-red-600 dark:text-red-400">2. Medical Disclaimer</h3>
              <p className="text-muted-foreground">
                <strong>Diabeaters is NOT a medical device and does NOT provide medical advice.</strong> All recommendations, calculations, and suggestions are for educational and informational purposes only. Always consult your healthcare provider before making changes to your diabetes management.
              </p>
            </section>
            
            <section>
              <h3 className="font-semibold mb-2">3. User Responsibility</h3>
              <p className="text-muted-foreground">
                You are solely responsible for verifying all calculations and recommendations. Never rely solely on this app for critical health decisions. Always carry backup supplies and follow your healthcare team's advice.
              </p>
            </section>
            
            <section>
              <h3 className="font-semibold mb-2">4. Accuracy of Information</h3>
              <p className="text-muted-foreground">
                While we strive for accuracy, we cannot guarantee that all information, calculations, or AI-generated advice is error-free. Use all features at your own risk.
              </p>
            </section>
            
            <section>
              <h3 className="font-semibold mb-2">5. Limitation of Liability</h3>
              <p className="text-muted-foreground">
                Diabeaters and its creators are not liable for any adverse health outcomes, injuries, or damages resulting from use of this application. This includes, but is not limited to, incorrect dosing, missed alerts, or technical failures.
              </p>
            </section>
            
            <section>
              <h3 className="font-semibold mb-2">6. Changes to Terms</h3>
              <p className="text-muted-foreground">
                We may update these terms at any time. Continued use of the app constitutes acceptance of updated terms.
              </p>
            </section>
            
            <section>
              <h3 className="font-semibold mb-2">7. Governing Law</h3>
              <p className="text-muted-foreground">
                These terms are governed by the laws of England and Wales.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}