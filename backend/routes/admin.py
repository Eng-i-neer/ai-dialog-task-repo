"""
减肥日志 — 管理员用户管理 API
仅管理员（lyt，user_id=1）可访问
"""

from flask import Blueprint, request, jsonify, g
import os, sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT_DIR)

from backend.db import get_db
from backend.routes.auth import login_required, hash_password

bp = Blueprint('admin', __name__)

ADMIN_USER_ID = 1


def admin_required(f):
    """管理员权限装饰器（叠加在 login_required 之后使用）"""
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if getattr(g, 'user_id', None) != ADMIN_USER_ID:
            return jsonify({"error": "无权限，仅管理员可操作"}), 403
        return f(*args, **kwargs)

    return decorated


@bp.route('/api/admin/users', methods=['GET'])
@login_required
@admin_required
def list_users():
    """获取所有用户列表"""
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, username, nickname, created_at, last_login FROM users ORDER BY id"
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.route('/api/admin/users', methods=['POST'])
@login_required
@admin_required
def create_user():
    """新增用户"""
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    nickname = (data.get('nickname') or '').strip() or username

    if not username or len(username) < 2:
        return jsonify({"error": "用户名至少2个字符"}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "密码至少6个字符"}), 400

    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE username=?", (username,)
        ).fetchone()
        if existing:
            return jsonify({"error": "用户名已存在"}), 409

        cursor = conn.execute(
            "INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)",
            (username, hash_password(password), nickname)
        )
        user_id = cursor.lastrowid

        # 复制管理员的 AI 配置到新用户
        admin_settings = conn.execute(
            "SELECT ai_api_key, ai_api_url, ai_model, vision_api_key, vision_api_url, vision_model "
            "FROM user_settings WHERE user_id=?", (ADMIN_USER_ID,)
        ).fetchone()

        if admin_settings:
            conn.execute(
                """INSERT OR IGNORE INTO user_settings
                   (user_id, ai_api_key, ai_api_url, ai_model, vision_api_key, vision_api_url, vision_model)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (user_id,
                 admin_settings['ai_api_key'], admin_settings['ai_api_url'], admin_settings['ai_model'],
                 admin_settings['vision_api_key'], admin_settings['vision_api_url'], admin_settings['vision_model'])
            )
        else:
            conn.execute("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)", (user_id,))

        conn.commit()
        return jsonify({
            "message": "用户创建成功",
            "user": {"id": user_id, "username": username, "nickname": nickname}
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"创建失败: {str(e)}"}), 500
    finally:
        conn.close()


@bp.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_user(user_id):
    """删除用户及其所有数据"""
    if user_id == ADMIN_USER_ID:
        return jsonify({"error": "不能删除管理员账号"}), 400

    conn = get_db()
    try:
        user = conn.execute("SELECT username FROM users WHERE id=?", (user_id,)).fetchone()
        if not user:
            return jsonify({"error": "用户不存在"}), 404

        username = user['username']

        # 删除该用户的所有数据
        for table in ['weight_records', 'meal_records', 'exercise_records',
                      'ai_analysis', 'daily_summary', 'user_settings']:
            conn.execute(f"DELETE FROM {table} WHERE user_id=?", (user_id,))

        conn.execute("DELETE FROM users WHERE id=?", (user_id,))
        conn.commit()

        return jsonify({"message": f"用户「{username}」及其所有数据已删除"})

    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"删除失败: {str(e)}"}), 500
    finally:
        conn.close()
