# Home Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local home dashboard with configurable devices and plants, room overviews, durable event history, and seven-day usage charts on a Raspberry Pi 5.

**Architecture:** One Express process serves a React production build and JSON APIs. SQLite stores entries, statuses, room snapshots, and events; a pure aggregation module derives usage from persisted events. Apple Home and NFC-triggered Shortcuts call the GET ingestion endpoint.

**Tech Stack:** Node.js, JavaScript ESM, Express, React, Vite, SQLite, Luxon for timezone-aware calendar boundaries; node:test/Supertest for server tests, Vitest/Testing Library for UI behavior. Select and lock compatible dependency versions during execution, checking official runtime and package documentation for ARM64 support. Use better-sqlite3 unless host compatibility checks identify a concrete blocker.

**Spec:** `docs/superpowers/specs/2026-10-25-home-dashboard-design.md`

## Global Constraints

- Four fixed rooms: Bedroom, Living room, Home office, Bathroom. Every tracked entry belongs to exactly one of these rooms.
- The required ingestion route is `GET /api/event/:device-name/:status` with URL-safe slugs.
- Every call records another watering, including consecutive calls with the same status.
- Store UTC timestamps and display and aggregate them in the configured home timezone (default Europe/Berlin).
- Seven-day charts cover today and the preceding six home-calendar days, with today partial.
- No watering reminders, schedules, device control, PS5/Quest integrations, numeric climate trends, energy estimates, cloud hosting, or internet exposure.
- Bundle chart assets locally so normal operation needs no external CDN.
- Retain all events by default; archive rather than delete tracked entries.
- Five-second visible dashboard refresh; no inferred device reset when the server restarts.
- Ingestion requires a shared token; configuration writes require same-origin JSON requests. No account login for this trusted home-LAN version.

## Review Focus

1. Duplicate reports and simultaneous watering calls must all persist without inflating runtime or losing waterings (Tasks 2–3).
2. Overnight sessions and daylight-saving days must use actual elapsed time across home-calendar boundaries (Task 3).
3. Moving, renaming, or archiving an entry must preserve access to past events and their original room (Tasks 1–2, 5).
4. Lost connectivity must keep last successful data visible and distinguish last reported state from a fresh measurement (Task 4).
5. Invalid slugs, conflicting names, injected filter text, and cross-origin settings writes must fail safely without partial changes (Tasks 1–2, 5).

## Repository and file map

The directory currently contains only the design and an illustrative mockup; it has no Git repository or application. Do not treat the mockup's Hallway or hardcoded metrics as product data. At execution, inspect ancestor AGENTS.md instructions, runtime/tool availability, and the worktree skill before creating scaffolding. Do not attempt an isolated worktree until a repository exists. Initialize Git in this directory if permitted; otherwise report the limitation and continue implementation without pretending commits succeeded.

- `package.json`, `package-lock.json`, `.gitignore`, `.env.example`: commands, dependency lock, data/secret exclusions, configuration examples.
- `shared/contracts.js`: type JSDoc, tracking definitions and the four room IDs/labels.
- `server/config.js`, `server/index.js`, `server/app.js`: validated configuration, startup, injectable Express app and production static serving.
- `server/db.js`, `server/migrations/001-initial.sql`: SQLite lifecycle, migrations, foreign keys, indexes, stable IDs.
- `server/entries.js`, `server/events.js`, `server/stats.js`: configuration transactions, ingestion/querying, pure calendar aggregation.
- `server/routes.js`, `server/security.js`: HTTP validation, authorization, origin checks, bounded errors.
- `client/index.html`, `client/vite.config.js`, `client/src/main.jsx`: frontend entry/build and development API proxy.
- `client/src/App.jsx`, `client/src/api.js`, `client/src/useDashboard.js`, `client/src/styles.css`: shell, transport, polling, responsive Hearth styling.
- `client/src/components/{DeviceCard,UsageChart,LevelTimeline,EventList}.jsx`: reusable displays with units, legends, unknown states and accessible labels.
- `client/src/pages/{Overview,Rooms,ActivityLog,DeviceSettings}.jsx`: four navigation destinations and forms.
- `tests/server/{entries,events,stats,http}.test.js`, `client/src/__tests__/{dashboard,activity,settings}.test.jsx`: meaningful behavior tests.
- `README.md`, `deploy/hearth.service`: Pi setup, local operation, automation examples, backup/restore and systemd example.

## Shared contracts

