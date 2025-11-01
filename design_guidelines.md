# Diabeaters Design Guidelines

## Design Approach

**Selected Approach:** Design System with Healthcare-Specific Adaptations

Drawing from Material Design's clarity principles and healthcare app standards (MySugr, Glucose Buddy, Tidepool Loop), prioritizing accessibility, readability, and trust-building through clean, professional interfaces.

## Core Design Philosophy

Medical applications demand clarity, trust, and efficiency. The design emphasizes data hierarchy, quick scanning, and calm reassurance while maintaining professional credibility.

---

## Typography System

**Primary Font:** Inter or Roboto (Google Fonts)
- Headings: 600-700 weight, sizes 32px (h1), 24px (h2), 20px (h3)
- Body Text: 400 weight, 16px base size
- Data/Metrics: 500-600 weight for numerical values, 700 weight for critical alerts
- Small Text: 14px for labels and secondary information

**Line Height:** 1.6 for body text, 1.3 for headings
**Letter Spacing:** Slightly increased (0.01em) for medical terminology readability

---

## Layout System

**Spacing Primitives:** Tailwind units of 4, 6, and 8 (p-4, p-6, p-8, gap-4, etc.)
- Card padding: p-6
- Section spacing: py-8 on mobile, py-12 on desktop
- Component gaps: gap-4 for related items, gap-6 for section separation
- Dashboard margins: max-w-6xl centered container

**Grid Structure:**
- Desktop: 3-column grid for supply cards (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Mobile: Single column stack
- Dashboard layout: Sidebar navigation (w-64) + main content area on desktop, hamburger menu on mobile

---

## Component Library

### Navigation
**Top Navigation Bar:**
- Fixed header with app logo (left), user profile avatar (right)
- Mobile: Hamburger menu icon replacing full navigation
- Height: h-16
- Include notification bell icon with badge for low supply alerts

**Side Navigation (Desktop):**
- Dashboard overview
- Supply Tracker
- AI Advisor
- Settings/Profile
- Active state: subtle background treatment with left border accent

### Dashboard Cards

**Supply Item Cards:**
- White background with subtle shadow (shadow-md)
- Border radius: rounded-xl
- Display: Supply name (heading), current quantity (large numerical display), estimated days remaining (smaller text), visual progress bar
- Low supply warning: Yellow/amber alert banner at card top
- Critical supply: Red alert banner
- Layout: Icon (left) + content (center) + action button (right)

**Quick Stats Overview:**
- 3-card horizontal layout showing: Total Active Supplies, Items Low (<7 days), Recent Activity
- Large numbers (48px) with descriptive labels below
- Minimal decoration, focus on data

### AI Advisor Interface

**Chat-Style Interface:**
- Message bubbles: User messages (right-aligned), AI responses (left-aligned)
- Rounded message containers (rounded-2xl)
- Avatar icons for user and AI assistant
- Input field: Fixed bottom bar with rounded text input + send button
- Suggested prompts as clickable pills below input

**Recommendation Cards:**
- Structured output format with clear sections
- Activity type badge at top
- Recommendation displayed prominently
- Explanation in smaller text below
- "Apply to Profile" button for saving recommendations

### Forms and Input

**Input Fields:**
- Rounded borders (rounded-lg)
- Clear labels above fields
- Helper text below for guidance
- Number steppers for quantity inputs
- Date pickers for supply expiration dates

**Supply Entry Form:**
- Multi-step progress indicator at top
- Fields: Supply type (dropdown), Quantity (number), Expiration date (date picker), Daily usage rate (number)
- Submit button: Full-width on mobile, right-aligned on desktop

### Data Visualization

**Progress Bars:**
- Horizontal bars showing supply depletion (full = green spectrum, low = amber, critical = red spectrum)
- Height: h-2, rounded ends
- Animated fill on load

**Usage Trends (Simple Charts):**
- Line graph showing daily consumption over 7/14/30 days
- Minimal grid lines, clean axis labels
- Use chart library like Chart.js for consistency

### Alerts and Notifications

**In-App Banners:**
- Top of dashboard for critical alerts
- Dismissible with X button (right)
- Icon (left) + message (center) + action link (right)
- Padding: p-4

**Toast Notifications:**
- Bottom-right corner
- Auto-dismiss after 5 seconds
- Slide-in animation

### Buttons

**Primary Actions:** Rounded-lg, medium size (px-6 py-3)
**Secondary Actions:** Outlined style with same dimensions
**Icon Buttons:** Square (w-10 h-10), centered icon
**Danger Actions:** For deleting supply items, visually distinct treatment

---

## Page-Specific Layouts

### Dashboard (Home)
- Hero section: Welcome message + quick add supply button
- Stats overview (3 cards)
- Recent activity feed
- Low supply alerts section
- No large hero image needed; focus on functional dashboard

### Supply Tracker Page
- Filter/sort bar at top (tabs for All/Needles/Insulin/CGM)
- Grid of supply cards
- Floating action button (bottom-right) for adding new supply
- Empty state: Illustration + "Add your first supply" CTA

### AI Advisor Page
- Chat interface occupies full content area
- Quick action cards at top: "Plan Meal", "Before Exercise", "Adjust Ratio"
- Conversation history scrollable
- Input bar fixed at bottom

### Settings/Profile
- Two-column layout on desktop (navigation tabs left, content right)
- Single column on mobile with tabs at top
- Sections: Personal Info, Insulin Ratios, Notification Preferences, Data Export

---

## Accessibility Standards

- WCAG AA contrast ratios minimum
- Focus indicators on all interactive elements (2px outline)
- Keyboard navigation fully supported
- Screen reader friendly labels for all icons and metrics
- Font sizes no smaller than 14px

---

## Micro-Interactions

**Minimal Animations:**
- Card hover: Subtle lift (translateY(-2px)) with shadow increase
- Button click: Brief scale down (scale(0.98))
- Loading states: Skeleton screens for data fetch
- No decorative animations; focus on functional feedback

---

## Responsive Breakpoints

- Mobile: < 768px (single column, hamburger menu, stacked cards)
- Tablet: 768px - 1024px (2-column grids, side nav collapses)
- Desktop: > 1024px (3-column grids, persistent side nav)

---

## Images

**No Large Hero Image Required** - This is a utility-focused healthcare dashboard

**Supporting Imagery:**
- Empty state illustrations: Friendly, minimal line art for "no supplies yet" states
- AI advisor avatar: Simple, trustworthy icon (medical professional style)
- Icon set: Medical-themed icons for supply types (syringe, insulin vial, CGM sensor) from Heroicons or custom medical icon set
- Tutorial/onboarding: Optional step-by-step illustrations for first-time setup

All imagery should maintain the calm, professional medical aesthetic with clean lines and approachable style.