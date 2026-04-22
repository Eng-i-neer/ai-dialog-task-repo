/**
 * 🏋️ 设置页 — settings.js
 * 基本信息 + AI 文本模型配置 + AI 多模态模型配置
 */

window.render_settings = async function (container) {
  // 加载当前设置
  let settings = {};
  try {
    settings = await API.get('/settings');
  } catch (err) {
    showToast('加载设置失败', 'error');
  }

  container.innerHTML = `
    <!-- 主题选择 -->
    <div class="paper">
      <h3 style="margin-bottom:16px;">🎨 界面风格</h3>
      <div class="theme-picker" id="theme-picker">
        <div class="theme-card ${getCurrentTheme() === 'notebook' ? 'active' : ''}"
             data-theme="notebook" onclick="switchTheme('notebook')">
          <div class="theme-card-preview theme-preview--notebook">📓</div>
          <div class="theme-card-name">手帐记事本</div>
          <div class="theme-card-desc">方格纸 · 手绘圆角 · 活力薄荷绿</div>
        </div>
        <div class="theme-card ${getCurrentTheme() === 'zen' ? 'active' : ''}"
             data-theme="zen" onclick="switchTheme('zen')">
          <div class="theme-card-preview theme-preview--zen">🌿</div>
          <div class="theme-card-name">禅意自然</div>
          <div class="theme-card-desc">鹅卵石圆角 · 大地苔藓色 · 慢节奏动效</div>
        </div>
        <div class="theme-card ${getCurrentTheme() === 'ios' ? 'active' : ''}"
             data-theme="ios" onclick="switchTheme('ios')">
          <div class="theme-card-preview theme-preview--ios">🍎</div>
          <div class="theme-card-name">iOS 极简</div>
          <div class="theme-card-desc">系统蓝 · 柔和阴影 · 快速平滑动效</div>
        </div>
      </div>
    </div>

    <!-- 基本信息 -->
    <div class="paper">
      <h3 style="margin-bottom:20px;">👤 基本信息</h3>
      <div class="form-row">
        <div class="form-group">
          <label class="label">目标体重（kg）</label>
          <input class="input input-boxed" type="number" id="set-target-weight"
                 value="${settings.target_weight || ''}" step="0.1" min="30" max="200"
                 placeholder="例：65.0">
        </div>
        <div class="form-group">
          <label class="label">身高（cm）</label>
          <input class="input input-boxed" type="number" id="set-height"
                 value="${settings.height_cm || ''}" step="0.1" min="100" max="250"
                 placeholder="例：175">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">性别</label>
          <select class="input input-boxed" id="set-gender">
            <option value="male" ${settings.gender === 'male' ? 'selected' : ''}>男</option>
            <option value="female" ${settings.gender === 'female' ? 'selected' : ''}>女</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">出生日期</label>
          <input class="input input-boxed" type="date" id="set-birth-date"
                 value="${settings.birth_date || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="label">活动水平</label>
        <select class="input input-boxed" id="set-activity" style="max-width:400px;">
          <option value="sedentary" ${settings.activity_level === 'sedentary' ? 'selected' : ''}>久坐（几乎不运动）</option>
          <option value="light" ${settings.activity_level === 'light' ? 'selected' : ''}>轻度（每周1-3次）</option>
          <option value="moderate" ${settings.activity_level === 'moderate' ? 'selected' : ''}>中等（每周3-5次）</option>
          <option value="active" ${settings.activity_level === 'active' ? 'selected' : ''}>活跃（每周6-7次）</option>
          <option value="very_active" ${settings.activity_level === 'very_active' ? 'selected' : ''}>非常活跃（高强度训练）</option>
        </select>
      </div>
    </div>

    <!-- AI 配置 -->
    <div class="paper">
      <h3 style="margin-bottom:8px;">🤖 AI 智能分析配置</h3>
      <p style="font-size:0.8rem; color:var(--ink-tertiary); margin-bottom:16px; line-height:1.5;">
        使用<strong>豆包（火山方舟）</strong>API 提供 AI 分析和食物图片识别。<br>
        📝 文本分析模型：doubao-seed-1-8 &nbsp;|&nbsp; 📸 图片识别模型：doubao-seed-2-0-lite<br>
        🔗 <a href="https://console.volcengine.com/ark" target="_blank" style="color:var(--color-accent);">获取 API Key →</a>
      </p>
      <div class="form-group">
        <label class="label">API Key（文本分析 + 图片识别共用）</label>
        <input class="input input-boxed" type="password" id="set-ai-key"
               value="${settings.ai_api_key || ''}" placeholder="请输入火山方舟 API Key">
      </div>
    </div>

    <!-- 保存按钮 -->
    <div style="text-align:center; margin-top:8px;">
      <button class="btn btn-primary btn-lg" id="save-settings-btn" onclick="saveSettings()">
        💾 保存设置
      </button>
    </div>

    <!-- 账号管理 -->
    <div class="paper" style="margin-top:24px;">
      <h3 style="margin-bottom:20px;">🔐 账号管理</h3>
      <div id="account-info"></div>
      <div class="form-row" style="margin-top:16px;">
        <div class="form-group">
          <label class="label">原密码</label>
          <input class="input input-boxed" type="password" id="set-old-password" placeholder="当前密码">
        </div>
        <div class="form-group">
          <label class="label">新密码</label>
          <input class="input input-boxed" type="password" id="set-new-password" placeholder="至少6位">
        </div>
      </div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:12px;">
        <button class="btn" onclick="changePassword()">🔑 修改密码</button>
        <button class="btn" style="background:var(--color-danger); color:#fff; border-color:var(--color-danger);" onclick="handleLogout()">🚪 退出登录</button>
      </div>
    </div>

    <!-- 用户管理（仅管理员可见，渲染后动态插入） -->
    <div id="admin-panel"></div>
  `;

  // 渲染账号信息
  const user = Auth.getUser();
  const infoEl = document.getElementById('account-info');
  if (user && infoEl) {
    infoEl.innerHTML = `
      <div style="display:flex; gap:16px; flex-wrap:wrap; font-size:0.9rem; color:var(--ink-secondary);">
        <span>👤 用户名：<strong>${escapeHtml(user.username)}</strong></span>
        <span>📛 昵称：<strong>${escapeHtml(user.nickname || '-')}</strong></span>
      </div>
    `;
  }

  // 管理员专属：用户管理面板
  if (user && user.username === 'lyt') {
    renderAdminPanel();
  }
};


