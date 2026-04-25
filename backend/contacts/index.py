"""
Контакты: список, добавление, удаление. Обновление статуса онлайн.
"""
import json
import os
import psycopg2

SCHEMA = "t_p81359388_messenger_telegram_p"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_user_id(cur, token):
    cur.execute(
        f"SELECT user_id FROM {SCHEMA}.sessions WHERE token = %s AND expires_at > NOW()", (token,)
    )
    row = cur.fetchone()
    return row[0] if row else None


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    path = event.get("path", "/")
    method = event.get("httpMethod", "GET")
    headers_in = event.get("headers", {}) or {}
    token = headers_in.get("X-Auth-Token", "")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    out_headers = {**CORS, "Content-Type": "application/json"}

    if not token:
        return {"statusCode": 401, "headers": out_headers, "body": json.dumps({"error": "Нет токена"})}

    conn = get_conn()
    cur = conn.cursor()
    me_id = get_user_id(cur, token)
    if not me_id:
        cur.close()
        conn.close()
        return {"statusCode": 401, "headers": out_headers, "body": json.dumps({"error": "Сессия истекла"})}

    # обновить last_seen
    cur.execute(f"UPDATE {SCHEMA}.users SET status = 'online', last_seen = NOW() WHERE id = %s", (me_id,))

    # GET / — список контактов
    if method == "GET":
        cur.execute(
            f"""SELECT u.id, u.name, u.username, u.phone, u.status, u.about, u.last_seen
                FROM {SCHEMA}.contacts c
                JOIN {SCHEMA}.users u ON u.id = c.contact_id
                WHERE c.owner_id = %s
                ORDER BY u.name ASC""",
            (me_id,)
        )
        rows = cur.fetchall()
        conn.commit()
        contacts = [{
            "id": r[0], "name": r[1], "username": r[2], "phone": r[3],
            "status": r[4], "about": r[5],
            "last_seen": r[6].isoformat() if r[6] else None
        } for r in rows]
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": out_headers, "body": json.dumps({"ok": True, "contacts": contacts})}

    # POST / — добавить контакт по телефону или user_id
    if method == "POST":
        contact_phone = body.get("phone", "").strip()
        contact_id = body.get("user_id")

        if contact_phone:
            clean = contact_phone.replace(" ", "").replace("-", "")
            if not clean.startswith("+"):
                clean = "+" + clean
            cur.execute(f"SELECT id, name, username, status FROM {SCHEMA}.users WHERE phone = %s", (clean,))
            row = cur.fetchone()
            if not row:
                cur.close()
                conn.close()
                return {"statusCode": 404, "headers": out_headers, "body": json.dumps({"error": "Пользователь не найден"})}
            contact_id = row[0]
        elif not contact_id:
            cur.close()
            conn.close()
            return {"statusCode": 400, "headers": out_headers, "body": json.dumps({"error": "Нужен phone или user_id"})}

        if contact_id == me_id:
            cur.close()
            conn.close()
            return {"statusCode": 400, "headers": out_headers, "body": json.dumps({"error": "Нельзя добавить себя"})}

        cur.execute(
            f"INSERT INTO {SCHEMA}.contacts (owner_id, contact_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (me_id, contact_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": out_headers, "body": json.dumps({"ok": True})}

    cur.close()
    conn.close()
    return {"statusCode": 404, "headers": out_headers, "body": json.dumps({"error": "Not found"})}
