CREATE TABLE IF NOT EXISTS t_p81359388_messenger_telegram_p.chats (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) DEFAULT 'direct',
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p81359388_messenger_telegram_p.chat_members (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER REFERENCES t_p81359388_messenger_telegram_p.chats(id),
  user_id INTEGER REFERENCES t_p81359388_messenger_telegram_p.users(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS t_p81359388_messenger_telegram_p.messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER REFERENCES t_p81359388_messenger_telegram_p.chats(id),
  sender_id INTEGER REFERENCES t_p81359388_messenger_telegram_p.users(id),
  text TEXT NOT NULL,
  vanishing BOOLEAN DEFAULT FALSE,
  ttl_seconds INTEGER,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p81359388_messenger_telegram_p.contacts (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES t_p81359388_messenger_telegram_p.users(id),
  contact_id INTEGER REFERENCES t_p81359388_messenger_telegram_p.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(owner_id, contact_id)
)
