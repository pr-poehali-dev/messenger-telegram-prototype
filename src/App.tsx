import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';

type Section = 'chats' | 'search' | 'contacts' | 'profile' | 'archive' | 'settings';
type Status = 'online' | 'offline' | 'away';

interface Message {
  id: number;
  text: string;
  time: string;
  mine: boolean;
  vanishing?: boolean;
  ttl?: number;
  vanished?: boolean;
}

interface Chat {
  id: number;
  name: string;
  avatar: string;
  lastMsg: string;
  time: string;
  unread: number;
  status: Status;
  pinned?: boolean;
  archived?: boolean;
  messages: Message[];
}

interface Contact {
  id: number;
  name: string;
  avatar: string;
  status: Status;
  about: string;
}

const INITIAL_CHATS: Chat[] = [
  {
    id: 1,
    name: 'Алексей Морозов',
    avatar: 'АМ',
    lastMsg: 'Отправил файл с отчётом',
    time: '14:32',
    unread: 3,
    status: 'online',
    pinned: true,
    archived: false,
    messages: [
      { id: 1, text: 'Привет! Как дела с проектом?', time: '14:20', mine: false },
      { id: 2, text: 'Всё идёт по плану, сегодня завершим основной блок', time: '14:22', mine: true },
      { id: 3, text: 'Отлично! Жду результатов', time: '14:25', mine: false },
      { id: 4, text: 'Отправил файл с отчётом', time: '14:32', mine: false },
    ],
  },
  {
    id: 2,
    name: 'Маша Иванова',
    avatar: 'МИ',
    lastMsg: '🔥 Это исчезнет через 10 сек',
    time: '13:15',
    unread: 1,
    status: 'online',
    archived: false,
    messages: [
      { id: 1, text: 'Встреча в 15:00 подтверждена?', time: '12:50', mine: false },
      { id: 2, text: 'Да, буду вовремя', time: '12:55', mine: true },
      { id: 3, text: '🔥 Это исчезнет через 10 сек', time: '13:15', mine: false, vanishing: true, ttl: 10 },
    ],
  },
  {
    id: 3,
    name: 'Команда дизайна',
    avatar: '🎨',
    lastMsg: 'Макеты готовы к ревью',
    time: '11:48',
    unread: 0,
    status: 'offline',
    archived: false,
    messages: [
      { id: 1, text: 'Макеты готовы к ревью', time: '11:48', mine: false },
    ],
  },
  {
    id: 4,
    name: 'Дмитрий Соколов',
    avatar: 'ДС',
    lastMsg: 'Увидимся на следующей неделе',
    time: 'Вчера',
    unread: 0,
    status: 'away',
    archived: false,
    messages: [
      { id: 1, text: 'Привет, когда встретимся?', time: 'Вчера', mine: false },
      { id: 2, text: 'Увидимся на следующей неделе', time: 'Вчера', mine: true },
    ],
  },
  {
    id: 5,
    name: 'Старый чат',
    avatar: 'СЧ',
    lastMsg: 'Архивный разговор',
    time: '12 апр',
    unread: 0,
    status: 'offline',
    archived: true,
    messages: [
      { id: 1, text: 'Архивный разговор', time: '12 апр', mine: false },
    ],
  },
];

const CONTACTS: Contact[] = [
  { id: 1, name: 'Алексей Морозов', avatar: 'АМ', status: 'online', about: 'Всегда на связи' },
  { id: 2, name: 'Маша Иванова', avatar: 'МИ', status: 'online', about: 'Дизайнер 🎨' },
  { id: 3, name: 'Дмитрий Соколов', avatar: 'ДС', status: 'away', about: 'Занят до 18:00' },
  { id: 4, name: 'Ольга Петрова', avatar: 'ОП', status: 'offline', about: 'На связи редко' },
  { id: 5, name: 'Кирилл Новиков', avatar: 'КН', status: 'online', about: 'Разработчик 💻' },
  { id: 6, name: 'Наташа Белова', avatar: 'НБ', status: 'offline', about: 'Не беспокоить' },
];

function statusColor(status: Status) {
  if (status === 'online') return '#3ecf8e';
  if (status === 'away') return '#f5a623';
  return '#565870';
}

function StatusDot({ status }: { status: Status }) {
  return (
    <span
      className={status === 'online' ? 'animate-pulse-dot' : ''}
      style={{
        display: 'inline-block',
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: statusColor(status),
        border: '2px solid var(--bg-panel)',
        flexShrink: 0,
      }}
    />
  );
}