/** 渲染管理员用户管理面板 */
async function renderAdminPanel() {
  const panel = document.getElementById('admin-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="paper" style="margin-top:24px;">
      <h3 style="margin-bottom:20px;">👑 用户管理 <span style="font-size:0.75rem;font-weight:normal;color:var(--ink-tertiary);">（仅管理员可见）</span></h3>

      <!-- 新增用户表单 -->
      <div style="background:var(--bg-rule,rgba(0,0,0,0.03));border-radius:8px;padding:16px;margin-bottom:20px;">
        <h4 style="margin:0 0 14px;font-size:0.95rem;">➕ 新增用户</h4>
        <div class="form-row">
          <div class="form-group">
            <label class="label">用户名</label>
            <input class="input input-boxed" type="text" id="new-user-username" placeholder="至少2个字符">
          </div>
          <div class="form-group">
            <label class="label">昵称（选填）</label>
            <input class="input input-boxed" type="text" id="new-user-nickname" placeholder="默认同用户名">
          </div>
          <div class="form-group">
            <label class="label">密码</label>
            <input class="input input-boxed" type="password" id="new-user-password" placeholder="至少6位">
          </div>
        </div>
        <button class="btn btn-primary" style="margin-top:4px;" onclick="adminCreateUser()">✅ 创建用户</button>
      </div>

      <!-- 用户列表 -->
      <h4 style="margin:0 0 12px;font-size:0.95rem;">👥 当前用户</h4>
      <div id="admin-user-list">
        <div style="color:var(--ink-tertiary);font-size:0.85rem;">加载中...</div>
      </div>
    </div>
  `;

  loadAdminUserList();
}


/** 加载用户列表 */
async function loadAdminUserList() {
  const listEl = document.getElementById('admin-user-list');
  if (!listEl) return;

  try {
    const users = await API.get('/admin/users');
    if (!users.length) {
      listEl.innerHTML = '<div style="color:var(--ink-tertiary);font-size:0.85rem;">暂无用户</div>';
      return;
    }

    listEl.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
        <thead>
          <tr style="border-bottom:2px solid var(--border-color,#e0e0e0);text-align:left;">
            <th style="padding:6px 8px;color:var(--ink-secondary);">ID</th>
            <th style="padding:6px 8px;color:var(--ink-secondary);">用户名</th>
            <th style="padding:6px 8px;color:var(--ink-secondary);">昵称</th>
            <th style="padding:6px 8px;color:var(--ink-secondary);">创建时间</th>
            <th style="padding:6px 8px;color:var(--ink-secondary);">最后登录</th>
            <th style="padding:6px 8px;"></th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr style="border-bottom:1px solid var(--border-color,#eee);">
              <td style="padding:8px;">${u.id}</td>
              <td style="padding:8px;"><strong>${escapeHtml(u.username)}</strong>${u.id === 1 ? ' 👑' : ''}</td>
              <td style="padding:8px;">${escapeHtml(u.nickname || '-')}</td>
              <td style="padding:8px;color:var(--ink-tertiary);">${u.created_at ? u.created_at.slice(0, 10) : '-'}</td>
              <td style="padding:8px;color:var(--ink-tertiary);">${u.last_login ? u.last_login.slice(0, 10) : '从未'}</td>
              <td style="padding:8px;">
                ${u.id !== 1 ? `<button class="btn btn-sm"
                  style="background:var(--color-danger,#e74c3c);color:#fff;border-color:var(--color-danger,#e74c3c);padding:3px 10px;font-size:0.8rem;"
                  onclick="adminDeleteUser(${u.id}, '${escapeHtml(u.username)}')">删除</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    listEl.innerHTML = `<div style="color:var(--color-danger);">加载失败：${err.message || ''}</div>`;
  }
}


