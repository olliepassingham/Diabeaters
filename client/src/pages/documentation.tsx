import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { Link } from "wouter";

export default function Documentation() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden sticky top-0 z-50 bg-background border-b p-4 flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" data-testid="button-back-home">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to App
          </Button>
        </Link>
        <Button onClick={handlePrint} data-testid="button-print">
          <Printer className="h-4 w-4 mr-2" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:p-4">
        <header className="text-center mb-12 print:mb-8">
          <h1 className="text-4xl font-bold mb-2 print:text-3xl">Diabeaters</h1>
          <p className="text-xl text-muted-foreground print:text-lg">User Guide & Documentation</p>
          <p className="text-sm text-muted-foreground mt-2">Version 1.0 - January 2026</p>
        </header>

        <div className="prose prose-slate dark:prose-invert max-w-none print:prose-sm">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-8 print:bg-amber-50 print:border-amber-200">
            <p className="text-amber-800 dark:text-amber-200 font-medium m-0 print:text-amber-800">
              Important: Diabeaters provides general guidance only and is NOT a substitute for medical advice. 
              Always consult your healthcare team before making changes to your diabetes management.
            </p>
          </div>

          <section className="mb-10 print:mb-6 page-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4 print:text-xl">Dashboard</h2>
            <p className="mb-4">Your personalised home screen showing the most important information at a glance.</p>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">What you see:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Health status indicator (Stable, Watch, or Action needed)</li>
              <li>Customisable widgets showing your key information</li>
              <li>Quick access to supplies running low</li>
              <li>Active scenarios (sick day or travel mode) status</li>
              <li>Upcoming appointments</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Customising your dashboard:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Click the gear icon to enter edit mode</li>
              <li>Toggle widgets on or off based on your preferences</li>
              <li>Drag widgets to reorder them</li>
              <li>Changes save automatically</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Available widgets:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Health Status:</strong> Overall status based on supply levels and active scenarios</li>
              <li><strong>AI Coach:</strong> Personalised tips and reminders</li>
              <li><strong>Quick Stats:</strong> Key numbers at a glance</li>
              <li><strong>Supply Alert:</strong> Items running low</li>
              <li><strong>Scenario Status:</strong> Active sick day or travel modes</li>
              <li><strong>Upcoming Appointments:</strong> Next healthcare visits</li>
              <li><strong>Quick Actions:</strong> Shortcuts to common tasks</li>
            </ul>
          </section>

          <section className="mb-10 print:mb-6 page-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4 print:text-xl">Supply Tracker</h2>
            <p className="mb-4">Monitor your diabetes supplies and get alerts before you run out.</p>

            <h3 className="text-lg font-semibold mt-4 mb-2">What you can track:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Insulin:</strong> Rapid-acting, long-acting, mixed insulin</li>
              <li><strong>Needles:</strong> Pen needles, syringes</li>
              <li><strong>CGM Sensors:</strong> Continuous glucose monitors</li>
              <li><strong>Test Strips:</strong> Blood glucose test strips</li>
              <li><strong>Lancets:</strong> Finger-prick lancets</li>
              <li><strong>Pump Supplies:</strong> Infusion sets, reservoirs (if applicable)</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Adding supplies:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Click "Add Supply" to add a new item</li>
              <li>Enter the current quantity you have</li>
              <li>Set your daily usage rate</li>
              <li>The app calculates when you'll run out</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Depletion forecasts:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Green:</strong> More than 14 days of supply remaining</li>
              <li><strong>Amber:</strong> 7-14 days remaining - consider reordering</li>
              <li><strong>Red:</strong> Less than 7 days - order now</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Managing supplies:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Edit quantities when you receive new supplies</li>
              <li>View usage history and trends</li>
              <li>Delete items you no longer use</li>
              <li>AI predictions help anticipate future needs</li>
            </ul>
          </section>

          <section className="mb-10 print:mb-6 page-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4 print:text-xl">AI Advisor</h2>
            <p className="mb-4">Get personalised guidance for meals, exercise, and activities based on your settings.</p>

            <h3 className="text-lg font-semibold mt-4 mb-2">Meal Planning Tab:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Describe what you're planning to eat</li>
              <li>Get carbohydrate estimates for your meal</li>
              <li>Receive insulin dose suggestions based on your ratios</li>
              <li><strong>Exercise integration:</strong> Toggle "Planning Around Exercise" to adjust doses if you'll be active</li>
              <li>Timing options: before, during, or after exercise affects recommendations</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Exercise Planning Tab:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Describe your planned activity (walking, gym, swimming, etc.)</li>
              <li>Get pre-exercise preparation advice</li>
              <li>During-exercise carbohydrate recommendations</li>
              <li>Post-exercise recovery guidance including snack suggestions</li>
              <li>Insulin adjustment suggestions based on activity intensity</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Activity Session Tab:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Plan a complete workout day from start to finish</li>
              <li><strong>Pre-workout:</strong> Fuel recommendations and timing</li>
              <li><strong>During workout:</strong> Carbohydrate intake guidance</li>
              <li><strong>Post-workout:</strong> Recovery meals with adjusted insulin</li>
              <li>All recommendations consider your personal settings</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Ratio Adviser Tab:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Get help understanding your insulin-to-carb ratios</li>
              <li>Guidance on correction factors</li>
              <li>Time-of-day variations explained</li>
            </ul>

            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4 print:bg-blue-50">
              <p className="text-blue-800 dark:text-blue-200 text-sm m-0 print:text-blue-800">
                All AI recommendations are clearly labelled "Not medical advice" and are based on general guidance. 
                Always verify with your healthcare team.
              </p>
            </div>
          </section>

          <section className="mb-10 print:mb-6 page-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4 print:text-xl">Scenarios</h2>
            <p className="mb-4">Situation-specific guidance for managing diabetes during challenging times.</p>

            <h3 className="text-lg font-semibold mt-4 mb-2">Sick Day Mode:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Activate when you're feeling unwell</li>
              <li>Choose severity level: mild, moderate, or severe</li>
              <li>Get adjusted monitoring reminders</li>
              <li>Hydration and ketone checking guidance</li>
              <li>When to seek medical help</li>
              <li>Sick day rules for insulin adjustments</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Travel Mode:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Activate before and during travel</li>
              <li>Timezone adjustment guidance</li>
              <li>Packing checklist for diabetes supplies</li>
              <li>Airport security tips</li>
              <li>Storage and temperature advice</li>
              <li>Access to Emergency Card in multiple languages</li>
            </ul>
          </section>

          <section className="mb-10 print:mb-6 page-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4 print:text-xl">Appointments</h2>
            <p className="mb-4">Keep track of your healthcare appointments and never miss a check-up.</p>

            <h3 className="text-lg font-semibold mt-4 mb-2">Appointment types:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Clinic:</strong> Diabetes clinic visits</li>
              <li><strong>GP:</strong> General practice appointments</li>
              <li><strong>Eye Screening:</strong> Retinopathy checks</li>
              <li><strong>Foot Check:</strong> Podiatry appointments</li>
              <li><strong>Blood Test:</strong> HbA1c and other tests</li>
              <li><strong>Other:</strong> Any other healthcare visits</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Features:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Add appointment title, date, time, and location</li>
              <li>Add notes to remember what to discuss</li>
              <li>Mark appointments as completed</li>
              <li>View upcoming appointments on your dashboard</li>
              <li>Edit or delete appointments as needed</li>
            </ul>
          </section>

          <section className="mb-10 print:mb-6 page-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4 print:text-xl">Community</h2>
            <p className="mb-4">Connect with others managing diabetes and stay informed.</p>

            <h3 className="text-lg font-semibold mt-4 mb-2">Posts Tab:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Browse questions and discussions from the community</li>
              <li>Filter by topic: Meals, Dosing, Exercise, CGM Tech, Lifestyle, Travel</li>
              <li>View posts from people you follow</li>
              <li>Ask your own questions (can post anonymously)</li>
              <li>Reply to help others with your experience</li>
              <li>Report inappropriate content</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">News Tab:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Latest diabetes news from trusted sources</li>
              <li>Articles from Diabetes UK, JDRF, and other organisations</li>
              <li>Headlines, summaries, and links to full articles</li>
              <li>Automatically updated content</li>
              <li>Refresh button to get the latest news</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Events Tab:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Discover diabetes-related events and meet-ups</li>
              <li>Support groups in your area</li>
              <li>Online webinars and workshops</li>
              <li>Charity walks and awareness events</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Reels Tab:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Short video content from diabetes educators</li>
              <li>Meal prep ideas and recipes</li>
              <li>Exercise tips for blood sugar management</li>
              <li>Daily management tips and tricks</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Messages Tab:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Private messaging with community members</li>
              <li>Connect one-on-one for support</li>
              <li>Share experiences privately</li>
            </ul>

            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 mt-4 print:bg-slate-100">
              <p className="text-slate-700 dark:text-slate-300 text-sm m-0 print:text-slate-700">
                Community posts are personal experiences and opinions, not medical advice. 
                Always verify information with your healthcare team.
              </p>
            </div>
          </section>

          <section className="mb-10 print:mb-6 page-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4 print:text-xl">Shop</h2>
            <p className="mb-4">Browse diabetes management products and accessories.</p>

            <h3 className="text-lg font-semibold mt-4 mb-2">Categories:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Glucose monitors and CGM accessories</li>
              <li>Insulin storage and cooling solutions</li>
              <li>Medical ID jewellery and cards</li>
              <li>Carrying cases and organizers</li>
              <li>Educational books and resources</li>
            </ul>

            <p className="text-sm text-muted-foreground mt-4 print:text-slate-600">
              Note: Shop section provides product information and links to external retailers.
            </p>
          </section>

          <section className="mb-10 print:mb-6 page-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4 print:text-xl">Help Now (Emergency)</h2>
            <p className="mb-4">Quick access to emergency services and contacts when you need help fast.</p>

            <h3 className="text-lg font-semibold mt-4 mb-2">Emergency services:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>999:</strong> One-tap call to emergency services</li>
              <li><strong>NHS 111:</strong> Quick access to non-emergency medical advice</li>
              <li>Your personal emergency contacts</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Emergency contacts:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Add trusted contacts who can help in an emergency</li>
              <li>One-tap calling to your contacts</li>
              <li>Edit or remove contacts as needed</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Location:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Always visible in the sidebar for quick access</li>
              <li>Red button makes it easy to find in a crisis</li>
            </ul>
          </section>

          <section className="mb-10 print:mb-6 page-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4 print:text-xl">Emergency Card</h2>
            <p className="mb-4">A digital medical ID card you can show to first responders or medical staff.</p>

            <h3 className="text-lg font-semibold mt-4 mb-2">What it shows:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>That you have Type 1 Diabetes</li>
              <li>Your name and emergency contact</li>
              <li>Critical medical information</li>
              <li>What to do if you're found unresponsive</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Multi-language support:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Available in 10+ languages for travel</li>
              <li>English, Spanish, French, German, Italian, Portuguese, Dutch, Greek, Turkish, Arabic, and more</li>
              <li>Switch languages instantly</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Accessing the card:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Available through Travel Mode in Scenarios</li>
              <li>Can be shown on your phone screen</li>
              <li>Save or print for your wallet</li>
            </ul>
          </section>

          <section className="mb-10 print:mb-6 page-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4 print:text-xl">Settings</h2>
            <p className="mb-4">Personalise Diabeaters with your information and preferences.</p>

            <h3 className="text-lg font-semibold mt-4 mb-2">Profile settings:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your name and date of birth</li>
              <li>Diabetes type (currently Type 1)</li>
              <li>Insulin delivery method (pen, pump)</li>
              <li>Years since diagnosis</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Diabetes settings:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Total Daily Dose (TDD):</strong> Your typical daily insulin amount</li>
              <li><strong>Carb Ratio:</strong> Units of insulin per grams of carbs (e.g., 1:10)</li>
              <li><strong>Correction Factor:</strong> How much 1 unit drops your blood sugar</li>
              <li><strong>Target Range:</strong> Your goal blood glucose range</li>
              <li><strong>Units:</strong> mmol/L or mg/dL preference</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">App settings:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Light or dark mode</li>
              <li>Notification preferences</li>
              <li>Low supply alert thresholds</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Emergency contacts:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Add and manage emergency contacts</li>
              <li>These appear in Help Now and Emergency Card</li>
            </ul>
          </section>

          <section className="mb-10 print:mb-6 page-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4 print:text-xl">Data Storage</h2>
            <p className="mb-4">Understanding how Diabeaters stores your information.</p>

            <h3 className="text-lg font-semibold mt-4 mb-2">Local storage:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>All your data is stored locally on your device</li>
              <li>No data is sent to external servers (except AI features)</li>
              <li>Your information stays private to you</li>
              <li>Data persists between sessions</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">What's stored:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Profile and settings</li>
              <li>Supply inventory and history</li>
              <li>Appointments</li>
              <li>Community posts and messages</li>
              <li>Activity logs</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Clearing data:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Clearing browser data will remove your Diabeaters data</li>
              <li>Consider exporting important information first</li>
            </ul>
          </section>

          <section className="mb-10 print:mb-6">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4 print:text-xl">Getting Help</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">In-app help:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Look for the (i) info icon on each page</li>
              <li>Click for context-specific guidance</li>
              <li>Each section explains its features</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">Medical emergencies:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the red Help Now button in the sidebar</li>
              <li>Call 999 for life-threatening emergencies</li>
              <li>Call NHS 111 for urgent medical advice</li>
            </ul>
          </section>

          <footer className="border-t pt-6 mt-12 text-center text-sm text-muted-foreground print:mt-8 print:pt-4">
            <p className="mb-2">Prototype - Copyright PassingTime Ltd 2026</p>
            <p>This documentation is for the Diabeaters application.</p>
            <p className="mt-4 font-medium">
              Remember: This app provides general guidance only. Always consult your healthcare team for medical advice.
            </p>
          </footer>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            margin: 1.5cm;
            size: A4;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
