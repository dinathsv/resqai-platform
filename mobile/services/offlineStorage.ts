import { Platform } from 'react-native'
import { visibleAlerts } from './alertVisibility'

let db: any = null

const ALERT_CACHE_SCHEMA = `CREATE TABLE IF NOT EXISTS cached_alerts (
  alert_id TEXT PRIMARY KEY,
  disaster_type TEXT,
  work_plan TEXT,
  severity INTEGER,
  zone TEXT,
  cached_at TEXT,
  source TEXT,
  verification_status TEXT
)`

function writeCachedAlerts(connection: any, alerts: any[]) {
  visibleAlerts(alerts).forEach(a => connection.runSync(
    `INSERT OR REPLACE INTO cached_alerts
      (alert_id, disaster_type, work_plan, severity, zone, cached_at, source, verification_status)
      VALUES(?,?,?,?,?,?,?,?)`,
    [String(a.alert_id), a.disaster_type ?? null, a.work_plan ?? null, a.severity ?? null,
      a.zone ?? null, a.cached_at || new Date().toISOString(), a.source ?? null, a.verification_status ?? null]
  ))
}

export function initDB() {
  if (Platform.OS === 'web' || db) return
  const SQLite = require('expo-sqlite')
  const connection = SQLite.openDatabaseSync('resqai.db')
  try {
    connection.execSync(`
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
    CREATE TABLE IF NOT EXISTS cached_hospitals (
      hospital_id INTEGER PRIMARY KEY,
      name TEXT,
      phone TEXT,
      lat REAL,
      lng REAL,
      specialization TEXT
    );
    `)
    connection.execSync(ALERT_CACHE_SCHEMA)
    const columns: { name: string; type: string }[] = connection.getAllSync('PRAGMA table_info(cached_alerts)')
    if (!columns.some(column => column.name === 'verification_status')
        || !columns.some(column => column.name === 'source')
        || columns.find(column => column.name === 'alert_id')?.type.toUpperCase() !== 'TEXT') {
      // Keep existing broadcasts while discarding legacy requests whose approval was never cached.
      const previous = connection.getAllSync('SELECT * FROM cached_alerts')
      connection.withTransactionSync(() => {
        connection.execSync('DROP TABLE cached_alerts')
        connection.execSync(ALERT_CACHE_SCHEMA)
        writeCachedAlerts(connection, previous)
      })
    }
    db = connection
  } catch (error) {
    connection.closeSync()
    throw error
  }
}

export function cacheAlerts(alerts: any[]) {
  if (!db) return
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM cached_alerts')
    writeCachedAlerts(db, alerts)
  })
}

export function getCachedAlerts() {
  if (!db) return []
  return visibleAlerts(db.getAllSync(
    'SELECT * FROM cached_alerts ORDER BY cached_at DESC'
  ))
}
