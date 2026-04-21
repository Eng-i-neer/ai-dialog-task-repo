"""
运动记录 API
- POST   /api/exercise           新增运动记录
- GET    /api/exercise?date=     查某天所有记录
- GET    /api/exercise/<id>      查单条
- PUT    /api/exercise/<id>      修改
- DELETE /api/exercise/<id>      删除
"""

from flask import Blueprint, jsonify, request, g
from backend.db import get_db, dict_rows, dict_row
from backend.routes.auth import login_required
from datetime import datetime

bp = Blueprint('exercise', __name__)


def _now_iso():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def _date_from_iso(iso_str):
    return iso_str[:10]


# ═══ 路由 ═══

@bp.route('/api/exercise', methods=['POST'])
@login_required
def add_exercise():
    """新增一条运动记录"""
    conn = get_db()
    data = request.get_json()

    date = data.get('date') or _date_from_iso(_now_iso())
    exercise_type = data.get('exercise_type', '')
    duration_minutes = data.get('duration_minutes')
    calories_burned = data.get('calories_burned')
    intensity = data.get('intensity', 'moderate')
    note = data.get('note', '')
    recorded_at = data.get('recorded_at') or _now_iso()

    conn.execute(
        """INSERT INTO exercise_records
           (date, exercise_type, duration_minutes, calories_burned, intensity, note, recorded_at, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (date, exercise_type, duration_minutes, calories_burned, intensity, note, recorded_at, g.user_id)
    )
    conn.commit()

    row = conn.execute(
        "SELECT * FROM exercise_records WHERE user_id=? ORDER BY id DESC LIMIT 1", (g.user_id,)
    ).fetchone()

    from backend.routes.weight import _update_daily_summary
    _update_daily_summary(conn, date)
    conn.close()

    return jsonify(dict_row(row)), 201


@bp.route('/api/exercise', methods=['GET'])
@login_required
def list_exercises():
    """查询某天的所有运动记录"""
    conn = get_db()
    date = request.args.get('date')

    if not date:
        conn.close()
        return jsonify({'error': '需要 date 参数'}), 400

    rows = conn.execute(
        "SELECT * FROM exercise_records WHERE date=? AND user_id=? ORDER BY recorded_at",
        (date, g.user_id)
    ).fetchall()
    conn.close()

    return jsonify(dict_rows(rows))


@bp.route('/api/exercise/month-summary', methods=['GET'])
@login_required
def month_summary():
    """查询某月每天的运动汇总（次数、总时长、总热量）"""
    conn = get_db()
    month = request.args.get('month')  # 格式 YYYY-MM

    if not month:
        conn.close()
        return jsonify({'error': '需要 month 参数 (YYYY-MM)'}), 400

    rows = conn.execute(
        """SELECT date,
                  COUNT(*)              AS count,
                  SUM(duration_minutes)  AS total_minutes,
                  SUM(calories_burned)   AS total_calories
           FROM exercise_records
           WHERE date LIKE ? AND user_id=?
           GROUP BY date
           ORDER BY date""",
        (month + '%', g.user_id)
    ).fetchall()
    conn.close()

    return jsonify(dict_rows(rows))


@bp.route('/api/exercise/<int:record_id>', methods=['GET'])
@login_required
def get_exercise(record_id):
    """查询单条运动记录"""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM exercise_records WHERE id=? AND user_id=?", (record_id, g.user_id)
    ).fetchone()
    conn.close()

    if not row:
        return jsonify({'error': '记录不存在'}), 404
    return jsonify(dict_row(row))


@bp.route('/api/exercise/<int:record_id>', methods=['PUT'])
@login_required
def update_exercise(record_id):
    """修改运动记录"""
    conn = get_db()
    data = request.get_json()

    existing = conn.execute(
        "SELECT * FROM exercise_records WHERE id=? AND user_id=?", (record_id, g.user_id)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': '记录不存在'}), 404

    exercise_type = data.get('exercise_type', existing['exercise_type'])
    duration_minutes = data.get('duration_minutes', existing['duration_minutes'])
    calories_burned = data.get('calories_burned', existing['calories_burned'])
    intensity = data.get('intensity', existing['intensity'])
    note = data.get('note', existing['note'])

    conn.execute(
        """UPDATE exercise_records
           SET exercise_type=?, duration_minutes=?, calories_burned=?, intensity=?, note=?
           WHERE id=? AND user_id=?""",
        (exercise_type, duration_minutes, calories_burned, intensity, note, record_id, g.user_id)
    )
    conn.commit()

    updated = conn.execute(
        "SELECT * FROM exercise_records WHERE id=? AND user_id=?", (record_id, g.user_id)
    ).fetchone()

    from backend.routes.weight import _update_daily_summary
    _update_daily_summary(conn, existing['date'])
    conn.close()

    return jsonify(dict_row(updated))


@bp.route('/api/exercise/<int:record_id>', methods=['DELETE'])
@login_required
def delete_exercise(record_id):
    """删除运动记录"""
    conn = get_db()

    existing = conn.execute(
        "SELECT * FROM exercise_records WHERE id=? AND user_id=?", (record_id, g.user_id)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': '记录不存在'}), 404

    date = existing['date']
    conn.execute("DELETE FROM exercise_records WHERE id=? AND user_id=?", (record_id, g.user_id))
    conn.commit()

    from backend.routes.weight import _update_daily_summary
    _update_daily_summary(conn, date)
    conn.close()

    return jsonify({'message': '已删除', 'id': record_id})
