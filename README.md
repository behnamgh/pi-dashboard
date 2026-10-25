# Hearth

A local home dashboard for Raspberry Pi 5. Node.js + React + SQLite; all app data stays in your database. No cloud service or HomeKit bridge is required.

## Start locally

Use **Node.js 22.23.1 or newer** (64-bit on the Pi), and npm. The tested toolchain is Node 22.23.1, Vite 7.3.6 and better-sqlite3 13.0.3. The package lock pins dependencies; do not copy a Mac's node_modules to the Pi.

```sh
npm ci
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the generated value in `.env` as `EVENT_TOKEN`. Then:

```sh
npm run build
npm start
```

Open **http://localhost:3000**. The database is created automatically in `data/hearth.sqlite`. A fresh installation has four rooms and no sample devices or events.

For development, set `APP_ORIGIN=http://localhost:5173` and `NODE_ENV=development` in `.env`, then run `npm run dev` and open http://localhost:5173. Vite forwards API requests to port 3000. The production server also supports hash navigation, so no special proxy routing is needed.

## Raspberry Pi setup

Use Raspberry Pi OS 64-bit and a supported 64-bit Node installation. Place this directory at e.g. `/home/pi/pi-dashboard` and run `npm ci` on the Pi. better-sqlite3 includes native bindings; if your OS/runtime combination needs a source build, install `python3`, `make` and `g++` with your OS package manager and reinstall. The app has been tested on the development host, not on physical Pi hardware.

In `.env`, use your Pi's address:

```dotenv
EVENT_TOKEN=your-generated-random-secret
HOST=0.0.0.0
PORT=3000
APP_ORIGIN=http://raspberrypi.local:3000
HOME_TIMEZONE=Europe/Berlin
DATABASE_PATH=./data/hearth.sqlite
NODE_ENV=production
```

Use that exact browser address when changing settings. For example, `http://192.168.1.50:3000` and `http://raspberrypi.local:3000` are different origins. Choose one and configure `APP_ORIGIN` accordingly. Keep the Pi at a stable LAN address using a DHCP reservation if needed. `localhost` points to the machine making the request; devices and your phone must use the Pi address.

For automatic startup, edit `deploy/hearth.service` with your user, project location, and the absolute output of `command -v node` on the Pi. Keep the project and data writable by that non-root user. Then on the Pi:

```sh
sudo cp deploy/hearth.service /etc/systemd/system/hearth.service
sudo systemctl daemon-reload
sudo systemctl enable --now hearth
sudo systemctl status hearth
journalctl -u hearth -n 50
```

No service is installed by the development tools. This is a trusted home-LAN app, with no dashboard account login; anyone with LAN access to it can read history. Configuration writes require the configured browser origin and JSON. Keep it on your local network and do not forward its port to the internet. The event token is never sent to the dashboard or printed by the server; any reverse proxy must also avoid logging token-bearing URLs.

## Add devices and plants

Open **Device settings → Add device or plant**. Give the entry a name, a unique URL name, one of Bedroom / Living room / Home office / Bathroom, and a tracking type:

| Type | Events | Summary |
| --- | --- | --- |
| On/off | `on`, `off` | Runtime by day |
| Open/closed | `open`, `closed` | Opening transitions by day |
| Sensor levels | Your ordered status names, e.g. `cold`, `normal`, `warm`, `hot` | Time in each reported level |
| Plant watering | `watered` | Last watered and watering history/count |

Room overview groups current entries by room. Activity log filters events by the room where each event was originally recorded, even if you later move the entry. Archived entries accept no new events and leave current dashboards, but their history remains available. Entry renames update history labels. Changing a URL name requires updating your shortcuts. Tracking type and used status URL names cannot change after events reference them; labels and ordering can be edited.

## Apple Home and Shortcuts

The ingestion URL is:

```text
http://raspberrypi.local:3000/api/event/DEVICE-NAME/STATUS?token=YOUR_EVENT_TOKEN
```

Examples (replace the placeholder with your secret):

