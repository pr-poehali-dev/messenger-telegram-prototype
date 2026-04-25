"""
Сообщения: получение истории чата, отправка, исчезающие сообщения.
"""
import json
import os
from datetime import datetime, timedelta
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

    params = event.get("queryStringParameters") or {}
    chat_id = params.get("chat_id") or body.get("chat_id")

    # GET / — история сообщений чата
    if method == "GET":
        if not chat_id:
            cur.close()
            conn.close()
            return {"statusCode": 400, "headers": out_headers, "body": json.dumps({"error": "Нужен chat_id"})}

        # проверить доступ
        cur.execute(
            f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s",
            (chat_id, me_id)
        )
        if not cur.fetchone():
            cur.close()
            conn.close()
            return {"statusCode": 403, "headers": out_headers, "body": json.dumps({"error": "Нет доступа"})}

        # очистить истёкшие исчезающие сообщения
        cur.execute(
            f"UPDATE {SCHEMA}.messages SET deleted_at = NOW() WHERE chat_id = %s AND vanishing = TRUE AND expires_at < NOW() AND deleted_at IS NULL",
            (chat_id,)
        )

        cur.execute(
            f"""SELECT m.id, m.sender_id, m.text, m.vanishing, m.ttl_seconds, m.expires_at, m.created_at,
                       u.name, u.username
                FROM {SCHEMA}.messages m
                JOIN {SCHEMA}.users u ON u.id = m.sender_id
                WHERE m.chat_id = %s AND m.deleted_at IS NULL
                ORDER BY m.created_at ASC
                LIMIT 100""",
            (chat_id,)
        )
        rows = cur.fetchall()
        conn.commit()
        messages = []
        for r in rows:
            expires_at = r[5]
            time_left = None
            if r[3] and expires_at:
                delta = (expires_at - datetime.utcnow()).total_seconds()
                time_left = max(0, int(delta))
            messages.append({
                "id": r[0],
                "sender_id": r[1],
                "text": r[2],
                "vanishing": r[3],
                "ttl_seconds": r[4],
                "time_left": time_left,
                "created_at": r[6].isoformat(),
                "mine": r[1] == me_id,
                "sender_name": r[7],
                "sender_username": r[8]
            })
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": out_headers, "body": json.dumps({"ok": True, "messages": messages})}

    # POST / — отправить сообщение
    if method == "POST":
        text = body.get("text", "").strip()
        vanishing = body.get("vanishing", False)
        ttl = body.get("ttl_seconds", 10)

        if not chat_id or not text:
            cur.close()
            conn.close()
            return {"statusCode": 400, "headers": out_headers, "body": json.dumps({"error": "Нужны chat_id и text"})}

        cur.execute(
            f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s",
            (chat_id, me_id)
        )
        if not cur.fetchone():
            cur.close()
            conn.close()
            return {"statusCode": 403, "headers": out_headers, "body": json.dumps({"error": "Нет доступа"})}

        expires_at = None
        if vanishing:
            expires_at = datetime.utcnow() + timedelta(seconds=int(ttl))

        cur.execute(
            f"""INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text, vanishing, ttl_seconds, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id, created_at""",
            (chat_id, me_id, text, vanishing, ttl if vanishing else None, expires_at)
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        time_left = ttl if vanishing else None
        return {
            "statusCode": 200,
            "headers": out_headers,
            "body": json.dumps({
                "ok": True,
                "message": {
                    "id": row[0],
                    "sender_id": me_id,
                    "text": text,
                    "vanishing": vanishing,
                    "ttl_seconds": ttl if vanishing else None,
                    "time_left": time_left,
                    "created_at": row[1].isoformat(),
                    "mine": True
                }
            })
        }

    cur.close()
    conn.close()
    return {"statusCode": 404, "headers": out_headers, "body": json.dumps({"error": "Not found"})}
