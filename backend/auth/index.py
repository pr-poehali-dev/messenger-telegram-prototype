"""
Авторизация: отправка SMS-кода и верификация. Регистрация новых пользователей.
"""
import json
import os
import random
import string
import secrets
from datetime import datetime, timedelta
import psycopg2
import urllib.request
import urllib.parse

SCHEMA = "t_p81359388_messenger_telegram_p"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def send_sms(phone: str, code: str):
    """Отправляет SMS через sms.ru. Возвращает (ok: bool, error_text: str)."""
    api_id = os.environ.get("SMSRU_API_ID", "")
    if not api_id:
        print("[SMS] SMSRU_API_ID не задан")
        return False, "API ключ sms.ru не настроен"

    clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
    msg = f"Ваш код подтверждения: {code}"
    params = urllib.parse.urlencode({
        "api_id": api_id,
        "to": clean_phone,
        "msg": msg,
        "json": 1
    })
    url = f"https://sms.ru/sms/send?{params}"
    print(f"[SMS] Запрос: {url[:80]}...")
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            raw = resp.read().decode()
            print(f"[SMS] Ответ sms.ru: {raw}")
            result = json.loads(raw)
            if result.get("status") == "OK":
                # проверяем статус конкретного номера
                sms_list = result.get("sms", {})
                for num, info in sms_list.items():
                    sms_status = info.get("status")
                    sms_status_text = info.get("status_text", "")
                    print(f"[SMS] Номер {num}: {sms_status} — {sms_status_text}")
                    if sms_status == "OK":
                        return True, ""
                    else:
                        return False, sms_status_text
                return True, ""
            else:
                err = result.get("status_text", str(result))
                print(f"[SMS] Ошибка: {err}")
                return False, err
    except Exception as e:
        print(f"[SMS] Исключение: {e}")
        return False, str(e)


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    path = event.get("path", "/")
    method = event.get("httpMethod", "GET")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    headers = {**CORS, "Content-Type": "application/json"}

    # POST /send — отправить код на номер
    if method == "POST" and path.endswith("/send"):
        phone = body.get("phone", "").strip()
        if not phone:
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Укажите номер телефона"})}

        # нормализация номера
        clean = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if not clean.startswith("+"):
            clean = "+" + clean
        if len(clean) < 11:
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Некорректный номер телефона"})}

        code = "".join(random.choices(string.digits, k=6))
        expires_at = datetime.utcnow() + timedelta(minutes=10)

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.sms_codes (phone, code, expires_at) VALUES (%s, %s, %s)",
            (clean, code, expires_at)
        )
        conn.commit()
        cur.close()
        conn.close()

        sms_ok, sms_error = send_sms(clean, code)
        print(f"[SMS] Итог: ok={sms_ok}, error={sms_error}, phone={clean}, code={code}")

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "ok": True,
                "sms_sent": sms_ok,
                "sms_error": sms_error if not sms_ok else None,
                "phone": clean,
                # показываем код если SMS не отправилось (нет ключа или ошибка)
                "dev_code": code if not sms_ok else None
            })
        }

    # POST /verify — проверить код и войти/зарегистрироваться
    if method == "POST" and path.endswith("/verify"):
        phone = body.get("phone", "").strip()
        code = body.get("code", "").strip()
        name = body.get("name", "").strip()

        if not phone or not code:
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Нужны телефон и код"})}

        clean = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if not clean.startswith("+"):
            clean = "+" + clean

        conn = get_conn()
        cur = conn.cursor()

        cur.execute(
            f"""SELECT id FROM {SCHEMA}.sms_codes
                WHERE phone = %s AND code = %s AND used = FALSE AND expires_at > NOW()
                ORDER BY created_at DESC LIMIT 1""",
            (clean, code)
        )
        sms_row = cur.fetchone()
        if not sms_row:
            cur.close()
            conn.close()
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Неверный или устаревший код"})}

        sms_id = sms_row[0]
        cur.execute(f"UPDATE {SCHEMA}.sms_codes SET used = TRUE WHERE id = %s", (sms_id,))

        # найти или создать пользователя
        cur.execute(f"SELECT id, name, username, about, status FROM {SCHEMA}.users WHERE phone = %s", (clean,))
        user_row = cur.fetchone()
        is_new = False
        if user_row:
            user_id = user_row[0]
            user_name = user_row[1]
            username = user_row[2]
            about = user_row[3]
        else:
            is_new = True
            user_name = name or "Пользователь"
            cur.execute(
                f"INSERT INTO {SCHEMA}.users (phone, name, status) VALUES (%s, %s, 'online') RETURNING id",
                (clean, user_name)
            )
            user_id = cur.fetchone()[0]
            username = None
            about = ""

        # обновить статус на онлайн
        cur.execute(f"UPDATE {SCHEMA}.users SET status = 'online', last_seen = NOW() WHERE id = %s", (user_id,))

        # создать сессию
        token = secrets.token_hex(32)
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (user_id, token)
        )
        conn.commit()
        cur.close()
        conn.close()

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "ok": True,
                "token": token,
                "user": {
                    "id": user_id,
                    "phone": clean,
                    "name": user_name,
                    "username": username,
                    "about": about,
                    "status": "online"
                },
                "is_new": is_new
            })
        }

    # GET /me — получить текущего пользователя по токену
    if method == "GET" and path.endswith("/me"):
        token = event.get("headers", {}).get("X-Auth-Token", "")
        if not token:
            return {"statusCode": 401, "headers": headers, "body": json.dumps({"error": "Нет токена"})}

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"""SELECT u.id, u.phone, u.name, u.username, u.about, u.status
                FROM {SCHEMA}.sessions s
                JOIN {SCHEMA}.users u ON u.id = s.user_id
                WHERE s.token = %s AND s.expires_at > NOW()""",
            (token,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return {"statusCode": 401, "headers": headers, "body": json.dumps({"error": "Сессия истекла"})}

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "ok": True,
                "user": {
                    "id": row[0], "phone": row[1], "name": row[2],
                    "username": row[3], "about": row[4], "status": row[5]
                }
            })
        }

    # PUT /profile — обновить профиль
    if method == "PUT" and path.endswith("/profile"):
        token = event.get("headers", {}).get("X-Auth-Token", "")
        if not token:
            return {"statusCode": 401, "headers": headers, "body": json.dumps({"error": "Нет токена"})}

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"SELECT user_id FROM {SCHEMA}.sessions WHERE token = %s AND expires_at > NOW()", (token,)
        )
        sess = cur.fetchone()
        if not sess:
            cur.close()
            conn.close()
            return {"statusCode": 401, "headers": headers, "body": json.dumps({"error": "Сессия истекла"})}

        user_id = sess[0]
        name = body.get("name")
        about = body.get("about")
        username = body.get("username")

        fields = []
        vals = []
        if name is not None:
            fields.append("name = %s")
            vals.append(name)
        if about is not None:
            fields.append("about = %s")
            vals.append(about)
        if username is not None:
            fields.append("username = %s")
            vals.append(username if username else None)

        if fields:
            vals.append(user_id)
            cur.execute(f"UPDATE {SCHEMA}.users SET {', '.join(fields)} WHERE id = %s", vals)
            conn.commit()

        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True})}

    # POST /logout
    if method == "POST" and path.endswith("/logout"):
        token = event.get("headers", {}).get("X-Auth-Token", "")
        if token:
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(f"UPDATE {SCHEMA}.users SET status = 'offline' WHERE id = (SELECT user_id FROM {SCHEMA}.sessions WHERE token = %s)", (token,))
            conn.commit()
            cur.close()
            conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True})}

    return {"statusCode": 404, "headers": headers, "body": json.dumps({"error": "Not found"})}