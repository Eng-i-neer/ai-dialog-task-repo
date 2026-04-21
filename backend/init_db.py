"""
减肥日志系统 — 数据库初始化脚本
创建 6 张表 + 索引 + 默认设置行
运行方式：python backend/init_db.py
"""

import os
import sys

# 把项目根目录加入路径
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, ROOT_DIR)

from backend.db import get_db


def init_database():
    """创建所有表和索引"""
    conn = get_db()
    cursor = conn.cursor()

    # ═══ 表 1：weight_records — 体重记录（核心表） ═══
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS weight_records (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            weight          REAL    NOT NULL,
            recorded_at     TEXT    NOT NULL,
            date            TEXT    NOT NULL,
            time_of_day     TEXT    NOT NULL,
            note            TEXT,
            created_at      TEXT    DEFAULT (datetime('now', 'localtime'))
        )
    """)

    # ═══ 表 2：meal_records — 饮食记录 ═══
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS meal_records (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            date                TEXT    NOT NULL,
            meal_type           TEXT    NOT NULL,
            description         TEXT    NOT NULL,
            calories            INTEGER,
            photo_path          TEXT,
            ai_calorie_estimate INTEGER,
            ai_analysis_json    TEXT,
            recorded_at         TEXT    NOT NULL,
            created_at          TEXT    DEFAULT (datetime('now', 'localtime'))
        )
    """)

    # ═══ 表 3：exercise_records — 运动记录 ═══
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exercise_records (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            date                TEXT    NOT NULL,
            exercise_type       TEXT    NOT NULL,
            duration_minutes    INTEGER,
            calories_burned     INTEGER,
            intensity           TEXT    DEFAULT 'medium',
            note                TEXT,
            recorded_at         TEXT    NOT NULL,
            created_at          TEXT    DEFAULT (datetime('now', 'localtime'))
        )
    """)

    # ═══ 表 4：ai_analysis — AI 分析报告（一天可多条） ═══
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ai_analysis (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            date                TEXT    NOT NULL,
            analysis_text       TEXT    NOT NULL,
            weight_status       TEXT,
            diet_advice         TEXT,
            exercise_advice     TEXT,
            predicted_loss      REAL,
            predicted_morning   REAL,
            model_used          TEXT,
            tokens_used         INTEGER,
            created_at          TEXT    DEFAULT (datetime('now', 'localtime'))
        )
    """)

    # ═══ 表 5：daily_summary — 每日汇总（聚合缓存） ═══
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_summary (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            date                TEXT    NOT NULL,
            morning_weight      REAL,
            lowest_weight       REAL,
            highest_weight      REAL,
            avg_weight          REAL,
            weight_count        INTEGER DEFAULT 0,
            total_calories_in   INTEGER,
            total_calories_out  INTEGER,
            weight_change       REAL,
            updated_at          TEXT    DEFAULT (datetime('now', 'localtime')),
            user_id             INTEGER DEFAULT 1,
            UNIQUE(date, user_id)
        )
    """)

    # ═══ 表 6：user_settings — 用户设置（单行表） ═══
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_settings (
            id              INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
            target_weight   REAL,
            height_cm       REAL,
            gender          TEXT    DEFAULT 'male',
            birth_date      TEXT,
            activity_level  TEXT    DEFAULT 'moderate',
            ai_api_key      TEXT,
            ai_api_url      TEXT,
            ai_model        TEXT    DEFAULT 'deepseek-chat',
            vision_api_key  TEXT,
            vision_api_url  TEXT,
            vision_model    TEXT    DEFAULT 'doubao-vision',
            created_at      TEXT    DEFAULT (datetime('now', 'localtime')),
            updated_at      TEXT    DEFAULT (datetime('now', 'localtime'))
        )
    """)

    # ═══ 索引 ═══
    # weight_records 索引
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_weight_date ON weight_records(date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_weight_date_time ON weight_records(date, time_of_day)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_weight_recorded_at ON weight_records(recorded_at)")

    # meal_records 索引
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_meal_date ON meal_records(date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_meal_date_type ON meal_records(date, meal_type)")

    # exercise_records 索引
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_exercise_date ON exercise_records(date)")

    # ai_analysis 索引（非 UNIQUE，一天可多条）
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_analysis_date ON ai_analysis(date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_analysis_created ON ai_analysis(created_at)")

    # daily_summary 索引（UNIQUE 已在表定义中）

    # ═══ 插入默认设置 ═══
    cursor.execute("""
        INSERT OR IGNORE INTO user_settings (id) VALUES (1)
    """)

    conn.commit()
    conn.close()

    print("✅ 数据库初始化完成！")
    print(f"   共创建 6 张表 + 9 个索引")
    print(f"   已插入默认设置行")


if __name__ == '__main__':
    init_database()
