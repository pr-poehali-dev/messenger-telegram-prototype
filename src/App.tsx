import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import * as api from '@/api';

type Section = 'chats' | 'search' | 'contacts' | 'profile' | 'settings';

interface User {
  id: number;
  phone: string;
  name: string;
  username?: string;
  about?: string;
  status: string;
}

interface Message {
  id: number;
  sender_id: number;
  text: string;
  vanishing: boolean;
  ttl_seconds?: number;
  time_left?: number;
  created_at: string;
  mine: boolean;
}

interface Chat {
  id: number;
  name: string;
  type: string;
  partner?: { id: number; name: string; status: string; username?: string };
  last_message?: { text: string; created_at: string; sender_id: number };
}

interface Contact {
  id: number;
  name: string;
  username?: string;
  phone: string;
  status: string;
  about?: string;
}

// ─── helpers ────────────────────────────────────────────────
function statusColor(s: string) {
  if (s === 'online') return '#3ecf8e';
  if (s === 'away') return '#f5a623';
  return '#565870';
}

function fmtTime(iso: string) {
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

function mkInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const colors = ['#4f8ef7', '#3ecf8e', '#a78bfa', '#f75f87', '#f5a623'];
  const c = colors[(name || 'A').charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg,${c}33,${c}66)`,
      border: `1px solid ${c}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size > 36 ? 14 : 11, fontWeight: 600, color: c, flexShrink: 0,
    }}>
      {mkInitials(name || 'ПП')}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
      background: statusColor(status), border: '2px solid var(--bg-panel)', flexShrink: 0,
    }} />
  );
}

// ─── Vanishing countdown ────────────────────────────────────
function VanishMsg({ msg, onVanish }: { msg: Message; onVanish: () => void }) {
  const [left, setLeft] = useState(msg.time_left ?? msg.ttl_seconds ?? 10);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (left <= 0) { setGone(true); setTimeout(onVanish, 500); return; }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <div className={gone ? 'vanish-msg' : 'animate-fade-in'}
      style={{ display: 'flex', justifyContent: msg.mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: '68%', padding: '8px 14px',
        borderRadius: msg.mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: 'linear-gradient(135deg,#f75f2233,#f5a62322)',
        border: '1px solid #f75f5f44', color: '#f5c5a0', fontSize: 14, lineHeight: 1.5,
      }}>
        <div style={{ fontSize: 11, color: '#f75f5f', fontWeight: 600, marginBottom: 4 }}>
          ⏱ исчезнет через {left}с
        </div>
        {msg.text}
      </div>
    </div>
  );
}

// ─── Auth screen ─────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', borderRadius: 12,
  background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)', fontSize: 15, outline: 'none',
  fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box',
};
const errStyle: React.CSSProperties = {
  fontSize: 12, color: '#f75f5f', marginBottom: 10, textAlign: 'center',
};
function btnStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '13px', borderRadius: 12, border: 'none',
    background: active ? '#4f8ef7' : 'var(--bg-hover)',
    color: active ? '#fff' : 'var(--text-muted)',
    fontSize: 15, fontWeight: 600, cursor: active ? 'pointer' : 'default',
    fontFamily: 'inherit', transition: 'all 0.15s',
  };
}

