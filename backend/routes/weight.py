"""
体重记录 API
- POST   /api/weight           新增体重记录
- GET    /api/weight?date=     查某天所有记录
- GET    /api/weight/<id>      查单条
- PUT    /api/weight/<id>      修改
- DELETE /api/weight/<id>      删除
"""

from flask import Blueprint, jsonify, request, g
from backend.db import get_db, dict_rows, dict_row
from backend.routes.auth import login_required
from datetime import datetime

bp = Blueprint('weight', __name__)


def _now_iso():
    """返回当前本地时间的 ISO 格式字符串"""
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def _date_from_iso(iso_str):
    """从 ISO 时间字符串中截取日期部分 YYYY-MM-DD"""
    return iso_str[:10]


def _update_daily_summary(conn, date, user_id=None):
    """自愈式更新某天的 daily_summary（从原始数据重新计算）"""
    if user_id is None:
        user_id = getattr(g, 'user_id', 1)

    # 1. 查当天所有体重记录
    weights = conn.execute(
        "SELECT weight, time_of_day FROM weight_records WHERE date=? AND user_id=? ORDER BY recorded_at",
        (date, user_id)
    ).fetchall()

    if not weights:
        # 没有记录则删除汇总
        conn.execute("DELETE FROM daily_summary WHERE date=? AND user_id=?", (date, user_id))
        conn.commit()
        return

    weight_values = [w['weight'] for w in weights]
    morning_weights = [w['weight'] for w in weights if w['time_of_day'] == 'morning']

    morning_weight = morning_weights[0] if morning_weights else None
    lowest = min(weight_values)
    highest = max(weight_values)
    avg_weight = round(sum(weight_values) / len(weight_values), 1)
    count = len(weight_values)

    # 2. 查当天饮食热量
    cal_in = conn.execute(
        """SELECT COALESCE(SUM(COALESCE(ai_calorie_estimate, calories, 0)), 0) as total
           FROM meal_records WHERE date=? AND user_id=?""",
        (date, user_id)
    ).fetchone()['total']

    # 3. 查当天运动消耗
    cal_out = conn.execute(
        "SELECT COALESCE(SUM(COALESCE(calories_burned, 0)), 0) as total FROM exercise_records WHERE date=? AND user_id=?",
        (date, user_id)
    ).fetchone()['total']

    # 4. 计算较前日变化
    weight_change = None
    if morning_weight is not None:
        prev = conn.execute(
            """SELECT morning_weight FROM daily_summary
               WHERE date < ? AND user_id=? AND morning_weight IS NOT NULL
               ORDER BY date DESC LIMIT 1""",
            (date, user_id)
        ).fetchone()
        if prev and prev['morning_weight']:
            weight_change = round(morning_weight - prev['morning_weight'], 1)

    # 5. 先尝试更新
    cursor = conn.execute(
        """UPDATE daily_summary SET
            morning_weight=?, lowest_weight=?, highest_weight=?,
            avg_weight=?, weight_count=?, total_calories_in=?,
            total_calories_out=?, weight_change=?,
            updated_at=datetime('now','localtime')
           WHERE date=? AND user_id=?""",
        (morning_weight, lowest, highest, avg_weight, count,
         cal_in, cal_out, weight_change, date, user_id)
    )
    if cursor.rowcount == 0:
        conn.execute(
            """INSERT INTO daily_summary
               (date, user_id, morning_weight, lowest_weight, highest_weight,
                avg_weight, weight_count, total_calories_in,
                total_calories_out, weight_change, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))""",
            (date, user_id, morning_weight, lowest, highest, avg_weight, count,
             cal_in, cal_out, weight_change)
        )
    conn.commit()


# ═══ 路由 ═══

@bp.route('/api/weight', methods=['POST'])
@login_required
def add_weight():
    """新增一条体重记录"""
    conn = get_db()
    data = request.get_json()

    weight = data.get('weight')
    time_of_day = data.get('time_of_day', 'other')
    note = data.get('note', '')

    if weight is None:
        conn.close()
        return jsonify({'error': '缺少必填字段: weight'}), 400

    try:
        weight = round(float(weight), 1)
    except (ValueError, TypeError):
        conn.close()
        return jsonify({'error': 'weight 必须是数字'}), 400

    recorded_at = data.get('recorded_at') or _now_iso()
    date = _date_from_iso(recorded_at)

    conn.execute(
        """INSERT INTO weight_records (weight, recorded_at, date, time_of_day, note, user_id)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (weight, recorded_at, date, time_of_day, note, g.user_id)
    )
    conn.commit()

    row = conn.execute(
        "SELECT * FROM weight_records WHERE user_id=? ORDER BY id DESC LIMIT 1", (g.user_id,)
    ).fetchone()

    # 自愈更新当天汇总
    _update_daily_summary(conn, date)
    conn.close()

    return jsonify(dict_row(row)), 201


@bp.route('/api/weight', methods=['GET'])
@login_required
def list_weights():
    """查询某天的所有体重记录"""
    conn = get_db()
    date = request.args.get('date')

    if not date:
        conn.close()
        return jsonify({'error': '需要 date 参数'}), 400

    rows = conn.execute(
        "SELECT * FROM weight_records WHERE date=? AND user_id=? ORDER BY recorded_at",
        (date, g.user_id)
    ).fetchall()
    conn.close()

    return jsonify(dict_rows(rows))


@bp.route('/api/weight/<int:record_id>', methods=['GET'])
@login_required
def get_weight(record_id):
    """查询单条体重记录"""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM weight_records WHERE id=? AND user_id=?", (record_id, g.user_id)
    ).fetchone()
    conn.close()

    if not row:
        return jsonify({'error': '记录不存在'}), 404
    return jsonify(dict_row(row))


@bp.route('/api/weight/<int:record_id>', methods=['PUT'])
@login_required
def update_weight(record_id):
    """修改体重记录"""
    conn = get_db()
    data = request.get_json()

    existing = conn.execute(
        "SELECT * FROM weight_records WHERE id=? AND user_id=?", (record_id, g.user_id)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': '记录不存在'}), 404

    weight = data.get('weight', existing['weight'])
    time_of_day = data.get('time_of_day', existing['time_of_day'])
    note = data.get('note', existing['note'])

    try:
        weight = round(float(weight), 1)
    except (ValueError, TypeError):
        conn.close()
        return jsonify({'error': 'weight 必须是数字'}), 400

    conn.execute(
        """UPDATE weight_records SET weight=?, time_of_day=?, note=?
           WHERE id=?""",
        (weight, time_of_day, note, record_id)
    )
    conn.commit()

    updated = conn.execute(
        "SELECT * FROM weight_records WHERE id=?", (record_id,)
    ).fetchone()

    # 自愈更新当天汇总
    _update_daily_summary(conn, existing['date'])
    conn.close()

    return jsonify(dict_row(updated))


@bp.route('/api/weight/<int:record_id>', methods=['DELETE'])
@login_required
def delete_weight(record_id):
    """删除体重记录"""
    conn = get_db()

    existing = conn.execute(
        "SELECT * FROM weight_records WHERE id=? AND user_id=?", (record_id, g.user_id)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': '记录不存在'}), 404

    date = existing['date']
    conn.execute("DELETE FROM weight_records WHERE id=?", (record_id,))
    conn.commit()

    # 自愈更新当天汇总
    _update_daily_summary(conn, date)
    conn.close()

    return jsonify({'message': '已删除', 'id': record_id})