IDs are stable SQLite integers. Room IDs are `bedroom`, `living-room`, `home-office`, `bathroom`. Timestamps are UTC ISO strings; sort ties by event ID. Slugs match `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1–80 characters. Display names are trimmed, 1–100 characters.

`Entry = {id,name,slug,roomId,type,archived,statuses: Status[]}`; type is `switch | contact | levels | watering`. `Status = {id,slug,label,position}`. Fixed status slugs are `on/off`, `open/closed`, or `watered`; levels require at least two unique ordered slugs. `Event = {id,entryId,statusId,statusSlug,roomId,occurredAt}`; `roomId` is the room at ingestion. Log display joins current entry/status labels.

`createApp({db,token,timeZone,origin,now}) -> ExpressApp`; `now() -> Date` defaults to the system clock. `openDatabase(path) -> Database` runs migrations and returns a closable connection. `saveEntry(db,input,id?) -> Entry`, `archiveEntry(db,id) -> Entry`, `recordEvent(db,{entrySlug,statusSlug,occurredAt}) -> Event`, `listEvents(db,filters) -> {items,total,page,pageSize}`. Filter fields: `roomId,entryId,status,from,to,page,pageSize`; date bounds are inclusive home-calendar dates. Default page size 50, maximum 100. Invalid filters return 400, not unbounded queries.

`aggregateUsage({entries,events,now,timeZone}) -> {days,entries}`. `days` contains seven ISO local dates. Per-entry results contain `entryId,latest:{statusSlug,occurredAt}|null,daily:[{date,runtimeSeconds,openings,waterings,levelSeconds}],unknownSeconds,totalRuntimeSeconds,totalOpenings,totalWaterings`. `levelSeconds` is a map by status slug, daily seconds reflect actual elapsed time. Fetch history before the window to establish initial state; switch unknown time is not off time.

## Task 1: Persistent configuration and entry rules

**Files:** root configuration, shared contracts, server configuration/database/migration/entries modules; `tests/server/entries.test.js`.

**Interfaces:** Produces `openDatabase`, `saveEntry`, `archiveEntry` and Entry/Status contracts above. Configuration includes `HOST=0.0.0.0`, `PORT=3000`, `DATABASE_PATH=./data/hearth.sqlite`, `HOME_TIMEZONE=Europe/Berlin`, required `EVENT_TOKEN`, `APP_ORIGIN=http://localhost:3000` (Pi instructions replace origin with its actual address).

- [ ] Create package scripts and minimal test harness, with a disposable temporary SQLite database per test. Exclude `.env`, database/WAL files, dependencies, build output, and `.superpowers/` from Git. Validate timezone, port, token and origin at startup; never print secrets.
- [ ] Write failing tests named `seedsExactlyFourRooms`, `persistsEntryAfterReopen`, `rejectsUnknownRoomAndDuplicateSlug`, `rejectsInvalidAndDuplicateLevelSlugs`, `transactionRollsBackInvalidEdit`, `restrictsHistoricalTypeAndStatusChanges`, `archivePreservesReferencedEvents`. Assert room labels equal exactly the four specified labels; persistence retains IDs and ordered levels; errors leave earlier data unchanged.
- [ ] Run `node --test tests/server/entries.test.js`; confirm failures reference missing behavior rather than test setup.
- [ ] Implement contracts and parameterized transactional writes. Seed rooms once. Configure WAL and foreign keys. Event schema includes room-at-event and indexes by entry/time/id and room/time/id. Archiving retains all records; unused statuses may be changed, referenced slug IDs cannot be removed/replaced. Slug uniqueness returns a recognizable conflict error.
- [ ] Run `node --test tests/server/entries.test.js`; expect zero failures. Commit this deliverable if Git is available.

## Task 2: Event ingestion, configuration routes and one filtered log

**Files:** server app/routes/security/events modules; `tests/server/events.test.js`, `tests/server/http.test.js`.

**Interfaces:** Consumes Task 1 contracts. Produces `createApp`, `recordEvent`, `listEvents`; endpoints: `GET /api/rooms`, `GET/POST /api/entries`, `PATCH /api/entries/:id`, `POST /api/entries/:id/archive`, `GET /api/events`, required GET ingestion route. Entries list accepts `includeArchived=true` for settings/history. JSON errors are `{error:{code,message}}`; ingestion success is `{event:{id,occurredAt}}` with 200 status.

