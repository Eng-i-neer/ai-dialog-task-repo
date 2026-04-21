"""
减肥日志系统 — 数据库连接工具
提供获取数据库连接的统一方法，含 SQLite 性能优化 PRAGMA
"""

import sqlite3
import os

# 数据库路径：项目根目录/backend/data/weight_tracker.db
DB_PATH = os.path.join(
    os.path.dirname(__file__),
    'data', 'weight_tracker.db'
)


def get_db():
    """获取数据库连接（返回字典格式的行，含性能优化）"""
    # 确保 data 目录存在
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    conn = sqlite3.connect(DB_PATH, timeout=30)  # 30秒等待锁释放
    conn.row_factory = sqlite3.Row  # 让查询结果可以用列名访问
    conn.execute("PRAGMA foreign_keys = ON")  # 启用外键约束
    # ★ 性能优化 PRAGMAs（SQLite 黄金配置）
    conn.execute("PRAGMA journal_mode = WAL")       # WAL 模式：读写并发
    conn.execute("PRAGMA synchronous = NORMAL")     # 安全且快速
    conn.execute("PRAGMA cache_size = -8000")       # 8MB 缓存（负数=KB）
    conn.execute("PRAGMA mmap_size = 33554432")     # 32MB 内存映射
    conn.execute("PRAGMA temp_store = MEMORY")      # 临时表存内存
    return conn


def dict_row(row):
    """将 sqlite3.Row 转为普通 dict"""
    if row is None:
        return None
    return dict(row)


def dict_rows(rows):
    """将 sqlite3.Row 列表转为 dict 列表"""
    return [dict(row) for row in rows]