```text
/api/event/living-room-tv/on?token=YOUR_EVENT_TOKEN
/api/event/living-room-tv/off?token=YOUR_EVENT_TOKEN
/api/event/bathroom-door/open?token=YOUR_EVENT_TOKEN
/api/event/bathroom-door/closed?token=YOUR_EVENT_TOKEN
/api/event/living-room-radiator/on?token=YOUR_EVENT_TOKEN
/api/event/home-office-temperature/warm?token=YOUR_EVENT_TOKEN
/api/event/home-office-temperature/normal?token=YOUR_EVENT_TOKEN
/api/event/bathroom-humidity/high?token=YOUR_EVENT_TOKEN
/api/event/bedroom-monstera/watered?token=YOUR_EVENT_TOKEN
```

Create each matching entry first. For a device automation, convert to a Shortcut if needed and use **Get Contents of URL**, method **GET**, with the full Pi URL. Set separate automations for entering and leaving each threshold level; thresholds themselves are defined in Apple Home. The server does not receive degrees/percentages unless you build a different integration, so charts display levels rather than numeric measurements.

For each plant: create its Plant watering entry; create an NFC personal automation in Shortcuts, scan its tag, and add Get Contents of URL with that plant's `watered` URL. Select automatic execution if your iOS setup offers it. A successful response includes an event ID and timestamp. Scan only when you have watered: **every call is another watering**, including repeat scans or retried requests. NFC and Home automations must have network access to the Pi; home hub/iOS permissions and actual automation execution should be checked on your own hardware.

GET deliberately changes data here. Opening a token-bearing URL in a browser records an event too. Do not use those URLs for previews or health checks. Wrong/missing token → 401, unknown/archived entry → 404, invalid status → 400. Nothing is auto-created from an event request. Reports are timestamped when received; offline events are not backfilled automatically.

## API

- `GET /api/rooms`
- `GET /api/entries?includeArchived=true&historyRoomId=bedroom`
- `POST /api/entries` with `{name,slug,roomId,type,statuses?}`
- `PATCH /api/entries/:id` with changed fields
- `POST /api/entries/:id/archive` with `{}`
- `GET /api/event/:device-name/:status?token=...`
- `GET /api/dashboard?roomId=bedroom` (omit roomId for home)
- `GET /api/events?roomId=bedroom&entryId=1&status=watered&from=2026-10-19&to=2026-10-25&page=1&pageSize=50`

Writes to configuration require `Content-Type: application/json` and `Origin` equal to `APP_ORIGIN`. Events use only the token. Date ranges are inclusive home-calendar dates. History is newest first with event IDs breaking timestamp ties; maximum page size 100.

## What charts mean

Seven days means today and the preceding six dates in `HOME_TIMEZONE`; today is partial. TV/radiator usage is reported `on` duration, not electricity or proof someone was watching. Repeat `on` reports do not double-count runtime; an open session continues until `off` arrives. Door counts reflect transitions into open, including a first open report. Watering calls always count separately.

State is Unknown until the first event. Plants show Never recorded until watered. Sensor levels continue until another report arrives, and unknown time is shown separately. If an automation misses a change, the dashboard cannot infer it; the last report timestamp stays visible. Restarting the server does not reset states. Dashboard updates every five seconds while visible, with errors and last sync shown if the connection fails.

## Backup and restore

The app retains all history. Stop Hearth before copying the database so SQLite closes/checkpoints its WAL safely:

```sh
sudo systemctl stop hearth
cp data/hearth.sqlite /path/to/backups/hearth.sqlite
sudo systemctl start hearth
```

If running in a terminal, stop with Ctrl+C first. Never copy only the main database while the app is actively writing: recent changes may be in `-wal`. For restore, stop the service, move the existing database and any `-wal`/`-shm` files to a separate recovery directory, copy the backup to the configured `DATABASE_PATH`, set ownership to the service user, and restart. Keep `.env` separately backed up to preserve your ingestion token. Opening a newer database with an older app version is refused.

## Checks

```sh
npm test
npm run build
```

Server tests exercise real Express middleware without a listening port, with SQLite persistence/validation, filtering, auth, archives, DST and runtime coverage. Client tests render real React components in jsdom using Node's test runner. The client runner bundles JSX with esbuild (already in the Vite toolchain). No browser automation or Pi/HomeKit execution is implied by these tests.

Dependencies are locked for reproducibility. This build used an offline npm cache; compatible dependency overrides are recorded in package.json. Review updates with network access before upgrading.