- [ ] Write failing HTTP tests: valid token creates a persisted event; missing/wrong/array token returns 401; invalid status returns 400; absent or archived entry returns 404; valid responses include `Cache-Control: no-store`. Assert repeated on events and two simultaneous watered requests each produce two distinct rows.
- [ ] Write failing log tests for combined room/device/status/date filters, stable pagination with identical timestamps, both date endpoints inclusive in home timezone, maximum page size, malformed IDs/dates and SQL-looking input rejected. Move an entry, rename it, then archive it; old events retain room-at-event and appear under the updated display name when history is queried.
- [ ] Write failing settings tests: matching Origin plus JSON accepted; foreign or missing Origin rejected for writes; invalid content type rejected; invalid edits leave DB unchanged. Reject implicit HEAD event ingestion; error responses and request logs must not include the token or full ingestion query URL.
- [ ] Run `node --test tests/server/events.test.js tests/server/http.test.js`; verify expected failing cases.
- [ ] Implement the endpoints, constant-time token checking, bounded request sizes, origin equality checks and parameterized queries. Use `APP_ORIGIN` rather than untrusted Host to decide allowed writes. Return 409 for conflicting slugs or edits incompatible with historical records. The ingestion write and status validation occur in one transaction. No CORS enablement or HTML fallback for unknown API routes.
- [ ] Run `node --test tests/server/*.test.js`; expect zero failures. Commit if Git is available.

## Task 3: Seven-day statistics with correct event semantics

**Files:** `server/stats.js`, dashboard query route in `server/routes.js`, `tests/server/stats.test.js`.

**Interfaces:** Consumes entries and events from Tasks 1–2; produces `aggregateUsage` and `GET /api/dashboard?roomId=...` returning `{generatedAt,timeZone,days,entries:[{...Entry,usage}],recentEvents}`. Room selection uses current entry assignment for devices/charts and room-at-event for recent log records. Query only in-window events plus the latest pre-window event per entry; exclude archived entries from current metrics.

- [ ] Write failing table-driven tests with fixed clock: on→on→off yields one interval; unclosed on extends to now; first off has no preceding runtime; initial unknown level remains unknown; watering→watering counts twice; open→open→closed→open counts two openings. All logs remain intact.
- [ ] Add explicit assertions: Europe/Berlin 2026-10-24T22:00Z to 2026-10-25T23:00Z is one local autumn day with 90,000 runtime seconds; 2026-03-28T23:00Z to 2026-03-29T22:00Z is one spring day with 82,800 seconds. Split ordinary midnight intervals into separate daily totals; carry the last pre-window state into day one; respect same-time ID ordering and server restart persistence.
- [ ] Run `node --test tests/server/stats.test.js`; verify failures.
- [ ] Implement interval reduction over ordered events, clipping each interval to each local-day boundary using Luxon. Keep state intervals and repeated-event counts separate. Totals cannot exceed known observation time for stateful entries; today ends at `now`.
- [ ] Run all server tests; expect zero failures. Commit if Git is available.

## Task 4: Home and room dashboards

**Files:** frontend entry/build files, App/api/polling/styles, four shared display components, Overview/Rooms pages; `client/src/__tests__/dashboard.test.jsx`.

**Interfaces:** Consumes dashboard and rooms endpoints. `api.get(path,{signal}?) -> Promise<JSON>` and `api.write(path,{method,body}) -> Promise<JSON>` use same-origin relative URLs and structured errors. `useDashboard(roomId?) -> {data,error,lastSuccessAt,loading,refresh}`; display components consume Task 3 usage objects.

- [ ] Write failing UI tests: empty home offers entry creation; Unknown state and Never recorded watering render honestly; room selection changes requested room ID; usage chart displays seven dated days with units; level legend includes unknown periods; error retains prior values with visible stale/offline message.
- [ ] With fake timers, assert refresh after 5,000 ms, cleanup on unmount, cancellation on room changes, and a late response for a previous room cannot overwrite the selected room. Hidden tabs pause polling and resume on visibility.
- [ ] Run `npm run test:client -- dashboard`; confirm meaningful failures.
- [ ] Implement the responsive Hearth shell with Overview/Rooms/Activity log/Device settings navigation. Show timestamps, runtime charts and level timelines using local code; do not display temperature degrees or humidity percentages. Four fixed room selectors; room activity link navigates to the shared log with a room filter. Scope charts to current room assignments. Include chart text alternatives, labels/legends, keyboard access and mobile wrapping.
- [ ] Run `npm run test:client -- dashboard` and `npm run build`; expect passing tests and a built client directory. Commit if Git is available.

