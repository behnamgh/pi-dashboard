# Home dashboard design

Status: approved by the user on 2026-10-25; proceed to implementation planning.

## Intent

A personal dashboard running on a Raspberry Pi 5 collects local HTTP events from Apple Home automations and Apple Shortcuts. It stores history in SQLite and displays latest reported states, room summaries, and usage over the last seven days. The user prefers Node.js and React because they know those technologies.

## Scope

- Home overview with latest reported states, recent activity, seven-day TV and radiator runtime, sensor level history, door opening counts, and plant watering counts.
- Four fixed rooms: Bedroom, Living room, Home office, Bathroom. Every tracked entry belongs to exactly one of these rooms. Rooms cannot be added, renamed, or deleted in this version.
- Room overview with that room's entries, relevant seven-day usage charts and level histories, and recent events linking to the shared log.
- Device settings lets the user add and edit devices and plants: display name, globally unique URL slug, room, tracking type, and allowed statuses. Plants appear alongside devices but use watering-specific labels and history.
- One activity log, newest first, filtered by room, individual entry, status, and date range. Selecting a room limits the entry filter to that room. Paginated history includes every accepted event.
- Durable local SQLite storage for settings and events across server restarts.

## Non-goals

No watering reminders, schedules, device control, PS5/Quest integrations, numeric climate trends, energy estimates, cloud hosting, or internet exposure. Apple automations supply events; the dashboard does not discover or poll devices. No HomeKit bridge is needed in the app. Runtime is inferred from reported events, not measured electricity use.

## Approaches considered

1. Python/FastAPI with SQLite and a frontend: lightweight but less familiar to the user.
2. Node.js with React and SQLite: chosen by the user for familiarity.

Builder proposal: use Express and a Vite-built React frontend, served by one Node process. Bundle chart assets locally so normal operation needs no external CDN. Use a supported Node release available for Raspberry Pi ARM64; exact dependency versions are a builder decision after compatibility checks.

## Tracking behavior

Entries have one of four types:

- On/off: TV or radiator. Fixed `on` and `off` statuses, runtime chart and total per day.
- Open/closed: door. Fixed `open` and `closed` statuses, daily opening counts.
- Levels: temperature or humidity. User defines two or more ordered URL-safe names such as `cold`, `normal`, `warm`, `hot`. Store transitions and show time spent in each reported level; no fabricated numeric readings. Threshold numbers and their triggering rules remain in Apple Home.
- Watering: plant. Fixed `watered` event. Show last watered time, watering history, and seven-day counts. Every call records another watering, including consecutive calls with the same status. NFC tags trigger Apple Shortcuts that send these requests.

All accepted requests are logged, including repeated state reports. Repeated identical state reports do not start a new runtime session or increment a door-opening transition count. Each repeated watering is a separate event; the server cannot infer whether two scans were intentional.

Latest states mean last reported states, with the reporting timestamp visible. Before the first report show Unknown; plants show Never recorded. A missing event cannot be inferred. Sensor levels are carried forward from the last report, and periods before the first event are Unknown.

## Event API

The required ingestion route is `GET /api/event/:device-name/:status` with URL-safe slugs. Examples:

```
/api/event/living-room-tv/on
/api/event/bathroom-door/closed
/api/event/bedroom-monstera/watered
/api/event/home-office-temperature/warm
```

Builder proposal: require a configurable shared ingestion token in a query parameter so Apple Shortcuts can use a simple URL (`?token=...`), with constant-time comparison and no token logging. The token stays in server configuration and is supplied to the owner for shortcut setup. Respond with JSON containing accepted event ID and server timestamp. Return 400 for invalid input, 401 for invalid token, and 404 for an unknown entry; never auto-create entries from ingestion requests. Validate status membership and refuse archived entries. Send `Cache-Control: no-store` for ingestion responses. A GET intentionally records an event; opening its authorized URL also records one.

Use server receipt time as the event time in v1. Store UTC timestamps and display and aggregate them in the configured home timezone (proposal: Europe/Berlin). Support daylight-saving changes and split runtime intervals at local midnight. Home access is via the Pi's LAN address or hostname; localhost is only for access on the Pi itself. Apple Home/Shortcuts must have network access to the Pi when requests execute. Automations and NFC setup are done by the user, with documented example URLs.

Settings APIs use JSON with appropriate methods for list/create/update/archive and enforce the same field validation on the server. For this trusted home-LAN version, the dashboard has no account login; configuration writes accept same-origin requests only, reject cross-origin requests, and require JSON. Do not enable public exposure or permissive CORS. This is a builder proposal, not a previously agreed user requirement.

## Data and history

Proposed tables: fixed rooms, tracked entries, ordered statuses, and events. Events reference stable entry IDs and status IDs and record room-at-event, preserving historical room filters after an entry moves. Entry display-name changes appear throughout history; slug edits affect future URLs only, with a warning that existing shortcuts need updating. Keep identifiers stable.

Builder proposal: archive instead of deleting entries so their history stays available. Archived entries disappear from current overview and cannot accept events but remain selectable in history. Tracking type is fixed once events exist; existing status slugs cannot be removed or changed if referenced by history. Display labels can change, and additional levels can be added. Retain all events by default, with indexes for time and entry/room filtering, bounded pagination, database migrations, and documented backup/restore instructions.

## Aggregation and updates

Seven-day charts cover today and the preceding six home-calendar days, with today partial. Include the last event before the window when determining starting state. An open on-session extends to now. Do not count time before a first known state, double-count repeated `on` reports, or assume a server restart turns devices off. Recompute from durable history, with tested interval splitting and level allocation. Door opening counts count transitions into open, including a first observed open. Plant counts count each watering event.

Builder proposal: refresh visible dashboard data every five seconds and after settings updates; show last successful refresh and an offline/error state. No controls imply that the dashboard can operate appliances. Empty states prompt adding entries and sending a first event. Responsive layouts support desktop and phone.

## Visual direction

The user liked the initial Hearth mockup: restrained green accents, neutral surfaces, device summaries, usage charts, climate level timelines, recent activity. Incorporate navigation for Overview, Rooms, Activity log, Device settings. Use the four agreed rooms, not the earlier illustrative Hallway. Device creation includes plants as a tracking type and a required room selector. The current mockup remains illustrative, not functional product code.

## Delivery and validation

Deliver the application, meaningful automated checks for ingestion persistence/validation, repeated reports versus watering, log filters, room assignment, and runtime/level boundaries; verify frontend production build. Include Pi setup/startup instructions, environment configuration, Apple Shortcut examples, service startup guidance, and SQLite backup instructions. Do not claim hardware or HomeKit integration verified without running on the user's hardware.

## Builder decisions and approval

User decisions: Node.js/React, SQLite local storage, specified GET route, threshold transitions with multiple levels, configurable entries, fixed rooms with one room per entry, shared filtered log, room overview, plants through NFC-triggered watering events, history only for plants, excluding PS5/Quest.

Proposals for approval: Express/Vite; query token for ingestion; home timezone default; five-second refresh; trusted-LAN settings access; archive behavior; room-at-event history; editing restrictions for historical status slugs. Exact UI details, libraries, migrations, test tooling, and deployment packaging remain builder decisions within this design.
