# Apple Watch — deferred

Watch companion work is **explicitly deferred** until:

1. Bundled store shipping is the default (done).
2. Lock Screen / Home Screen WidgetKit v1 ships.
3. Live Activities for active exercise (or sick day) ship.

Those surfaces establish App Groups, shared status models, and native SwiftUI patterns the Watch app would reuse.

## Planned Watch v1 (later)

- Complication: scenario status or last known BG (Health) + open-on-phone.
- One or two actions: hypo “I’m OK”, exercise check-in.
- Phone remains the hub for guides, community, and packing lists.

Do not add a watchOS target until WidgetKit + Live Activities are in production TestFlight.