## Task 5: Add/edit devices and plants; filter all activity

**Files:** DeviceSettings/ActivityLog pages and related client API helpers; `client/src/__tests__/settings.test.jsx`, `client/src/__tests__/activity.test.jsx`.

**Interfaces:** Consumes Task 2 settings/history endpoints and Task 4 api helpers. Route state supports `activity?roomId=...`; changing room clears an incompatible selected entry and resets the page. History device choices include archived entries and entries with historical events in the selected room, even if they now live elsewhere. Add a `historyRoomId` entries query option in Task 2's route if needed for this lookup.

- [ ] Write failing settings tests for creating a plant with Bedroom assignment and fixed watered status; creating levels with two or more ordered statuses; required room; duplicate slug conflict preserved as form error; editing display label; warning before slug change; archive confirmation retaining history. Assert event URL examples contain the saved slug and fixed/selected status but only a token placeholder, never a token fetched into the browser.
- [ ] Write failing activity tests for combined room/device/status/date filters, archived and moved entry lookup, resetting page and incompatible selections when room changes, page controls, empty results, and accessible errors. Assert room overview's activity link initializes the filter.
- [ ] Run `npm run test:client -- settings activity`; confirm expected failures.
- [ ] Implement forms with clear type names On/off, Open/closed, Sensor levels, Plant watering; no freeform room creation. Include status label/slug/ordering editing within historical restrictions. Disable duplicate submits, retain invalid forms and focus first error. Label plant state Last watered, never imply reminders or health. Add server pagination and filters with labeled date fields to the shared activity page. Use history room membership lookup to preserve moved entry access.
- [ ] Run all client/server tests and production build; expect no failures. Commit if Git is available.

## Task 6: Pi operation, documentation and final verification

**Files:** `server/index.js`, production serving in app, `README.md`, `.env.example`, `deploy/hearth.service`; production HTTP tests in `tests/server/http.test.js`.

**Interfaces:** `npm run dev` runs frontend/backend locally; `npm run build` emits frontend; `npm start` runs one server serving assets/API; `npm test` runs server and client tests. Graceful SIGINT/SIGTERM close listener and SQLite connection. Production configuration validates the build directory and reports a useful startup error if absent.

- [ ] Add failing smoke tests verifying production homepage/assets, same-origin settings creation, ingestion then refresh, unknown API JSON 404, no exposed `.env` or database path, and persistence after app/database reopen. Check SPA navigation fallback does not swallow API errors.
- [ ] Run the relevant HTTP test file to confirm new cases fail; implement static serving/startup/shutdown and run again until passing.
- [ ] Document Pi ARM64 Node prerequisites and verified dependency requirements, install/build/start commands, writable DB path, token creation, exact `APP_ORIGIN`/Pi hostname setup, five-second update behavior and historical limitations. Include TV/door/radiator/levels URL examples and NFC→Shortcut→Get Contents of URL→watered instructions. Note duplicate scans each count; shortcuts need LAN reachability. Do not claim actual HomeKit execution was tested.
- [ ] Supply a systemd example with a non-root service user, absolute working directory, environment file, restart policy and persistent writable data directory. Document stopping service before copying SQLite plus restore procedure, avoiding copying an active WAL database as a single file.
- [ ] Run `npm test` and `npm run build`; report results. Exercise the core HTTP flow with a disposable DB and built assets. Inspect desktop and narrow layouts in an available browser; if server binding is restricted (as during the mockup), state that limitation and do not claim visual/browser verification. No Pi deployment without hardware access.
- [ ] Review implementation against this spec, fix substantive findings, rerun checks affected by fixes, and commit if Git is available. Report startup instructions and remaining hardware-only verification to the user. Use completion/review skills as required during execution.

## Self-review

Coverage: scope and tracking behavior → Tasks 1–5; event API/security/history → Tasks 1–2/5; aggregation/timezones → Task 3; visual direction/refresh/empty states → Task 4; Pi operation/delivery → Task 6. All five Review Focus conditions have explicit tests in their owning tasks. Shared signatures and response fields above are authoritative; no task introduces alternative names. This is one application whose frontend depends on the same event/configuration contracts, so one sequential plan is appropriate.

## Execution handoff

Recommend native execution: six dependent deliverables share contracts and aggregation semantics, and one implementer avoids repeated interface handoffs. Use `superpowers:executing-plans` after the user reviews this plan and chooses the method. Subagent-driven execution remains available if they prefer independent checks per task.
