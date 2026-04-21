"""
仪表盘聚合 API
- GET /api/dashboard/today?date=   当日全量数据（体重+饮食+运动+汇总）
- GET /api/dashboard/trend?days=7  趋势数据（支持 days 或 from+to）
- GET /api/dashboard/stats         全局统计（起始/当前/目标/BMI/进度）
"""

from flask import Blueprint, jsonify, request, g
from backend.db import get_db, dict_rows, dict_row
from backend.routes.auth import login_required
from datetime import datetime, timedelta

bp = Blueprint('dashboard', __name__)


@bp.route('/api/dashboard/today', methods=['GET'])
@login_required
def dashboard_today():
    """一次查询返回当日所有数据"""
    conn = get_db()
    date = request.args.get('date') or datetime.now().strftime('%Y-%m-%d')

    weights = conn.execute(
        "SELECT * FROM weight_records WHERE date=? AND user_id=? ORDER BY recorded_at",
        (date, g.user_id)
    ).fetchall()

    meals = conn.execute(
        "SELECT * FROM meal_records WHERE date=? AND user_id=? ORDER BY recorded_at",
        (date, g.user_id)
    ).fetchall()

    exercises = conn.execute(
        "SELECT * FROM exercise_records WHERE date=? AND user_id=? ORDER BY recorded_at",
        (date, g.user_id)
    ).fetchall()

    summary = conn.execute(
        "SELECT * FROM daily_summary WHERE date=? AND user_id=?", (date, g.user_id)
    ).fetchone()

    latest_analysis = conn.execute(
        "SELECT * FROM ai_analysis WHERE date=? AND user_id=? ORDER BY created_at DESC LIMIT 1",
        (date, g.user_id)
    ).fetchone()

    conn.close()

    return jsonify({
        'date': date,
        'weights': dict_rows(weights),
        'meals': dict_rows(meals),
        'exercises': dict_rows(exercises),
        'summary': dict_row(summary),
        'latest_analysis': dict_row(latest_analysis),
    })


@bp.route('/api/dashboard/trend', methods=['GET'])
@login_required
def dashboard_trend():
    """趋势数据：支持 days 参数 或 from+to 日期范围"""
    conn = get_db()

    date_from = request.args.get('from')
    date_to = request.args.get('to')
    days = request.args.get('days')

    if date_from and date_to:
        pass
    elif days:
        try:
            n = int(days)
        except ValueError:
            n = 7
        date_to = datetime.now().strftime('%Y-%m-%d')
        date_from = (datetime.now() - timedelta(days=n - 1)).strftime('%Y-%m-%d')
    else:
        date_to = datetime.now().strftime('%Y-%m-%d')
        date_from = (datetime.now() - timedelta(days=6)).strftime('%Y-%m-%d')

    rows = conn.execute(
        """SELECT * FROM daily_summary
           WHERE date BETWEEN ? AND ? AND user_id=?
           ORDER BY date""",
        (date_from, date_to, g.user_id)
    ).fetchall()
    conn.close()

    return jsonify({
        'from': date_from,
        'to': date_to,
        'data': dict_rows(rows),
    })


@bp.route('/api/dashboard/stats', methods=['GET'])
@login_required
def dashboard_stats():
    """全局统计：起始体重、当前体重、目标、BMI、减重进度"""
    conn = get_db()

    # 用户设置
    settings = conn.execute("SELECT * FROM user_settings WHERE user_id=?", (g.user_id,)).fetchone()

    # 起始体重（最早的一条记录）
    first = conn.execute(
        "SELECT weight FROM weight_records WHERE user_id=? ORDER BY recorded_at ASC LIMIT 1",
        (g.user_id,)
    ).fetchone()
    start_weight = first['weight'] if first else None

    # 当前体重
    latest_morning = conn.execute(
        """SELECT weight FROM weight_records
           WHERE time_of_day='morning' AND user_id=?
           ORDER BY recorded_at DESC LIMIT 1""",
        (g.user_id,)
    ).fetchone()
    latest_any = conn.execute(
        "SELECT weight FROM weight_records WHERE user_id=? ORDER BY recorded_at DESC LIMIT 1",
        (g.user_id,)
    ).fetchone()
    current_weight = None
    if latest_morning:
        current_weight = latest_morning['weight']
    elif latest_any:
        current_weight = latest_any['weight']

    target_weight = settings['target_weight'] if settings else None
    height_cm = settings['height_cm'] if settings else None

    bmi = None
    if current_weight and height_cm:
        height_m = height_cm / 100
        bmi = round(current_weight / (height_m ** 2), 1)

    progress = None
    if start_weight and target_weight and current_weight:
        total_to_lose = start_weight - target_weight
        if total_to_lose > 0:
            lost = start_weight - current_weight
            progress = round(min(max(lost / total_to_lose * 100, 0), 100), 1)

    day_count = conn.execute(
        "SELECT COUNT(DISTINCT date) as cnt FROM weight_records WHERE user_id=?",
        (g.user_id,)
    ).fetchone()['cnt']

    record_count = conn.execute(
        "SELECT COUNT(*) as cnt FROM weight_records WHERE user_id=?",
        (g.user_id,)
    ).fetchone()['cnt']

    conn.close()

    return jsonify({
        'start_weight': start_weight,
        'current_weight': current_weight,
        'target_weight': target_weight,
        'height_cm': height_cm,
        'bmi': bmi,
        'progress': progress,
        'day_count': day_count,
        'record_count': record_count,
    })
