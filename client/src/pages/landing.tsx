import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FaceLogo } from "@/components/face-logo";
import { Heart, Package, Brain, Shield, Activity, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-background/80 border-b">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaceLogo size={36} />
            <span className="font-semibold text-xl">Diabeaters</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/api/login">
              <Button data-testid="button-login">
                Sign In
              </Button>
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <section className="py-16 md:py-24">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                    Manage your diabetes with confidence
                  </h1>
                  <p className="text-xl text-muted-foreground">
                    Diabeaters helps you stay ahead of your supplies, get personalised activity advice, and connect with a supportive community - all in one place.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <a href="/api/login">
                    <Button size="lg" className="w-full sm:w-auto text-lg px-8" data-testid="button-get-started">
                      Get Started
                    </Button>
                  </a>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span>Free to use</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-500" />
                    <span>Built for UK diabetics</span>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-3xl p-8 lg:p-12">
                  <div className="grid grid-cols-2 gap-4">
                    <FeaturePreview 
                      icon={<Package className="h-6 w-6" />}
                      title="Supply Tracker"
                      description="Never run low on insulin or supplies"
                    />
                    <FeaturePreview 
                      icon={<Activity className="h-6 w-6" />}
                      title="Activity Advice"
                      description="AI-powered recommendations"
                    />
                    <FeaturePreview 
                      icon={<Brain className="h-6 w-6" />}
                      title="Smart Alerts"
                      description="Proactive low supply warnings"
                    />
                    <FeaturePreview 
                      icon={<Users className="h-6 w-6" />}
                      title="Community"
                      description="Connect with others"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="py-16 border-t">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Why Diabeaters?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                We believe in anticipation over logging. Our tools help you prevent emergencies rather than just record data.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <FeatureCard 
                icon={<Package className="h-8 w-8 text-primary" />}
                title="Supply Management"
                description="Track your insulin, needles, CGM sensors and more. Get alerts before you run low with AI-powered depletion forecasts."
              />
              <FeatureCard 
                icon={<Activity className="h-8 w-8 text-primary" />}
                title="Activity Adviser"
                description="Get personalised carbohydrate and insulin adjustment recommendations based on your planned activities."
              />
              <FeatureCard 
                icon={<Users className="h-8 w-8 text-primary" />}
                title="Community Support"
                description="Connect with other diabetics, share tips, and find local events. You're not alone in this journey."
              />
            </div>
          </section>

          <section className="py-16 border-t">
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="p-8 md:p-12 text-center">
                <h2 className="text-2xl md:text-3xl font-bold mb-4">
                  Ready to take control?
                </h2>
                <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                  Join thousands of UK diabetics who use Diabeaters to manage their condition with confidence.
                </p>
                <a href="/api/login">
                  <Button size="lg" className="text-lg px-8" data-testid="button-cta-sign-up">
                    Sign Up - It's Free
                  </Button>
                </a>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <footer className="border-t py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <FaceLogo size={24} />
            <span className="text-sm text-muted-foreground">
              Diabeaters - Not medical advice. Always consult your healthcare team.
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Made with care in the UK
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeaturePreview({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card/80 backdrop-blur rounded-xl p-4 space-y-2 hover-elevate">
      <div className="text-primary">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-6 space-y-4">
        <div>{icon}</div>
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
