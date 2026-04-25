CREATE TABLE IF NOT EXISTS t_p81359388_messenger_telegram_p.users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  username VARCHAR(50) UNIQUE,
  about TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'offline',
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
)