function AuthScreen({ onAuth }: { onAuth: (user: User, token: string) => void }) {
  const [step, setStep] = useState<'phone' | 'code' | 'name'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);

  const sendCode = async () => {
    setError(''); setLoading(true);
    const res = await api.sendSmsCode(phone);
    setLoading(false);
    if (res.ok) {
      setDevCode(res.dev_code || null);
      if (!res.sms_sent && res.sms_error) {
        setError(`SMS не отправлено: ${res.sms_error}`);
      }
      setStep('code');
    } else {
      setError(res.error || 'Ошибка отправки');
    }
  };

  const verify = async (nameOverride?: string) => {
    setError(''); setLoading(true);
    const res = await api.verifyCode(phone, code, nameOverride || name || undefined);
    setLoading(false);
    if (res.ok) {
      if (res.is_new && !nameOverride && !name) {
        setStep('name');
        return;
      }
      onAuth(res.user, res.token);
    } else {
      setError(res.error || 'Неверный код');
    }
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)',
    }}>
      <div className="animate-fade-in" style={{
        width: 360, background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)', borderRadius: 20,
        padding: '40px 36px', boxShadow: '0 24px 64px #00000044',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg,#4f8ef7,#3a6fd8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Icon name="Zap" size={26} style={{ color: '#fff' }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {step === 'phone' && 'Войти в мессенджер'}
            {step === 'code' && 'Введите код'}
            {step === 'name' && 'Как вас зовут?'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {step === 'phone' && 'Введите номер для получения SMS'}
            {step === 'code' && `Код отправлен на ${phone}`}
            {step === 'name' && 'Укажите имя для профиля'}
          </div>
        </div>

        {step === 'phone' && (
          <>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendCode()}
              placeholder="+7 900 000-00-00" type="tel" style={inputStyle} autoFocus />
            {error && <div style={errStyle}>{error}</div>}
            <button onClick={sendCode} disabled={loading || !phone.trim()} style={btnStyle(!!phone.trim() && !loading)}>
              {loading ? 'Отправка...' : 'Получить код'}
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            {devCode && (
              <div style={{
                background: '#4f8ef711', border: '1px solid #4f8ef733',
                borderRadius: 10, padding: '10px 14px', marginBottom: 12,
                fontSize: 13, color: '#4f8ef7', textAlign: 'center',
              }}>
                📱 SMS не дошло — введите этот код:<br />
                <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.2em' }}>{devCode}</span>
              </div>
            )}
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && verify()}
              placeholder="000000" maxLength={6} autoFocus
              style={{ ...inputStyle, letterSpacing: '0.3em', textAlign: 'center', fontSize: 22 }} />
            {error && <div style={errStyle}>{error}</div>}
            <button onClick={() => verify()} disabled={loading || code.length < 6} style={btnStyle(code.length === 6 && !loading)}>
              {loading ? 'Проверка...' : 'Войти'}
            </button>
            <button onClick={() => { setStep('phone'); setCode(''); setError(''); }}
              style={{ ...btnStyle(false), marginTop: 8, background: 'transparent', color: 'var(--text-muted)' }}>
              ← Изменить номер
            </button>
          </>
        )}

        {step === 'name' && (
          <>
            <input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verify(name)}
              placeholder="Ваше имя" style={inputStyle} autoFocus />
            {error && <div style={errStyle}>{error}</div>}
            <button onClick={() => verify(name)} disabled={loading || !name.trim()} style={btnStyle(!!name.trim() && !loading)}>
              {loading ? 'Сохранение...' : 'Продолжить'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────
export default function App() {
  const [me, setMe] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [section, setSection] = useState<Section>('chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchResults, setSearchResults] = useState<{ id: number; name: string; username?: string; phone: string; status: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [msgInput, setMsgInput] = useState('');
  const [isVanishing, setIsVanishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [profileEdit, setProfileEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [addContactPhone, setAddContactPhone] = useState('');
  const [addContactErr, setAddContactErr] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setAuthChecked(true); return; }
    api.getMe().then(res => {
      if (res.ok) setMe(res.user);
      else localStorage.removeItem('token');
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!me) return;
    loadChats();
    loadContacts();
  }, [me]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (activeChatId) {
      loadMessages(activeChatId);
      pollRef.current = setInterval(() => loadMessages(activeChatId), 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChatId]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChats = async () => {
    const res = await api.getChats();
    if (res.ok) setChats(res.chats);
  };

  const loadMessages = async (cid: number) => {
    const res = await api.getMessages(cid);
    if (res.ok) setMessages(res.messages);
  };

  const loadContacts = async () => {
    const res = await api.getContacts();
    if (res.ok) setContacts(res.contacts);
  };

  const startChatWith = async (userId: number) => {
    const res = await api.createOrOpenChat(userId);
    if (res.ok) {
      await loadChats();
      setActiveChatId(res.chat_id);
      setSection('chats');
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    const res = await api.searchUsers(q);
    if (res.ok) setSearchResults(res.users);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const sendMsg = async () => {
    if (!msgInput.trim() || !activeChatId || sending) return;
    setSending(true);
    const res = await api.sendMessage(activeChatId, msgInput.trim(), isVanishing, 10);
    setSending(false);
    if (res.ok) {
      setMsgInput('');
      setIsVanishing(false);
      setMessages(prev => [...prev, res.message]);
      loadChats();
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setMe(null); setChats([]); setMessages([]); setContacts([]); setActiveChatId(null);
  };

  const saveProfile = async () => {
    const res = await api.updateProfile({ name: editName, about: editAbout });
    if (res.ok) {
      setMe(prev => prev ? { ...prev, name: editName, about: editAbout } : prev);
      setProfileEdit(false);
    }
  };

  const doAddContact = async () => {
    setAddContactErr('');
    const res = await api.addContact(addContactPhone);
    if (res.ok) { setAddContactPhone(''); loadContacts(); }
    else setAddContactErr(res.error || 'Не найден');
  };

  if (!authChecked) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Загрузка...</div>
      </div>
    );
  }

  if (!me) {
    return <AuthScreen onAuth={(user, token) => { localStorage.setItem('token', token); setMe(user); }} />;
  }

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  const navItems: { id: Section; icon: string; label: string }[] = [
    { id: 'chats', icon: 'MessageCircle', label: 'Чаты' },
    { id: 'search', icon: 'Search', label: 'Поиск' },
    { id: 'contacts', icon: 'Users', label: 'Контакты' },
    { id: 'profile', icon: 'User', label: 'Профиль' },
    { id: 'settings', icon: 'Settings', label: 'Настройки' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Nav */}
      <nav style={{
        width: 64, background: 'var(--bg-panel)', borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 20, paddingBottom: 16, gap: 4, zIndex: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg,#4f8ef7,#3a6fd8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <Icon name="Zap" size={18} style={{ color: '#fff' }} />
        </div>

        {navItems.map(item => (
          <button key={item.id} onClick={() => setSection(item.id)} title={item.label}
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: section === item.id ? '#4f8ef722' : 'transparent',
              color: section === item.id ? '#4f8ef7' : 'var(--text-muted)',
              transition: 'all 0.15s', position: 'relative',
            }}
            onMouseEnter={e => { if (section !== item.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { if (section !== item.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {section === item.id && (
              <span style={{
                position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                width: 3, height: 20, borderRadius: '0 4px 4px 0', background: '#4f8ef7',
              }} />
            )}
            <Icon name={item.icon} size={20} />
          </button>
        ))}

        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setSection('profile')}>
          <Avatar name={me.name} size={36} />
          <span style={{
            position: 'absolute', bottom: 0, right: 0, width: 10, height: 10,
            borderRadius: '50%', background: '#3ecf8e', border: '2px solid var(--bg-panel)',
          }} />
        </div>
      </nav>

      {/* Left panel */}
      <div style={{
        width: 300, background: 'var(--bg-panel)', borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {section === 'chats' && 'Чаты'}
              {section === 'search' && 'Поиск'}
              {section === 'contacts' && 'Контакты'}
              {section === 'profile' && 'Профиль'}
              {section === 'settings' && 'Настройки'}
            </h2>
            {section === 'chats' && (
              <button onClick={() => setSection('search')} style={{
                width: 32, height: 32, borderRadius: 8, border: 'none',
                background: '#4f8ef722', color: '#4f8ef7', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="Plus" size={16} />
              </button>
            )}
          </div>

          {section === 'search' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
              borderRadius: 10, padding: '7px 12px',
            }}>
              <Icon name="Search" size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Имя, @username или номер..."
                style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%', fontFamily: 'inherit' }}
                autoFocus
              />
            </div>
          )}
          {section === 'contacts' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
              borderRadius: 10, padding: '7px 12px',
            }}>
              <Icon name="Search" size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                placeholder="Поиск по контактам..."
                style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%', fontFamily: 'inherit' }}
              />
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* CHATS */}
          {section === 'chats' && (
            <div style={{ padding: '8px 0' }}>
              {chats.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '40px 16px' }}>
                  Нет чатов.<br />Найдите пользователей через поиск.
                </div>
              )}
              {chats.map(chat => (
                <button key={chat.id} onClick={() => setActiveChatId(chat.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px',
                    background: activeChatId === chat.id ? 'var(--bg-hover)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderLeft: activeChatId === chat.id ? '2px solid #4f8ef7' : '2px solid transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (activeChatId !== chat.id) (e.currentTarget as HTMLElement).style.background = '#1c1c2566'; }}
                  onMouseLeave={e => { if (activeChatId !== chat.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ position: 'relative' }}>
                    <Avatar name={chat.name || 'ЧЧ'} size={42} />
                    {chat.partner && (
                      <span style={{
                        position: 'absolute', bottom: 1, right: 1, width: 10, height: 10,
                        borderRadius: '50%', background: statusColor(chat.partner.status), border: '2px solid var(--bg-panel)',
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                        {chat.name}
                      </span>
                      {chat.last_message && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 4 }}>
                          {fmtTime(chat.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                      {chat.last_message?.text || 'Нет сообщений'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* SEARCH */}
          {section === 'search' && (
            <div style={{ padding: '8px 0' }}>
              {searchQuery.length < 2 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '40px 16px' }}>
                  Введите имя, номер или @username
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '40px 16px' }}>
                  Пользователи не найдены
                </div>
              ) : searchResults.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ position: 'relative' }}>
                    <Avatar name={u.name} size={42} />
                    <StatusDot status={u.status} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.username ? `@${u.username}` : u.phone}</div>
                  </div>
                  <button onClick={() => startChatWith(u.id)} style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none',
                    background: '#4f8ef722', color: '#4f8ef7', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    Написать
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* CONTACTS */}
          {section === 'contacts' && (
            <div style={{ padding: '8px 0' }}>
              <div style={{ padding: '0 16px 12px' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={addContactPhone} onChange={e => setAddContactPhone(e.target.value)}
                    placeholder="+7 900 000-00-00"
                    onKeyDown={e => e.key === 'Enter' && doAddContact()}
                    style={{ ...inputStyle, marginBottom: 0, flex: 1, fontSize: 13, padding: '8px 12px' }}
                  />
                  <button onClick={doAddContact} style={{
                    padding: '8px 12px', borderRadius: 10, border: 'none',
                    background: '#4f8ef7', color: '#fff', cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center',
                  }}>
                    <Icon name="UserPlus" size={15} />
                  </button>
                </div>
                {addContactErr && <div style={{ ...errStyle, textAlign: 'left', marginTop: 4 }}>{addContactErr}</div>}
              </div>
              {contacts
                .filter(c => !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase()))
                .map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ position: 'relative' }}>
                      <Avatar name={c.name} size={40} />
                      <span style={{
                        position: 'absolute', bottom: 0, right: 0, width: 10, height: 10,
                        borderRadius: '50%', background: statusColor(c.status), border: '2px solid var(--bg-panel)',
                      }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: c.status === 'online' ? '#3ecf8e' : 'var(--text-muted)' }}>
                        {c.status === 'online' ? 'В сети' : 'Не в сети'}
                        {c.about ? ` · ${c.about}` : ''}
                      </div>
                    </div>
                    <button onClick={() => startChatWith(c.id)} style={{
                      width: 32, height: 32, borderRadius: 8, border: 'none',
                      background: 'var(--bg-hover)', color: 'var(--text-muted)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="MessageCircle" size={15} />
                    </button>
                  </div>
                ))}
              {contacts.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px' }}>
                  Введите номер выше, чтобы добавить контакт
                </div>
              )}
            </div>
          )}

          {/* PROFILE */}
          {section === 'profile' && (
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <div style={{ position: 'relative' }}>
                  <Avatar name={me.name} size={80} />
                  <span style={{
                    position: 'absolute', bottom: 4, right: 4, width: 14, height: 14,
                    borderRadius: '50%', background: '#3ecf8e', border: '2.5px solid var(--bg-panel)',
                  }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{me.name}</div>
                  <div style={{ fontSize: 13, color: '#3ecf8e' }}>В сети</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{me.phone}</div>
                </div>
              </div>

              {!profileEdit ? (
                <>
                  {[
                    { label: 'Имя', value: me.name },
                    { label: 'О себе', value: me.about || '—' },
                    { label: 'Телефон', value: me.phone },
                    { label: 'Username', value: me.username ? `@${me.username}` : '—' },
                  ].map(row => (
                    <div key={row.label} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{row.label}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{row.value}</div>
                    </div>
                  ))}
                  <button onClick={() => { setEditName(me.name); setEditAbout(me.about || ''); setProfileEdit(true); }}
                    style={{ ...btnStyle(true), marginTop: 20 }}>
                    Редактировать профиль
                  </button>
                </>
              ) : (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Имя" style={inputStyle} />
                  <input value={editAbout} onChange={e => setEditAbout(e.target.value)} placeholder="О себе" style={inputStyle} />
                  <button onClick={saveProfile} style={btnStyle(true)}>Сохранить</button>
                  <button onClick={() => setProfileEdit(false)}
                    style={{ ...btnStyle(false), marginTop: 8, background: 'transparent', color: 'var(--text-muted)' }}>
                    Отмена
                  </button>
                </>
              )}
            </div>
          )}

          {/* SETTINGS */}
          {section === 'settings' && (
            <div style={{ padding: '8px 0' }}>
              {[
                { icon: 'Bell', label: 'Уведомления', desc: 'Звуки и оповещения' },
                { icon: 'Shield', label: 'Конфиденциальность', desc: 'Статус, номер телефона' },
                { icon: 'Clock', label: 'Исчезающие сообщения', desc: 'По умолчанию 10 сек' },
                { icon: 'Palette', label: 'Тема', desc: 'Тёмная (текущая)' },
              ].map(item => (
                <button key={item.label} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: 'var(--bg-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-secondary)', flexShrink: 0,
                  }}>
                    <Icon name={item.icon} size={17} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                  <Icon name="ChevronRight" size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
                </button>
              ))}
              <button onClick={handleLogout} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px', background: 'transparent', border: 'none',
                cursor: 'pointer', color: '#f75f5f', marginTop: 8,
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: '#f75f5f22',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name="LogOut" size={17} style={{ color: '#f75f5f' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Выйти из аккаунта</div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeChat ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
              background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{ position: 'relative' }}>
                <Avatar name={activeChat.name} size={40} />
                {activeChat.partner && (
                  <span style={{
                    position: 'absolute', bottom: 0, right: 0, width: 10, height: 10,
                    borderRadius: '50%', background: statusColor(activeChat.partner.status), border: '2px solid var(--bg-panel)',
                  }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{activeChat.name}</div>
                {activeChat.partner && (
                  <div style={{ fontSize: 12, color: activeChat.partner.status === 'online' ? '#3ecf8e' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StatusDot status={activeChat.partner.status} />
                    {activeChat.partner.status === 'online' ? 'В сети' : 'Не в сети'}
                  </div>
                )}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {['Phone', 'Video', 'MoreVertical'].map(ic => (
                  <button key={ic} style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none',
                    background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                  >
                    <Icon name={ic} size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 12px', display: 'flex', flexDirection: 'column' }}>
              {messages.map(msg =>
                msg.vanishing ? (
                  <VanishMsg key={msg.id} msg={msg} onVanish={() => setMessages(prev => prev.filter(m => m.id !== msg.id))} />
                ) : (
                  <div key={msg.id} className="animate-fade-in"
                    style={{ display: 'flex', justifyContent: msg.mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                    <div style={{
                      maxWidth: '68%', padding: '9px 14px',
                      borderRadius: msg.mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: msg.mine ? 'linear-gradient(135deg,#4f8ef7,#3a6fd8)' : 'var(--bg-card)',
                      border: msg.mine ? 'none' : '1px solid var(--border-subtle)',
                      color: msg.mine ? '#fff' : 'var(--text-primary)',
                      fontSize: 14, lineHeight: 1.5,
                      boxShadow: msg.mine ? '0 2px 12px #4f8ef722' : 'none',
                    }}>
                      {msg.text}
                      <div style={{ fontSize: 10, color: msg.mine ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>
                        {fmtTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                )
              )}
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 60 }}>
                  Начните переписку
                </div>
              )}
              <div ref={msgEndRef} />
            </div>

            <div style={{ padding: '12px 20px 16px', background: 'var(--bg-panel)', borderTop: '1px solid var(--border-subtle)' }}>
              {isVanishing && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                  fontSize: 12, color: '#f5a623', padding: '4px 10px',
                  background: '#f5a62311', borderRadius: 8, width: 'fit-content',
                }}>
                  <Icon name="Timer" size={13} />
                  Исчезающее сообщение (10 сек)
                  <button onClick={() => setIsVanishing(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5a623', padding: 0, marginLeft: 4 }}>
                    <Icon name="X" size={12} />
                  </button>
                </div>
              )}
              <div style={{
                display: 'flex', gap: 10, alignItems: 'center',
                background: 'var(--bg-input)',
                border: `1px solid ${isVanishing ? '#f5a62344' : 'var(--border-subtle)'}`,
                borderRadius: 14, padding: '8px 10px 8px 16px',
              }}>
                <button onClick={() => setIsVanishing(v => !v)} title="Исчезающее сообщение"
                  style={{
                    background: isVanishing ? '#f5a62322' : 'transparent', border: 'none', cursor: 'pointer',
                    color: isVanishing ? '#f5a623' : 'var(--text-muted)', padding: '4px', borderRadius: 8,
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                  }}>
                  <Icon name="Timer" size={18} />
                </button>
                <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !sending && sendMsg()}
                  placeholder={isVanishing ? 'Напишите исчезающее сообщение...' : 'Написать сообщение...'}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit' }}
                />
                <button onClick={sendMsg} disabled={!msgInput.trim() || sending}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none',
                    background: msgInput.trim() && !sending ? '#4f8ef7' : 'var(--bg-hover)',
                    color: msgInput.trim() && !sending ? '#fff' : 'var(--text-muted)',
                    cursor: msgInput.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'all 0.15s',
                  }}>
                  <Icon name="Send" size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 12,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20, background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="MessageCircle" size={32} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Выберите чат
              </div>
              <div style={{ fontSize: 13 }}>
                Или найдите собеседника через поиск
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}