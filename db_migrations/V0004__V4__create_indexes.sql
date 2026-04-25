CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON t_p81359388_messenger_telegram_p.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON t_p81359388_messenger_telegram_p.sessions(token);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON t_p81359388_messenger_telegram_p.chat_members(user_id)
