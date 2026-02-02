# Diabeaters

## Overview

Diabeaters is a proactive diabetes management web application designed for Type 1 diabetics. The app simplifies daily decision-making through two core modules: a Supply Tracker for monitoring prescription supplies (insulin, needles, CGM sensors) with depletion forecasts and alerts, and an AI Activity Advisor that provides carbohydrate and insulin adjustment recommendations based on planned activities. The application emphasizes anticipation over logging, helping users prevent emergencies rather than just record data.

**Important**: This app does NOT provide medical advice. All AI outputs are non-prescriptive, safety-first, and clearly labelled.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, built using Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, React hooks for local state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom healthcare-focused design tokens (calm pastel blues, accessible typography)
- **Theme Support**: Light/dark mode with CSS variables

### Backend Architecture
- **Runtime**: Node.js with Express
- **API Design**: RESTful endpoints under `/api` prefix
- **AI Integration**: OpenAI GPT-4o for activity recommendations (optional, gracefully handles missing API key)
- **Session Management**: Express sessions with PostgreSQL store via connect-pg-simple

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: Neon serverless PostgreSQL
- **Schema Location**: `shared/schema.ts` - shared between client and server
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod

### Key Data Models
- **Users**: Authentication with username/password
- **UserProfiles**: Personal info, diabetes type, insulin delivery method, onboarding status
- **UserSettings**: TDD, carb ratios, correction factors, target blood glucose ranges
- **Supplies**: Inventory tracking with type, quantity, daily usage
- **ActivityLogs**: Historical record of activities and recommendations

### Client-Side Storage
- Local storage fallback for offline capability and onboarding state
- Keys prefixed with `diabeater_` for profile, settings, supplies, emergency contacts

### Navigation Structure
- **Dashboard**: Main hub with customizable widgets and floating AI Coach button
- **Supply Tracker**: Monitor insulin, needles, CGM sensors with depletion forecasts
- **Activity Advisor**: Meal planning with exercise integration, Exercise planning with recovery guidance, Activity Session planner for complete workout day management, and Ratio Adviser. Features conversation memory, time-of-day awareness (auto-uses correct meal ratios), historical learning from activity logs, and confidence indicators on recommendations.
- **AI Coach**: Conversational AI assistant with persistent memory (last 100 messages stored in localStorage). Provides personalized diabetes guidance using user profile/settings context. Safety-first with "Not medical advice" labeling.
- **Scenarios**: Bedtime Readiness Check (first tab - calm evening check for stable sleep), Sick Day Mode, and Travel Mode with tabbed interface
- **Appointments**: Healthcare appointment tracking
- **Community**: Posts, News (diabetes articles from trusted sources), Events, Reels, and Messages tabs
- **Settings**: User profile and app configuration

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Vite builds to `dist/public`, Express serves static files
- **TypeScript**: Strict mode enabled, path aliases for `@/` (client) and `@shared/` (shared)

## External Dependencies

### Database
- **Neon PostgreSQL**: Serverless PostgreSQL via `@neondatabase/serverless`
- **Connection**: Requires `DATABASE_URL` environment variable
- **Migrations**: Managed via Drizzle Kit (`db:push` command)

### AI Services
- **OpenAI API**: GPT-4o for activity recommendations
- **Configuration**: Requires `OPENAI_API_KEY` environment variable (optional - app functions without it)

### UI Libraries
- **Radix UI**: Full suite of accessible primitives (dialog, dropdown, tabs, etc.)
- **Lucide React**: Icon library
- **Embla Carousel**: Carousel functionality
- **React Day Picker**: Calendar component
- **Recharts**: Data visualization charts

### Fonts
- **Google Fonts**: Inter/DM Sans for body text, Fira Code/Geist Mono for data display
- Loaded via CDN in index.html

## Future Ideas

### Family/Carer Mode
Allow parents, partners, or carers to help manage diabetes for someone they look after:
- **Linked Accounts**: Primary user invites carers via code/link, multiple carers supported
- **Permission Levels**: View Only, Manage (add supplies/appointments), Full Access (change settings)
- **Carer Dashboard**: At-a-glance status, health indicator, supply alerts
- **For Parents**: See child's supplies, get sick day notifications, review AI recommendations, manage appointments remotely
- **Privacy Controls**: Primary user controls access, can revoke instantly, activity log of carer actions
- **Technical Note**: Requires moving from local storage to database with user authentication and real-time sync