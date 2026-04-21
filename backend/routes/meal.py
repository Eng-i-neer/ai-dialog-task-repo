"""
饮食记录 API
- POST   /api/meal           新增饮食记录
- GET    /api/meal?date=     查某天所有记录
- GET    /api/meal/<id>      查单条
- PUT    /api/meal/<id>      修改
- DELETE /api/meal/<id>      删除
"""

from flask import Blueprint, jsonify, request, g
from backend.db import get_db, dict_rows, dict_row
from backend.routes.auth import login_required
from datetime import datetime

bp = Blueprint('meal', __name__)


def _now_iso():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def _date_from_iso(iso_str):
    return iso_str[:10]


# ═══ 路由 ═══

@bp.route('/api/meal', methods=['POST'])
@login_required
def add_meal():
    """新增一条饮食记录"""
    conn = get_db()
    data = request.get_json()

    date = data.get('date') or _date_from_iso(_now_iso())
    meal_type = data.get('meal_type', 'other')
    description = data.get('description', '')
    calories = data.get('calories')
    photo_path = data.get('photo_path')
    ai_calorie_estimate = data.get('ai_calorie_estimate')
    ai_analysis_json = data.get('ai_analysis_json')
    recorded_at = data.get('recorded_at') or _now_iso()

    conn.execute(
        """INSERT INTO meal_records
           (date, meal_type, description, calories, photo_path, ai_calorie_estimate, ai_analysis_json, recorded_at, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (date, meal_type, description, calories, photo_path, ai_calorie_estimate, ai_analysis_json, recorded_at, g.user_id)
    )
    conn.commit()

    row = conn.execute(
        "SELECT * FROM meal_records WHERE user_id=? ORDER BY id DESC LIMIT 1", (g.user_id,)
    ).fetchone()

    from backend.routes.weight import _update_daily_summary
    _update_daily_summary(conn, date)
    conn.close()

    return jsonify(dict_row(row)), 201


@bp.route('/api/meal', methods=['GET'])
@login_required
def list_meals():
    """查询某天的所有饮食记录"""
    conn = get_db()
    date = request.args.get('date')

    if not date:
        conn.close()
        return jsonify({'error': '需要 date 参数'}), 400

    rows = conn.execute(
        "SELECT * FROM meal_records WHERE date=? AND user_id=? ORDER BY recorded_at",
        (date, g.user_id)
    ).fetchall()
    conn.close()

    return jsonify(dict_rows(rows))


@bp.route('/api/meal/<int:record_id>', methods=['GET'])
@login_required
def get_meal(record_id):
    """查询单条饮食记录"""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM meal_records WHERE id=? AND user_id=?", (record_id, g.user_id)
    ).fetchone()
    conn.close()

    if not row:
        return jsonify({'error': '记录不存在'}), 404
    return jsonify(dict_row(row))


@bp.route('/api/meal/<int:record_id>', methods=['PUT'])
@login_required
def update_meal(record_id):
    """修改饮食记录"""
    conn = get_db()
    data = request.get_json()

    existing = conn.execute(
        "SELECT * FROM meal_records WHERE id=? AND user_id=?", (record_id, g.user_id)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': '记录不存在'}), 404

    meal_type = data.get('meal_type', existing['meal_type'])
    description = data.get('description', existing['description'])
    calories = data.get('calories', existing['calories'])
    ai_calorie_estimate = data.get('ai_calorie_estimate', existing['ai_calorie_estimate'])

    conn.execute(
        """UPDATE meal_records
           SET meal_type=?, description=?, calories=?, ai_calorie_estimate=?
           WHERE id=? AND user_id=?""",
        (meal_type, description, calories, ai_calorie_estimate, record_id, g.user_id)
    )
    conn.commit()

    updated = conn.execute(
        "SELECT * FROM meal_records WHERE id=? AND user_id=?", (record_id, g.user_id)
    ).fetchone()

    from backend.routes.weight import _update_daily_summary
    _update_daily_summary(conn, existing['date'])
    conn.close()

    return jsonify(dict_row(updated))


@bp.route('/api/meal/<int:record_id>', methods=['DELETE'])
@login_required
def delete_meal(record_id):
    """删除饮食记录"""
    conn = get_db()

    existing = conn.execute(
        "SELECT * FROM meal_records WHERE id=? AND user_id=?", (record_id, g.user_id)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': '记录不存在'}), 404

    date = existing['date']
    conn.execute("DELETE FROM meal_records WHERE id=? AND user_id=?", (record_id, g.user_id))
    conn.commit()

    from backend.routes.weight import _update_daily_summary
    _update_daily_summary(conn, date)
    conn.close()

    return jsonify({'message': '已删除', 'id': record_id})
