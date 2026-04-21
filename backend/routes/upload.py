"""
文件上传 API — upload.py
- POST /api/upload/meal-photo  上传食物照片
- 静态服务由 app.py 提供 /uploads/<path>
"""

import os
import uuid
from datetime import datetime
from flask import Blueprint, jsonify, request
from backend.routes.auth import login_required

bp = Blueprint('upload', __name__)

# 上传根目录
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
UPLOAD_DIR = os.path.join(ROOT_DIR, 'backend', 'uploads', 'meals')

# 允许的图片格式
ALLOWED_EXT = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


def _allowed(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT


@bp.route('/api/upload/meal-photo', methods=['POST'])
@login_required
def upload_meal_photo():
    """接收食物照片，保存到 backend/uploads/meals/"""
    if 'photo' not in request.files:
        return jsonify({'error': '未找到上传文件（字段名: photo）'}), 400

    file = request.files['photo']
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400

    if not _allowed(file.filename):
        return jsonify({'error': f'不支持的文件格式，允许: {", ".join(ALLOWED_EXT)}'}), 400

    # 检查文件大小
    file.seek(0, 2)  # 移到末尾
    size = file.tell()
    file.seek(0)     # 回到开头
    if size > MAX_SIZE:
        return jsonify({'error': f'文件过大，最大 {MAX_SIZE // 1024 // 1024}MB'}), 400

    # 生成唯一文件名（日期前缀 + UUID）
    ext = file.filename.rsplit('.', 1)[1].lower()
    date_str = datetime.now().strftime('%Y%m%d')
    unique_name = f"{date_str}_{uuid.uuid4().hex[:8]}.{ext}"

    # 按日期分目录
    save_dir = os.path.join(UPLOAD_DIR, date_str)
    os.makedirs(save_dir, exist_ok=True)

    save_path = os.path.join(save_dir, unique_name)
    file.save(save_path)

    # 返回可访问的 URL 路径
    url_path = f"/uploads/meals/{date_str}/{unique_name}"

    return jsonify({
        'url': url_path,
        'filename': unique_name,
        'size': size,
    })
