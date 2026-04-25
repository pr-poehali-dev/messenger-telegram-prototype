"""
Управление чатами: список чатов пользователя, создание чата, поиск пользователей.
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


def get_user_from_token(cur, token):
    cur.execute(
        f"""SELECT u.id, u.name, u.username, u.status
            FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token = %s AND s.expires_at > NOW()""",
        (token,)
    )
    return cur.fetchone()


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
    user_row = get_user_from_token(cur, token)
    if not user_row:
        cur.close()
        conn.close()
        return {"statusCode": 401, "headers": out_headers, "body": json.dumps({"error": "Сессия истекла"})}

    me_id = user_row[0]

    # GET / — список чатов
    if method == "GET" and (path.endswith("/chats") or path == "/"):
        cur.execute(
            f"""SELECT c.id, c.name, c.type,
                       u.id, u.name, u.status, u.username,
                       m.text, m.created_at, m.sender_id,
                       (SELECT COUNT(*) FROM {SCHEMA}.messages m2
                        WHERE m2.chat_id = c.id AND m2.sender_id != %s AND m2.deleted_at IS NULL) as unread
                FROM {SCHEMA}.chats c
                JOIN {SCHEMA}.chat_members cm ON cm.chat_id = c.id AND cm.user_id = %s
                LEFT JOIN {SCHEMA}.chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id != %s
                LEFT JOIN {SCHEMA}.users u ON u.id = cm2.user_id
                LEFT JOIN {SCHEMA}.messages m ON m.id = (
                    SELECT id FROM {SCHEMA}.messages
                    WHERE chat_id = c.id AND deleted_at IS NULL
                    ORDER BY created_at DESC LIMIT 1
                )
                ORDER BY COALESCE(m.created_at, c.created_at) DESC""",
            (me_id, me_id, me_id)
        )
        rows = cur.fetchall()
        chats = []
        for r in rows:
            chats.append({
                "id": r[0],
                "name": r[2] if r[2] == 'group' else (r[4] or "Пользователь"),
                "type": r[2],
                "partner": {"id": r[3], "name": r[4], "status": r[5], "username": r[6]} if r[3] else None,
                "last_message": {"text": r[7], "created_at": r[8].isoformat() if r[8] else None, "sender_id": r[9]} if r[7] else None,
                "unread": 0
            })
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": out_headers, "body": json.dumps({"ok": True, "chats": chats})}

    # POST / — создать или найти direct-чат с пользователем
    if method == "POST" and (path.endswith("/chats") or path == "/"):
        partner_id = body.get("partner_id")
        if not partner_id:
            cur.close()
            conn.close()
            return {"statusCode": 400, "headers": out_headers, "body": json.dumps({"error": "Нужен partner_id"})}

        # проверить есть ли уже чат между ними
        cur.execute(
            f"""SELECT c.id FROM {SCHEMA}.chats c
                JOIN {SCHEMA}.chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = %s
                JOIN {SCHEMA}.chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = %s
                WHERE c.type = 'direct' LIMIT 1""",
            (me_id, partner_id)
        )
        existing = cur.fetchone()
        if existing:
            cur.close()
            conn.close()
            return {"statusCode": 200, "headers": out_headers, "body": json.dumps({"ok": True, "chat_id": existing[0]})}

        cur.execute(f"INSERT INTO {SCHEMA}.chats (type) VALUES ('direct') RETURNING id")
        chat_id = cur.fetchone()[0]
        cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s)", (chat_id, me_id))
        cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s)", (chat_id, partner_id))
        conn.commit()
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": out_headers, "body": json.dumps({"ok": True, "chat_id": chat_id})}

    # GET /search?q=... — поиск пользователей по имени/телефону/username
    if method == "GET" and "/search" in path:
        params = event.get("queryStringParameters") or {}
        q = params.get("q", "").strip()
        if len(q) < 2:
            cur.close()
            conn.close()
            return {"statusCode": 200, "headers": out_headers, "body": json.dumps({"ok": True, "users": []})}

        cur.execute(
            f"""SELECT id, name, username, phone, status FROM {SCHEMA}.users
                WHERE id != %s AND (
                    name ILIKE %s OR username ILIKE %s OR phone LIKE %s
                ) LIMIT 20""",
            (me_id, f"%{q}%", f"%{q}%", f"%{q}%")
        )
        rows = cur.fetchall()
        users = [{"id": r[0], "name": r[1], "username": r[2], "phone": r[3], "status": r[4]} for r in rows]
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": out_headers, "body": json.dumps({"ok": True, "users": users})}

    cur.close()
    conn.close()
    return {"statusCode": 404, "headers": out_headers, "body": json.dumps({"error": "Not found"})}
