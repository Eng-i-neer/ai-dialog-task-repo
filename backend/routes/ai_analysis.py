"""
AI 分析 API
- POST /api/ai/analyze       手动触发 AI 分析
- GET  /api/ai/history?date=  查看某天的分析历史
- GET  /api/ai/latest         获取最新一条分析
"""

import requests as http_requests
from flask import Blueprint, jsonify, request, g
from backend.db import get_db, dict_rows, dict_row
from backend.routes.auth import login_required
from datetime import datetime, timedelta

bp = Blueprint('ai_analysis', __name__)

# ═══ 系统 Prompt ═══
SYSTEM_PROMPT = """你是一位专业的 AI 减脂伴侣，拥有运动营养学和生理学背景。
你的用户正在进行减重计划，需要你的科学指导和情感支持。

## 你的核心职责

### 第一步：交叉数据分析
- 分析用户今日的 **体重波动、饮食摄入、运动消耗** 数据
- 识别做得好的地方（表扬具体行为，强化正向反馈）
- 指出潜在风险：
  - 🔵 储水风险（高钠饮食、碳水突增、运动后、经期等）
  - 🟡 掉肌肉风险（蛋白质不足、热量缺口过大、有氧过多等）
  - 🔴 代谢适应风险（长期低热量、平台期征兆）

### 第二步：明日体重趋势预测
- 基于今日数据和生理学规律，预测明日晨起体重的变化趋势
- 用科学原理解释预测原因（如：糖原储备、水分平衡、消化周期等）
- 明确告知用户："体重波动 ≠ 脂肪变化"，化解体重焦虑

### 第三步：达标时间推算
- 根据近期平均周减速率，动态推算达到目标体重的预计时间
- 如果减速合理（每周 0.5-1kg），给予肯定
- 如果减速过快或过慢，给出调整建议

### 第四步：明日微习惯建议
- 在分析最后，给出 **1 个具体的、可立即执行的微习惯建议**
- 要求：足够具体（不要"多喝水"，而是"起床后 30 分钟内喝 500ml 温水"）
- 要求：低门槛（用户能轻松做到）

## 回复风格要求
- 充满同理心，先共情再分析
- 语气温暖但专业，像一个了解你的私人教练
- 使用 emoji 让内容更生动
- 用 Markdown 格式组织，用二级/三级标题分段
- 控制总长度在 400-600 字"""


def _get_settings(conn, user_id=None):
    """获取用户设置"""
    uid = user_id or getattr(g, 'user_id', 1)
    row = conn.execute("SELECT * FROM user_settings WHERE user_id=?", (uid,)).fetchone()
    return dict_row(row) if row else {}


def _build_user_data(conn, date, user_id=None):
    """构建发送给 AI 的用户数据摘要"""
    uid = user_id or getattr(g, 'user_id', 1)

    # 今日体重
    weights = conn.execute(
        "SELECT weight, time_of_day, recorded_at, note FROM weight_records WHERE date=? AND user_id=? ORDER BY recorded_at",
        (date, uid)
    ).fetchall()

    # 今日饮食（包含 AI 估算热量）
    meals = conn.execute(
        "SELECT meal_type, description, calories, ai_calorie_estimate, photo_path, recorded_at FROM meal_records WHERE date=? AND user_id=? ORDER BY recorded_at",
        (date, uid)
    ).fetchall()

    # 今日运动
    exercises = conn.execute(
        "SELECT exercise_type, duration_minutes, calories_burned, intensity, note, recorded_at FROM exercise_records WHERE date=? AND user_id=? ORDER BY recorded_at",
        (date, uid)
    ).fetchall()

    # 近7天 daily_summary
    date_7_ago = (datetime.strptime(date, '%Y-%m-%d') - timedelta(days=7)).strftime('%Y-%m-%d')
    summaries = conn.execute(
        "SELECT date, morning_weight, avg_weight, lowest_weight, total_calories_in, total_calories_out FROM daily_summary WHERE date BETWEEN ? AND ? AND user_id=? ORDER BY date",
        (date_7_ago, date, uid)
    ).fetchall()

    # 用户基本信息
    settings = _get_settings(conn)

    # 组装文本
    lines = [f"## 📊 {date} 数据报告\n"]

    # 基本信息
    if settings:
        info_parts = []
        if settings.get('target_weight'): info_parts.append(f"目标体重: {settings['target_weight']}kg")
        if settings.get('height_cm'): info_parts.append(f"身高: {settings['height_cm']}cm")
        if settings.get('gender'): info_parts.append(f"性别: {'男' if settings['gender']=='male' else '女'}")
        if settings.get('activity_level'): info_parts.append(f"活动水平: {settings['activity_level']}")
        if info_parts:
            lines.append("### 用户信息")
            lines.append("、".join(info_parts))
            lines.append("")

    # 体重数据
    lines.append("### 今日体重记录")
    if weights:
        for w in weights:
            time_str = w['recorded_at'][11:16] if w['recorded_at'] else ''
            note_str = f" ({w['note']})" if w['note'] else ''
            lines.append(f"- {time_str} {w['time_of_day']}: **{w['weight']}kg**{note_str}")
    else:
        lines.append("- 暂无体重记录")
    lines.append("")

    # 饮食数据（优先用 AI 估算热量）
    lines.append("### 今日饮食记录")
    if meals:
        total_cal_in = 0
        for m in meals:
            cal = m['ai_calorie_estimate'] or m['calories']
            cal_str = f" ({cal}kcal)" if cal else ''
            photo_str = ' [有照片]' if m['photo_path'] else ''
            lines.append(f"- {m['meal_type']}: {m['description']}{cal_str}{photo_str}")
            total_cal_in += (cal or 0)
        lines.append(f"\n**总摄入: {total_cal_in} kcal**")
    else:
        lines.append("- 暂无饮食记录")
    lines.append("")

    # 运动数据
    lines.append("### 今日运动记录")
    if exercises:
        total_cal_out = 0
        for e in exercises:
            cal_str = f" 消耗{e['calories_burned']}kcal" if e['calories_burned'] else ''
            note_str = f" ({e['note']})" if e['note'] else ''
            lines.append(f"- {e['exercise_type']}: {e['duration_minutes']}分钟 ({e['intensity']}){cal_str}{note_str}")
            total_cal_out += (e['calories_burned'] or 0)
        lines.append(f"\n**总消耗: {total_cal_out} kcal**")
    else:
        lines.append("- 暂无运动记录")
    lines.append("")

    # 近7天趋势
    lines.append("### 近7天趋势")
    if summaries:
        for s in summaries:
            morning = f"{s['morning_weight']}kg" if s['morning_weight'] else '-'
            avg = f"{s['avg_weight']}kg" if s['avg_weight'] else '-'
            lines.append(f"- {s['date']}: 晨起{morning} / 日均{avg}")
    else:
        lines.append("- 暂无历史数据")

    return "\n".join(lines)


