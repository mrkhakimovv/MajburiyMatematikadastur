import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'app.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    username TEXT UNIQUE,
    phone_number TEXT,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    profile_photo TEXT
  );

  CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT,
    correct_answer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    total_tests INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    wrong_answers INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS bot_state (
    telegram_id TEXT PRIMARY KEY,
    state TEXT,
    data TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT,
    receiver_id TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read INTEGER DEFAULT 0
  );
`);

try {
  db.exec('ALTER TABLE users ADD COLUMN username TEXT UNIQUE;');
} catch (e) {
  // Column might already exist
}

try {
  db.exec('ALTER TABLE users ADD COLUMN password TEXT;');
} catch (e) {
  // Column might already exist
}

try {
  db.exec('ALTER TABLE users ADD COLUMN status TEXT DEFAULT "";');
} catch (e) {}

try {
  db.exec('ALTER TABLE users ADD COLUMN accent_color TEXT DEFAULT "indigo";');
} catch (e) {}

try {
  db.exec('ALTER TABLE users ADD COLUMN selected_badge TEXT DEFAULT "";');
} catch (e) {}

export default db;
