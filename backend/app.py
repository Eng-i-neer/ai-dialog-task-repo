"""
减肥日志系统 — Flask 主程序
提供 API 服务 + 前端静态文件服务
"""

from flask import Flask, jsonify, send_from_directory
import os
import sys
import time

# 把项目根目录加入路径
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT_DIR)

from backend.db import get_db, DB_PATH

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False  # 允许 JSON 输出中文


# ═══ 注册路由蓝图 ═══

from backend.routes.auth import bp as auth_bp
app.register_blueprint(auth_bp)

from backend.routes.weight import bp as weight_bp
app.register_blueprint(weight_bp)

from backend.routes.settings import bp as settings_bp
app.register_blueprint(settings_bp)

from backend.routes.dashboard import bp as dashboard_bp
app.register_blueprint(dashboard_bp)

from backend.routes.meal import bp as meal_bp
app.register_blueprint(meal_bp)

from backend.routes.exercise import bp as exercise_bp
app.register_blueprint(exercise_bp)

from backend.routes.ai_analysis import bp as ai_bp
app.register_blueprint(ai_bp)

from backend.routes.upload import bp as upload_bp
app.register_blueprint(upload_bp)

from backend.routes.ai_vision import bp as vision_bp
app.register_blueprint(vision_bp)

from backend.routes.admin import bp as admin_bp
app.register_blueprint(admin_bp)


# ═══ 前端静态文件 ═══

@app.route('/')
def index():
    """首页 — 加载前端 SPA，注入缓存破坏时间戳"""
    html_path = os.path.join(ROOT_DIR, 'frontend', 'index.html')
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()
    html = html.replace('__CACHE_BUST__', str(int(time.time())))
    return html, 200, {'Content-Type': 'text/html; charset=utf-8'}


@app.route('/frontend/<path:filename>')
def serve_frontend(filename):
    """提供前端静态资源"""
    return send_from_directory(os.path.join(ROOT_DIR, 'frontend'), filename)


@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    """提供上传文件的静态访问"""
    return send_from_directory(os.path.join(ROOT_DIR, 'backend', 'uploads'), filename)


@app.after_request
def add_cache_headers(response):
    """智能缓存策略：
    - HTML: 不缓存（确保最新）
    - JS/CSS: 短期缓存（有 cache_bust 参数确保更新时刷新）
    """
    ct = response.content_type or ''
    if 'html' in ct:
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    elif 'javascript' in ct or 'css' in ct:
        response.headers['Cache-Control'] = 'no-cache, must-revalidate'
    return response


# ═══ 健康检查 ═══

@app.route('/api/health')
def health():
    """系统健康检查 API"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        table_count = cursor.fetchone()[0]
        conn.close()

        return jsonify({
            'status': 'ok',
            'message': '🏋️ 减肥日志系统运行中',
            'database': {
                'path': DB_PATH,
                'tables': table_count
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'数据库连接失败: {str(e)}'
        }), 500


# ═══ 启动 ═══

if __name__ == '__main__':
    # 确保数据库已初始化
    from backend.init_db import init_database
    init_database()

    # 运行用户系统迁移（幂等）
    from scripts.migrate_to_users import migrate
    migrate()

    print("=" * 50)
    print("🏋️ 减肥日志系统")
    print(f"📁 数据库: {DB_PATH}")
    print(f"🌐 访问: http://localhost:5000")
    print("=" * 50)

    # 使用 Waitress 生产级 WSGI 服务器
    from waitress import serve
    serve(app, listen='*:5000', threads=4)