def _call_doubao_api(settings, system_prompt, user_message):
    """调用豆包/火山方舟 Chat API"""
    api_key = settings.get('ai_api_key')
    api_url = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
    model = 'doubao-seed-1-8-251228'

    if not api_key:
        raise ValueError('请先在设置页配置 AI API Key')

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }

    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message},
        ],
        'temperature': 0.7,
        'max_tokens': 2000,
    }

    resp = http_requests.post(api_url, json=payload, headers=headers, timeout=60)

    if resp.status_code != 200:
        error_msg = resp.text[:200]
        raise RuntimeError(f'AI API 返回 {resp.status_code}: {error_msg}')

    result = resp.json()
    content = result['choices'][0]['message']['content']
    tokens = result.get('usage', {}).get('total_tokens', 0)

    return content, model, tokens


# ═══ 路由 ═══

@bp.route('/api/ai/analyze', methods=['POST'])
@login_required
def trigger_analysis():
    """手动触发 AI 分析"""
    conn = get_db()
    data = request.get_json() or {}
    date = data.get('date') or datetime.now().strftime('%Y-%m-%d')

    # 获取设置
    settings = _get_settings(conn)

    # 构建用户数据
    user_data = _build_user_data(conn, date)

    try:
        analysis_text, model_used, tokens_used = _call_doubao_api(
            settings, SYSTEM_PROMPT, user_data
        )
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 400

    # 保存分析结果
    conn.execute(
        """INSERT INTO ai_analysis (date, analysis_text, model_used, tokens_used, user_id)
           VALUES (?, ?, ?, ?, ?)""",
        (date, analysis_text, model_used, tokens_used, g.user_id)
    )
    conn.commit()

    # 获取刚插入的记录
    row = conn.execute(
        "SELECT * FROM ai_analysis WHERE user_id=? ORDER BY id DESC LIMIT 1", (g.user_id,)
    ).fetchone()
    conn.close()

    return jsonify(dict_row(row))


@bp.route('/api/ai/history', methods=['GET'])
@login_required
def analysis_history():
    """查看某天的分析历史"""
    conn = get_db()
    date = request.args.get('date')
    if not date:
        date = datetime.now().strftime('%Y-%m-%d')

    rows = conn.execute(
        "SELECT * FROM ai_analysis WHERE date=? AND user_id=? ORDER BY created_at DESC",
        (date, g.user_id)
    ).fetchall()
    conn.close()

    return jsonify(dict_rows(rows))


@bp.route('/api/ai/latest', methods=['GET'])
@login_required
def latest_analysis():
    """获取最新一条分析"""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM ai_analysis WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
        (g.user_id,)
    ).fetchone()
    conn.close()

    if not row:
        return jsonify(None)
    return jsonify(dict_row(row))
