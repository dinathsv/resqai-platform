import { Platform } from 'react-native'

let db: any = null

if (Platform.OS !== 'web') {
  const SQLite = require('expo-sqlite')
  db = SQLite.openDatabaseSync('resqai.db')
}

export function initDB() {
  if (!db) return
  db.execSync(`
    CREATE TABLE IF NOT EXISTS pending_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT,
      lat REAL,
      lng REAL,
      is_guest INTEGER DEFAULT 0,
      nic_number TEXT,
      synced INTEGER DEFAULT 0,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS cached_alerts (
      alert_id INTEGER PRIMARY KEY,
      disaster_type TEXT,
      work_plan TEXT,
      severity INTEGER,
      zone TEXT,
      cached_at TEXT
    );
    CREATE TABLE IF NOT EXISTS cached_hospitals (
      hospital_id INTEGER PRIMARY KEY,
      name TEXT,
      phone TEXT,
      lat REAL,
      lng REAL,
      specialization TEXT
    );
  `)
}

export function saveRequestOffline(
  message: string,
  lat: number,
  lng: number,
  isGuest: boolean,
  nic: string | null
): number {
  if (!db) return -1
  const result = db.runSync(
    'INSERT INTO pending_requests VALUES (null,?,?,?,?,?,0,?)',
    [message, lat, lng, isGuest ? 1 : 0, nic, new Date().toISOString()]
  )
  return result.lastInsertRowId
}

export function getPendingRequests() {
  if (!db) return []
  return db.getAllSync(
    'SELECT * FROM pending_requests WHERE synced=0'
  )
}

export function markSynced(id: number) {
  if (!db) return
  db.runSync('UPDATE pending_requests SET synced=1 WHERE id=?', [id])
}

export function cacheAlerts(alerts: any[]) {
  if (!db) return
  db.runSync('DELETE FROM cached_alerts')
  alerts.forEach((a) =>
    db.runSync(
      'INSERT OR REPLACE INTO cached_alerts VALUES(?,?,?,?,?,?)',
      [
        a.alert_id,
        a.disaster_type,
        a.work_plan,
        a.severity,
        a.zone,
        new Date().toISOString(),
      ]
    )
  )
}

export function getCachedAlerts() {
  if (!db) return []
  return db.getAllSync(
    'SELECT * FROM cached_alerts ORDER BY cached_at DESC'
  )
}
