CREATE TABLE IF NOT EXISTS t_p81359388_messenger_telegram_p.sms_codes (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p81359388_messenger_telegram_p.sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES t_p81359388_messenger_telegram_p.users(id),
  token VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
)
