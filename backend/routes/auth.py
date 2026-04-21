"""
减肥日志 — 用户认证模块
注册、登录、Token 验证
"""

from flask import Blueprint, request, jsonify, g
import hashlib
import time
import json
import hmac
import base64
import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT_DIR)

from backend.db import get_db

bp = Blueprint('auth', __name__)

SALT = "weight_tracker_2026"
TOKEN_EXPIRE_DAYS = 7


# ═══ 工具函数 ═══

def hash_password(password):
    """密码哈希"""
    return hashlib.sha256(f"{SALT}:{password}".encode()).hexdigest()


def get_jwt_secret():
    """获取 JWT 密钥"""
    conn = get_db()
    row = conn.execute("SELECT value FROM system_config WHERE key='jwt_secret'").fetchone()
    conn.close()
    if row:
        return row[0]
    # 如果没有，生成一个
    import secrets
    secret = secrets.token_hex(32)
    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO system_config (key, value) VALUES ('jwt_secret', ?)", (secret,))
    conn.commit()
    conn.close()
    return secret


def create_token(user_id, username):
    """生成简单的 JWT-like token（不依赖 PyJWT 库）"""
    secret = get_jwt_secret()
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": int(time.time()) + TOKEN_EXPIRE_DAYS * 86400
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
    header_b64 = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip('=')
    signature = hmac.new(secret.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).hexdigest()
    return f"{header_b64}.{payload_b64}.{signature}"


def verify_token(token):
    """验证 token，返回 payload 或 None"""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature = parts

        secret = get_jwt_secret()
        expected_sig = hmac.new(secret.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None

        # 补齐 base64 padding
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += '=' * padding

        payload = json.loads(base64.urlsafe_b64decode(payload_b64))

        # 检查过期
        if payload.get('exp', 0) < time.time():
            return None

        return payload
    except Exception:
        return None


def login_required(f):
    """登录验证装饰器"""
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "未登录，请先登录"}), 401

        token = auth_header[7:]
        payload = verify_token(token)
        if not payload:
            return jsonify({"error": "登录已过期，请重新登录"}), 401

        g.user_id = payload['user_id']
        g.username = payload['username']
        return f(*args, **kwargs)

    return decorated


# ═══ API 路由 ═══

@bp.route('/api/auth/register', methods=['POST'])
def register():
    """用户注册（已禁用：仅管理员可在后台创建账号）"""
    return jsonify({"error": "注册功能已关闭，请联系管理员开通账号"}), 403
    data = request.get_json()
    if not data:
        return jsonify({"error": "请提供注册信息"}), 400

    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    nickname = (data.get('nickname') or '').strip() or username

    if not username or len(username) < 2:
        return jsonify({"error": "用户名至少2个字符"}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "密码至少6个字符"}), 400

    conn = get_db()
    try:
        # 检查用户名是否已存在
        existing = conn.execute(
            "SELECT id FROM users WHERE username=?", (username,)
        ).fetchone()
        if existing:
            conn.close()
            return jsonify({"error": "用户名已存在"}), 409

        # 创建用户
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)",
            (username, hash_password(password), nickname)
        )
        user_id = cursor.lastrowid

        # 创建默认设置
        conn.execute(
            "INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)",
            (user_id,)
        )

        conn.commit()

        # 自动登录，返回 token
        token = create_token(user_id, username)

        return jsonify({
            "message": "注册成功",
            "token": token,
            "user": {
                "id": user_id,
                "username": username,
                "nickname": nickname
            }
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"注册失败: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/api/auth/login', methods=['POST'])
def login():
    """用户登录"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "请提供登录信息"}), 400

    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({"error": "请输入用户名和密码"}), 400

    conn = get_db()
    try:
        user = conn.execute(
            "SELECT id, username, nickname, password_hash FROM users WHERE username=?",
            (username,)
        ).fetchone()

        if not user or user['password_hash'] != hash_password(password):
            return jsonify({"error": "用户名或密码错误"}), 401

        # 更新最后登录时间
        conn.execute(
            "UPDATE users SET last_login=datetime('now','localtime') WHERE id=?",
            (user['id'],)
        )
        conn.commit()

        token = create_token(user['id'], user['username'])

        return jsonify({
            "message": "登录成功",
            "token": token,
            "user": {
                "id": user['id'],
                "username": user['username'],
                "nickname": user['nickname']
            }
        })

    except Exception as e:
        return jsonify({"error": f"登录失败: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/api/auth/me', methods=['GET'])
@login_required
def get_me():
    """获取当前用户信息"""
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT id, username, nickname, created_at, last_login FROM users WHERE id=?",
            (g.user_id,)
        ).fetchone()

        if not user:
            return jsonify({"error": "用户不存在"}), 404

        return jsonify({
            "id": user['id'],
            "username": user['username'],
            "nickname": user['nickname'],
            "created_at": user['created_at'],
            "last_login": user['last_login']
        })
    finally:
        conn.close()


@bp.route('/api/auth/password', methods=['PUT'])
@login_required
def change_password():
    """修改密码"""
    data = request.get_json()
    old_password = data.get('old_password') or ''
    new_password = data.get('new_password') or ''

    if len(new_password) < 6:
        return jsonify({"error": "新密码至少6个字符"}), 400

    conn = get_db()
    try:
        user = conn.execute(
            "SELECT password_hash FROM users WHERE id=?", (g.user_id,)
        ).fetchone()

        if not user or user['password_hash'] != hash_password(old_password):
            return jsonify({"error": "原密码错误"}), 401

        conn.execute(
            "UPDATE users SET password_hash=? WHERE id=?",
            (hash_password(new_password), g.user_id)
        )
        conn.commit()
        return jsonify({"message": "密码修改成功"})
    finally:
        conn.close()