function Avatar({ initials, size = 42 }: { initials: string; size?: number }) {
  const colors = ['#4f8ef7', '#3ecf8e', '#a78bfa', '#f75f87', '#f5a623'];
  const idx = initials.charCodeAt(0) % colors.length;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${colors[idx]}33, ${colors[idx]}66)`,
        border: `1px solid ${colors[idx]}44`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size > 36 ? 14 : 11,
        fontWeight: 600,
        color: colors[idx],
        flexShrink: 0,
        letterSpacing: '0.03em',
      }}
    >
      {initials}
    </div>
  );
}

function VanishingMessage({ msg, onVanish }: { msg: Message; onVanish: () => void }) {
  const [timeLeft, setTimeLeft] = useState(msg.ttl || 10);
  const [vanishing, setVanishing] = useState(false);

  useEffect(() => {
    if (msg.vanished) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setVanishing(true);
          setTimeout(onVanish, 600);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (msg.vanished) return null;

  return (
    <div
      className={vanishing ? 'vanish-msg' : 'animate-fade-in'}
      style={{
        display: 'flex',
        justifyContent: msg.mine ? 'flex-end' : 'flex-start',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          maxWidth: '68%',
          padding: '8px 14px',
          borderRadius: msg.mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: 'linear-gradient(135deg, #f75f2233, #f5a62322)',
          border: '1px solid #f75f5f44',
          color: '#f5c5a0',
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#f75f5f', fontWeight: 600 }}>
            ⏱ исчезнет через {timeLeft}с
          </span>
        </div>
        {msg.text}
      </div>
    </div>
  );
}

export default function App() {
  const [section, setSection] = useState<Section>('chats');
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [activeChatId, setActiveChatId] = useState<number | null>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [msgInput, setMsgInput] = useState('');
  const [isVanishing, setIsVanishing] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatId, chats]);

  const visibleChats = chats.filter((c) => {
    if (section === 'archive') return c.archived;
    if (section === 'chats') return !c.archived;
    return false;
  });

  const filteredChats = searchQuery
    ? chats.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : visibleChats;

  const sendMessage = () => {
    if (!msgInput.trim() || !activeChat) return;
    const newMsg: Message = {
      id: Date.now(),
      text: msgInput.trim(),
      time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
      mine: true,
      vanishing: isVanishing,
      ttl: isVanishing ? 10 : undefined,
    };
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChat.id
          ? { ...c, messages: [...c.messages, newMsg], lastMsg: newMsg.text, time: newMsg.time }
          : c
      )
    );
    setMsgInput('');
    setIsVanishing(false);
  };

  const vanishMessage = (chatId: number, msgId: number) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, vanished: true } : m)) }
          : c
      )
    );
  };

  const navItems: { id: Section; icon: string; label: string }[] = [
    { id: 'chats', icon: 'MessageCircle', label: 'Чаты' },
    { id: 'search', icon: 'Search', label: 'Поиск' },
    { id: 'contacts', icon: 'Users', label: 'Контакты' },
    { id: 'archive', icon: 'Archive', label: 'Архив' },
    { id: 'profile', icon: 'User', label: 'Профиль' },
    { id: 'settings', icon: 'Settings', label: 'Настройки' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Sidebar Nav */}
      <nav
        style={{
          width: 64,
          background: 'var(--bg-panel)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 20,
          paddingBottom: 16,
          gap: 4,
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #4f8ef7, #3a6fd8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            flexShrink: 0,
          }}
        >
          <Icon name="Zap" size={18} style={{ color: '#fff' }} />
        </div>

        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setSection(item.id);
              if (item.id !== 'chats' && item.id !== 'archive') setActiveChatId(null);
            }}
            title={item.label}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: section === item.id ? '#4f8ef722' : 'transparent',
              color: section === item.id ? '#4f8ef7' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (section !== item.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              if (section !== item.id) (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {section === item.id && (
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 3,
                  height: 20,
                  borderRadius: '0 4px 4px 0',
                  background: '#4f8ef7',
                }}
              />
            )}
            <Icon name={item.icon} size={20} />
          </button>
        ))}

        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <Avatar initials="ЯП" size={36} />
          <span
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#3ecf8e',
              border: '2px solid var(--bg-panel)',
            }}
          />
        </div>
      </nav>

      {/* Left panel */}
      <div
        style={{
          width: 300,
          background: 'var(--bg-panel)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Panel header */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {section === 'chats' && 'Чаты'}
              {section === 'search' && 'Поиск'}
              {section === 'contacts' && 'Контакты'}
              {section === 'archive' && 'Архив'}
              {section === 'profile' && 'Профиль'}
              {section === 'settings' && 'Настройки'}
            </h2>
            {(section === 'chats' || section === 'search') && (
              <button
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: '#4f8ef722',
                  color: '#4f8ef7',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="Plus" size={16} />
              </button>
            )}
          </div>

          {(section === 'chats' || section === 'search' || section === 'contacts' || section === 'archive') && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: '7px 12px',
              }}
            >
              <Icon name="Search" size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск..."
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  width: '100%',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )}
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Chats / Archive / Search list */}
          {(section === 'chats' || section === 'archive' || section === 'search') && (
            <div style={{ padding: '8px 0' }}>
              {filteredChats.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '32px 16px' }}>
                  Ничего не найдено
                </div>
              )}
              {filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    if (section === 'search') setSection('chats');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px',
                    background: activeChatId === chat.id ? 'var(--bg-hover)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.12s ease',
                    borderLeft: activeChatId === chat.id ? '2px solid #4f8ef7' : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (activeChatId !== chat.id) (e.currentTarget as HTMLElement).style.background = '#1c1c2566';
                  }}
                  onMouseLeave={(e) => {
                    if (activeChatId !== chat.id) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <Avatar initials={chat.avatar} size={42} />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 1,
                        right: 1,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: statusColor(chat.status),
                        border: '2px solid var(--bg-panel)',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                        {chat.name}
                        {chat.pinned && <span style={{ marginLeft: 4, fontSize: 10, color: '#4f8ef7' }}>📌</span>}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 4 }}>{chat.time}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                        {chat.lastMsg}
                      </span>
                      {chat.unread > 0 && (
                        <span
                          style={{
                            background: '#4f8ef7',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 10,
                            padding: '1px 6px',
                            flexShrink: 0,
                            marginLeft: 4,
                          }}
                        >
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Contacts */}
          {section === 'contacts' && (
            <div style={{ padding: '8px 0' }}>
              {CONTACTS.filter((c) =>
                searchQuery ? c.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
              ).map((contact) => (
                <div
                  key={contact.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ position: 'relative' }}>
                    <Avatar initials={contact.avatar} size={40} />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: statusColor(contact.status),
                        border: '2px solid var(--bg-panel)',
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{contact.name}</div>
                    <div style={{ fontSize: 12, color: contact.status === 'online' ? '#3ecf8e' : 'var(--text-muted)' }}>
                      {contact.status === 'online' ? 'В сети' : contact.status === 'away' ? 'Отошёл' : 'Не в сети'}
                      {' · '}
                      <span style={{ color: 'var(--text-secondary)' }}>{contact.about}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Profile */}
          {section === 'profile' && (
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                <div style={{ position: 'relative' }}>
                  <Avatar initials="ЯП" size={80} />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      right: 4,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#3ecf8e',
                      border: '2.5px solid var(--bg-panel)',
                    }}
                  />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Яна Петрова</div>
                  <div style={{ fontSize: 13, color: '#3ecf8e', marginTop: 2 }}>В сети</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>@yana_p · +7 900 000-00-00</div>
                </div>
              </div>
              {[
                { label: 'Имя', value: 'Яна Петрова' },
                { label: 'Статус', value: 'Всегда на связи ✨' },
                { label: 'Телефон', value: '+7 900 000-00-00' },
                { label: 'Username', value: '@yana_p' },
              ].map((row) => (
                <div key={row.label} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{row.label}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{row.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Settings */}
          {section === 'settings' && (
            <div style={{ padding: '8px 0' }}>
              {[
                { icon: 'Bell', label: 'Уведомления', desc: 'Звуки, вибрация' },
                { icon: 'Shield', label: 'Конфиденциальность', desc: 'Кто видит мой статус' },
                { icon: 'Palette', label: 'Тема оформления', desc: 'Тёмная (текущая)' },
                { icon: 'Clock', label: 'Исчезающие сообщения', desc: 'По умолчанию 10 сек' },
                { icon: 'Database', label: 'Данные и хранилище', desc: 'Автозагрузка медиа' },
                { icon: 'HelpCircle', label: 'Помощь', desc: 'FAQ, поддержка' },
                { icon: 'LogOut', label: 'Выйти', desc: '' },
              ].map((item) => (
                <button
                  key={item.label}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.12s',
                    color: item.label === 'Выйти' ? '#f75f5f' : 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: item.label === 'Выйти' ? '#f75f5f22' : 'var(--bg-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: item.label === 'Выйти' ? '#f75f5f' : 'var(--text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={item.icon} size={17} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{item.label}</div>
                    {item.desc && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>}
                  </div>
                  {item.label !== 'Выйти' && (
                    <Icon name="ChevronRight" size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeChat && (section === 'chats' || section === 'archive') ? (
          <>
            {/* Chat header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 20px',
                background: 'var(--bg-panel)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Avatar initials={activeChat.avatar} size={40} />
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: statusColor(activeChat.status),
                    border: '2px solid var(--bg-panel)',
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{activeChat.name}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: activeChat.status === 'online' ? '#3ecf8e' : activeChat.status === 'away' ? '#f5a623' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <StatusDot status={activeChat.status} />
                  {activeChat.status === 'online' ? 'В сети' : activeChat.status === 'away' ? 'Отошёл' : 'Не в сети'}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {['Phone', 'Video', 'MoreVertical'].map((iconName) => (
                  <button
                    key={iconName}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                    }}
                  >
                    <Icon name={iconName} size={18} />
                  </button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px 24px 12px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {activeChat.messages.filter((m) => !m.vanished).map((msg) =>
                msg.vanishing && !msg.vanished ? (
                  <VanishingMessage
                    key={msg.id}
                    msg={msg}
                    onVanish={() => vanishMessage(activeChat.id, msg.id)}
                  />
                ) : (
                  <div
                    key={msg.id}
                    className="animate-fade-in"
                    style={{
                      display: 'flex',
                      justifyContent: msg.mine ? 'flex-end' : 'flex-start',
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '68%',
                        padding: '9px 14px',
                        borderRadius: msg.mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: msg.mine ? 'linear-gradient(135deg, #4f8ef7, #3a6fd8)' : 'var(--bg-card)',
                        border: msg.mine ? 'none' : '1px solid var(--border-subtle)',
                        color: msg.mine ? '#fff' : 'var(--text-primary)',
                        fontSize: 14,
                        lineHeight: 1.5,
                        boxShadow: msg.mine ? '0 2px 12px #4f8ef722' : 'none',
                      }}
                    >
                      {msg.text}
                      <div
                        style={{
                          fontSize: 10,
                          color: msg.mine ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)',
                          marginTop: 3,
                          textAlign: 'right',
                        }}
                      >
                        {msg.time}
                      </div>
                    </div>
                  </div>
                )
              )}
              <div ref={msgEndRef} />
            </div>

            {/* Input bar */}
            <div
              style={{
                padding: '12px 20px 16px',
                background: 'var(--bg-panel)',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              {isVanishing && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8,
                    fontSize: 12,
                    color: '#f5a623',
                    padding: '4px 10px',
                    background: '#f5a62311',
                    borderRadius: 8,
                    width: 'fit-content',
                  }}
                >
                  <Icon name="Timer" size={13} />
                  Исчезающее сообщение (10 сек после отправки)
                  <button
                    onClick={() => setIsVanishing(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5a623', padding: 0, marginLeft: 4 }}
                  >
                    <Icon name="X" size={12} />
                  </button>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  background: 'var(--bg-input)',
                  border: `1px solid ${isVanishing ? '#f5a62344' : 'var(--border-subtle)'}`,
                  borderRadius: 14,
                  padding: '8px 10px 8px 16px',
                  transition: 'border-color 0.2s',
                }}
              >
                <button
                  onClick={() => setIsVanishing((v) => !v)}
                  title="Исчезающее сообщение"
                  style={{
                    background: isVanishing ? '#f5a62322' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: isVanishing ? '#f5a623' : 'var(--text-muted)',
                    padding: '4px',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="Timer" size={18} />
                </button>
                <input
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={isVanishing ? 'Напишите исчезающее сообщение...' : 'Написать сообщение...'}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!msgInput.trim()}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: 'none',
                    background: msgInput.trim() ? '#4f8ef7' : 'var(--bg-hover)',
                    color: msgInput.trim() ? '#fff' : 'var(--text-muted)',
                    cursor: msgInput.trim() ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="Send" size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="MessageCircle" size={32} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {section === 'contacts' ? 'Выберите контакт' :
                 section === 'profile' ? 'Ваш профиль слева' :
                 section === 'settings' ? 'Настройки слева' :
                 'Выберите чат'}
              </div>
              <div style={{ fontSize: 13 }}>
                {section === 'contacts' ? 'Для начала переписки' :
                 section === 'profile' ? 'Редактирование профиля' :
                 section === 'settings' ? 'Управление параметрами' :
                 'Или начните новый разговор'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