/** 新增用户 */
window.adminCreateUser = async function () {
  const username = (document.getElementById('new-user-username').value || '').trim();
  const nickname = (document.getElementById('new-user-nickname').value || '').trim();
  const password = document.getElementById('new-user-password').value || '';

  if (!username || username.length < 2) { showToast('用户名至少2个字符', 'warning'); return; }
  if (!password || password.length < 6) { showToast('密码至少6位', 'warning'); return; }

  try {
    const res = await API.post('/admin/users', { username, nickname, password });
    showToast(`✅ 用户「${res.user.username}」创建成功`, 'success');
    document.getElementById('new-user-username').value = '';
    document.getElementById('new-user-nickname').value = '';
    document.getElementById('new-user-password').value = '';
    loadAdminUserList();
  } catch (err) {
    showToast(err.message || '创建失败', 'error');
  }
};


/** 删除用户 */
window.adminDeleteUser = async function (userId, username) {
  const confirmed = await showConfirm(
    `确认删除用户「${username}」吗？\n\n该用户的所有体重、饮食、运动数据将一并删除，不可恢复。`
  );
  if (!confirmed) return;

  try {
    await API.delete(`/admin/users/${userId}`);
    showToast(`已删除用户「${username}」`, 'success');
    loadAdminUserList();
  } catch (err) {
    showToast(err.message || '删除失败', 'error');
  }
};


/** 切换主题 */
window.switchTheme = function (themeId) {
  applyTheme(themeId);
  // 更新卡片高亮
  document.querySelectorAll('#theme-picker .theme-card').forEach(card => {
    card.classList.toggle('active', card.dataset.theme === themeId);
  });
  showToast(`🎨 已切换为「${THEMES[themeId].name}」`, 'success');
};


window.saveSettings = async function () {
  const btn = document.getElementById('save-settings-btn');
  btn.disabled = true;
  btn.textContent = '⏳ 保存中...';

  const data = {
    target_weight: parseFloat(document.getElementById('set-target-weight').value) || null,
    height_cm: parseFloat(document.getElementById('set-height').value) || null,
    gender: document.getElementById('set-gender').value,
    birth_date: document.getElementById('set-birth-date').value || null,
    activity_level: document.getElementById('set-activity').value,
    ai_api_key: document.getElementById('set-ai-key').value.trim() || null,
  };

  try {
    await API.put('/settings', data);
    showToast('✅ 设置已保存', 'success');
  } catch (err) {
    showToast('保存失败: ' + (err.message || ''), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 保存设置';
  }
};


window.changePassword = async function () {
  const oldPwd = document.getElementById('set-old-password').value;
  const newPwd = document.getElementById('set-new-password').value;

  if (!oldPwd) { showToast('请输入原密码', 'warning'); return; }
  if (!newPwd || newPwd.length < 6) { showToast('新密码至少6位', 'warning'); return; }

  try {
    await API.put('/auth/password', {
      old_password: oldPwd,
      new_password: newPwd,
    });
    showToast('✅ 密码修改成功', 'success');
    document.getElementById('set-old-password').value = '';
    document.getElementById('set-new-password').value = '';
  } catch (err) {
    showToast(err.message || '修改失败', 'error');
  }
};
