"""
用户设置 API
- GET  /api/settings     获取设置
- PUT  /api/settings     更新设置
"""

from flask import Blueprint, jsonify, request, g
from backend.db import get_db, dict_row
from backend.routes.auth import login_required

bp = Blueprint('settings', __name__)

# 允许通过 API 更新的字段白名单
ALLOWED_FIELDS = {
    'target_weight', 'height_cm', 'gender', 'birth_date', 'activity_level',
    'ai_api_key',
}


@bp.route('/api/settings', methods=['GET'])
@login_required
def get_settings():
    """获取用户设置"""
    conn = get_db()
    row = conn.execute("SELECT * FROM user_settings WHERE user_id=?", (g.user_id,)).fetchone()
    conn.close()

    if not row:
        return jsonify({
            'user_id': g.user_id,
            'target_weight': None,
            'height_cm': None,
            'gender': 'male',
            'birth_date': None,
            'activity_level': 'moderate',
            'ai_api_key': None,
            'ai_api_url': None,
            'ai_model': 'deepseek-chat',
            'vision_api_key': None,
            'vision_api_url': None,
            'vision_model': 'doubao-vision',
        })

    return jsonify(dict_row(row))


@bp.route('/api/settings', methods=['PUT'])
@login_required
def update_settings():
    """更新用户设置（只更新传入的字段）"""
    conn = get_db()
    data = request.get_json()

    if not data:
        conn.close()
        return jsonify({'error': '请求体为空'}), 400

    # 过滤出允许更新的字段
    updates = {}
    for key, value in data.items():
        if key in ALLOWED_FIELDS:
            updates[key] = value

    if not updates:
        conn.close()
        return jsonify({'error': '没有可更新的字段'}), 400

    # 动态构建 UPDATE SQL
    set_clauses = [f"{k}=?" for k in updates.keys()]
    set_clauses.append("updated_at=datetime('now', 'localtime')")
    values = list(updates.values())
    values.append(g.user_id)

    sql = f"UPDATE user_settings SET {', '.join(set_clauses)} WHERE user_id=?"
    conn.execute(sql, values)
    conn.commit()

    row = conn.execute("SELECT * FROM user_settings WHERE user_id=?", (g.user_id,)).fetchone()
    conn.close()

    return jsonify(dict_row(row))
