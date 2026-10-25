CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS entries (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
 room_id TEXT NOT NULL REFERENCES rooms(id),
 type TEXT NOT NULL CHECK(type IN ('switch','contact','levels','watering')),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
);
CREATE TABLE IF NOT EXISTS statuses (
 id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id),
 slug TEXT NOT NULL, label TEXT NOT NULL, position INTEGER NOT NULL,
 UNIQUE(entry_id,slug), UNIQUE(entry_id,id)
);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id),
 status_id INTEGER NOT NULL, room_id TEXT NOT NULL REFERENCES rooms(id),
 occurred_at TEXT NOT NULL,
 FOREIGN KEY(entry_id,status_id) REFERENCES statuses(entry_id,id)
);
CREATE INDEX IF NOT EXISTS events_entry_time ON events(entry_id,occurred_at,id);
CREATE INDEX IF NOT EXISTS events_room_time ON events(room_id,occurred_at,id);
CREATE INDEX IF NOT EXISTS events_time ON events(occurred_at,id);
PRAGMA user_version = 1;
