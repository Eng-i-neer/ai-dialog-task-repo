"""
多模态 AI 视觉分析 — ai_vision.py
- POST /api/ai/vision/analyze  上传食物图片 → 多模态 AI 识别食物并估算热量

使用模型：doubao-1.5-vision-pro（豆包视觉理解模型）
API 兼容 OpenAI 格式，通过 image_url + base64 传入图片
"""

import os
import base64
import requests as http_requests
from flask import Blueprint, jsonify, request, g
from backend.db import get_db, dict_row
from backend.routes.auth import login_required

bp = Blueprint('ai_vision', __name__)

# 上传根目录
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

# 视觉分析专用 Prompt
VISION_SYSTEM_PROMPT = """你是一个专业的营养分析师，拥有丰富的食物热量评估经验。
用户会发一张食物/饮品的照片，可能还会附带文字描述。你需要：

1. **识别食物**：如果用户提供了文字描述（如"无骨鱼片"、"鸡胸肉"），必须以用户描述为准，图片作为辅助参考。用户比 AI 更清楚自己吃的是什么！
2. **估算份量**：如果用户提供了重量信息（如"约0.3kg"），直接使用用户给的数据。否则根据图片中的容器大小等线索估算。
3. **计算热量**：给出每种食物的估算热量（kcal），以及总热量

## 回复格式（严格遵守）
请用以下 JSON 格式返回（不要加 ```json 标记，直接输出 JSON）：
{
  "foods": [
    {"name": "食物名称", "portion": "估算份量", "calories": 数字}
  ],
  "total_calories": 总热量数字,
  "description": "一句话描述这张图片的食物内容",
  "confidence": "high/medium/low",
  "advice": "一句简短的营养建议"
}

## 重要注意事项
- **用户的文字描述优先级高于图片识别**。如果用户说"这是鱼片汤"，即使图片看起来像大酱汤，也要按鱼片汤来分析
- 如果图片不是食物，返回 {"error": "图片中未识别到食物"}
- 热量单位统一为 kcal
- 份量要具体（如"约200g"、"1碗约300ml"）
- 如果不确定，给出合理范围的中间值"""


def _get_vision_settings(conn):
    """获取多模态 AI 设置（URL 和模型名固定，只读 API Key）"""
    uid = getattr(g, 'user_id', 1)
    row = conn.execute("SELECT * FROM user_settings WHERE user_id=?", (uid,)).fetchone()
    if not row:
        return {}
    settings = dict_row(row)
    return {
        'api_key': settings.get('ai_api_key'),
        'api_url': 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        'model': 'doubao-seed-2-0-lite-260215',
    }


def _image_to_base64(image_path):
    """将本地图片转为 base64 data URL"""
    ext = image_path.rsplit('.', 1)[-1].lower()
    mime_map = {'jpg': 'jpeg', 'jpeg': 'jpeg', 'png': 'png', 'gif': 'gif', 'webp': 'webp'}
    mime = mime_map.get(ext, 'jpeg')

    with open(image_path, 'rb') as f:
        data = base64.b64encode(f.read()).decode('utf-8')

    return f"data:image/{mime};base64,{data}"


def _call_vision_api(settings, image_base64, user_text="请分析这张食物图片的内容和热量"):
    """调用多模态视觉 API（OpenAI 兼容格式）"""
    api_key = settings.get('api_key')
    api_url = settings.get('api_url')
    model = settings.get('model')

    if not api_key:
        raise ValueError('请先在设置页配置 AI API Key（视觉模型共用文本模型的 Key）')

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }

    # OpenAI 兼容的多模态消息格式
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': VISION_SYSTEM_PROMPT},
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'image_url',
                        'image_url': {
                            'url': image_base64,
                        }
                    },
                    {
                        'type': 'text',
                        'text': user_text,
                    }
                ]
            }
        ],
        'temperature': 0.3,
        'max_tokens': 1000,
    }

    resp = http_requests.post(api_url, json=payload, headers=headers, timeout=60)

    if resp.status_code != 200:
        error_msg = resp.text[:300]
        raise RuntimeError(f'Vision API 返回 {resp.status_code}: {error_msg}')

    result = resp.json()
    content = result['choices'][0]['message']['content']
    tokens = result.get('usage', {}).get('total_tokens', 0)

    return content, model, tokens


def _parse_ai_response(content):
    """尝试从 AI 回复中解析 JSON"""
    import json

    # 去掉可能的 markdown 代码块标记
    text = content.strip()
    if text.startswith('```'):
        # 去掉首行和末行
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1]) if len(lines) > 2 else text

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # 尝试提取 JSON 部分
        start = text.find('{')
        end = text.rfind('}')
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end+1])
            except json.JSONDecodeError:
                pass

    # 解析失败，返回原始文本
    return {
        'description': content,
        'total_calories': None,
        'foods': [],
        'parse_error': True,
    }


# ═══ 路由 ═══

@bp.route('/api/ai/vision/analyze', methods=['POST'])
@login_required
def vision_analyze():
    """
    上传食物图片并分析
    支持两种方式：
    1. multipart/form-data — photo 文件 + 可选 text 字段
    2. JSON — image_url 字段（已上传图片的 URL 路径）
    """
    conn = get_db()
    vision_settings = _get_vision_settings(conn)
    conn.close()

    image_base64 = None
    user_text = "请分析这张食物图片的内容和热量"

    if request.content_type and 'multipart' in request.content_type:
        # 方式1：直接上传图片
        if 'photo' not in request.files:
            return jsonify({'error': '未找到图片文件（字段名: photo）'}), 400

        file = request.files['photo']
        if file.filename == '':
            return jsonify({'error': '未选择文件'}), 400

        # 读取文件转 base64
        data = base64.b64encode(file.read()).decode('utf-8')
        ext = file.filename.rsplit('.', 1)[-1].lower()
        mime_map = {'jpg': 'jpeg', 'jpeg': 'jpeg', 'png': 'png', 'gif': 'gif', 'webp': 'webp'}
        mime = mime_map.get(ext, 'jpeg')
        image_base64 = f"data:image/{mime};base64,{data}"

        user_text = request.form.get('text', user_text)

    else:
        # 方式2：JSON，传已上传图片的路径
        json_data = request.get_json() or {}
        image_url = json_data.get('image_url', '')
        user_text = json_data.get('text', user_text)

        if not image_url:
            return jsonify({'error': '请提供 image_url 或上传 photo 文件'}), 400

        # 本地路径：读取文件转 base64
        local_path = os.path.join(ROOT_DIR, image_url.lstrip('/'))
        if not os.path.exists(local_path):
            return jsonify({'error': f'图片文件不存在: {image_url}'}), 404

        image_base64 = _image_to_base64(local_path)

    try:
        content, model_used, tokens_used = _call_vision_api(
            vision_settings, image_base64, user_text
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    # 解析 AI 回复
    parsed = _parse_ai_response(content)

    return jsonify({
        'raw_response': content,
        'parsed': parsed,
        'model_used': model_used,
        'tokens_used': tokens_used,
    })
