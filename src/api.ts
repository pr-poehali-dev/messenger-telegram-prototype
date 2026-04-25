const URLS = {
  auth: "https://functions.poehali.dev/76236b2a-61e1-401f-9431-19639dff9909",
  chats: "https://functions.poehali.dev/ce962113-e32e-4e24-a3c7-d3ec62ebd130",
  contacts: "https://functions.poehali.dev/d92f996d-67ff-43b6-a567-139097471edb",
  messages: "https://functions.poehali.dev/4b5988b1-7d22-40e3-9034-8a8193508f2c",
};

function getToken() {
  return localStorage.getItem("token") || "";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Auth-Token": getToken(),
  };
}

export async function sendSmsCode(phone: string) {
  const r = await fetch(`${URLS.auth}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return r.json();
}

export async function verifyCode(phone: string, code: string, name?: string) {
  const r = await fetch(`${URLS.auth}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code, name }),
  });
  return r.json();
}

export async function getMe() {
  const r = await fetch(`${URLS.auth}/me`, { headers: authHeaders() });
  return r.json();
}

export async function updateProfile(data: { name?: string; about?: string; username?: string }) {
  const r = await fetch(`${URLS.auth}/profile`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function logout() {
  await fetch(`${URLS.auth}/logout`, { method: "POST", headers: authHeaders() });
  localStorage.removeItem("token");
}

export async function getChats() {
  const r = await fetch(`${URLS.chats}/`, { headers: authHeaders() });
  return r.json();
}

export async function createOrOpenChat(partnerId: number) {
  const r = await fetch(`${URLS.chats}/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ partner_id: partnerId }),
  });
  return r.json();
}

export async function searchUsers(q: string) {
  const r = await fetch(`${URLS.chats}/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
  return r.json();
}

export async function getMessages(chatId: number) {
  const r = await fetch(`${URLS.messages}/?chat_id=${chatId}`, { headers: authHeaders() });
  return r.json();
}

export async function sendMessage(chatId: number, text: string, vanishing = false, ttlSeconds = 10) {
  const r = await fetch(`${URLS.messages}/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ chat_id: chatId, text, vanishing, ttl_seconds: ttlSeconds }),
  });
  return r.json();
}

export async function getContacts() {
  const r = await fetch(`${URLS.contacts}/`, { headers: authHeaders() });
  return r.json();
}

export async function addContact(phone: string) {
  const r = await fetch(`${URLS.contacts}/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ phone }),
  });
  return r.json();
}

export async function addContactById(userId: number) {
  const r = await fetch(`${URLS.contacts}/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });
  return r.json();
}
