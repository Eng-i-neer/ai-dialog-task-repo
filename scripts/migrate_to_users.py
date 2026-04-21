"""
减肥日志 — 数据库迁移脚本：添加用户系统
将单用户数据库升级为多用户，已有数据归入默认用户 admin
"""

import os
import sys
import shutil
import hashlib
import time

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT_DIR)

from backend.db import get_db, DB_PATH

SALT = "weight_tracker_2026"


def hash_password(password):
    return hashlib.sha256(f"{SALT}:{password}".encode()).hexdigest()


def migrate():
    print("=" * 50)
    print("🔄 数据库迁移：添加用户系统")
    print("=" * 50)

    # 1. 备份数据库
    backup_path = DB_PATH + f".backup_{int(time.time())}"
    if os.path.exists(DB_PATH):
        shutil.copy2(DB_PATH, backup_path)
        print(f"📦 已备份: {backup_path}")
    else:
        print("⚠️  数据库不存在，将创建新数据库")

    conn = get_db()
    cursor = conn.cursor()

    # 2. 创建 users 表
    print("\n[1/5] 创建 users 表...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    NOT NULL UNIQUE,
            password_hash TEXT    NOT NULL,
            nickname      TEXT,
            created_at    TEXT    DEFAULT (datetime('now','localtime')),
            last_login    TEXT
        )
    """)

    # 3. 创建 system_config 表（存 JWT 密钥等）
    print("[2/5] 创建 system_config 表...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_config (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    # 生成 JWT 密钥（如果不存在）
    cursor.execute("SELECT value FROM system_config WHERE key='jwt_secret'")
    if not cursor.fetchone():
        import secrets
        jwt_secret = secrets.token_hex(32)
        cursor.execute(
            "INSERT INTO system_config (key, value) VALUES ('jwt_secret', ?)",
            (jwt_secret,)
        )
        print("   ✅ 生成 JWT 密钥")

    # 4. 给数据表添加 user_id 列
    print("[3/5] 给数据表添加 user_id 列...")
    tables_to_migrate = [
        'weight_records',
        'meal_records',
        'exercise_records',
        'ai_analysis',
        'daily_summary',
    ]

    for table in tables_to_migrate:
        # 检查列是否已存在
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [col[1] for col in cursor.fetchall()]
        if 'user_id' not in columns:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER DEFAULT 1")
            print(f"   ✅ {table} +user_id")
        else:
            print(f"   ⏭️  {table} 已有 user_id")

    # 5. user_settings 表改造
    print("[4/5] 改造 user_settings 表...")
    cursor.execute("PRAGMA table_info(user_settings)")
    columns = [col[1] for col in cursor.fetchall()]

    if 'user_id' not in columns:
        # 方案：创建新表，迁移数据，删旧表，重命名
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_settings_new (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id         INTEGER NOT NULL DEFAULT 1,
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
                updated_at      TEXT    DEFAULT (datetime('now', 'localtime')),
                UNIQUE(user_id)
            )
        """)

        # 迁移已有数据
        cursor.execute("""
            INSERT OR IGNORE INTO user_settings_new
                (user_id, target_weight, height_cm, gender, birth_date,
                 activity_level, ai_api_key, ai_api_url, ai_model,
                 vision_api_key, vision_api_url, vision_model,
                 created_at, updated_at)
            SELECT 1, target_weight, height_cm, gender, birth_date,
                   activity_level, ai_api_key, ai_api_url, ai_model,
                   vision_api_key, vision_api_url, vision_model,
                   created_at, updated_at
            FROM user_settings
            WHERE id = 1
        """)

        cursor.execute("DROP TABLE user_settings")
        cursor.execute("ALTER TABLE user_settings_new RENAME TO user_settings")
        print("   ✅ user_settings 已改造为多用户")
    else:
        print("   ⏭️  user_settings 已有 user_id")

    # 6. 创建默认管理员用户（如果 id=1 不存在）
    print("[5/5] 创建默认用户...")
    cursor.execute("SELECT id FROM users WHERE id=1")
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO users (id, username, password_hash, nickname) VALUES (1, 'admin', ?, '管理员')",
            (hash_password('admin123'),)
        )
        # 确保 user_settings 有默认用户的设置行
        cursor.execute("""
            INSERT OR IGNORE INTO user_settings (user_id) VALUES (1)
        """)
        print("   ✅ 默认用户：admin / admin123")
    else:
        print("   ⏭️  默认用户已存在")

    # 7. 创建索引
    for table in tables_to_migrate:
        idx_name = f"idx_{table}_user_id"
        cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}(user_id)")

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")

    conn.commit()

    # 统计
    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM weight_records")
    weight_count = cursor.fetchone()[0]

    conn.close()

    print("\n" + "=" * 50)
    print("✅ 迁移完成！")
    print(f"   👤 用户数: {user_count}")
    print(f"   ⚖️  体重记录: {weight_count}")
    print(f"   🔑 默认账号: admin / admin123")
    print("=" * 50)


if __name__ == '__main__':
    migrate()
