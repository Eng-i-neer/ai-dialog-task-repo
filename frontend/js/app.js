/**
 * 🏋️ 减肥日志系统 — SPA 路由 + 页面管理
 * Hash 路由 + 侧边栏渲染 + 骨架屏即时反馈
 * ★ V2: 集成登录页面 + Auth Guard
 */

// ═══ 页面注册表 ═══
const PAGES = {
  dashboard: { title: '📊 数据仪表盘', icon: '📊', text: '仪表盘', file: 'dashboard' },
  record: { title: '⚖️ 体重记录', icon: '⚖️', text: '体重记录', file: 'record' },
  meals: { title: '🍽️ 饮食记录', icon: '🍽️', text: '饮食记录', file: 'meals' },
  exercise: { title: '🏃 运动记录', icon: '🏃', text: '运动记录', file: 'exercise' },
  analysis: { title: '🤖 AI 分析', icon: '🤖', text: 'AI 分析', file: 'analysis' },
  settings: { title: '⚙️ 系统设置', icon: '⚙️', text: '系统设置', file: 'settings' },
};

// 当前页面 & 导航版本号（防竞态）
let currentPage = 'dashboard';
let _navVersion = 0;


/**
 * 初始化应用
 */
function initApp() {
  // ★ 加载用户选择的主题
  loadTheme();

  // ★ Auth Guard: 未登录 → 显示登录页
  if (!Auth.isLoggedIn()) {
    showLoginPage();
    return;
  }

  // 已登录 → 正常初始化
  showAppLayout();
  renderSidebar();
  updateTopbarDate();

  // 监听 hash 变化
  window.addEventListener('hashchange', () => {
    if (!Auth.isLoggedIn()) { showLoginPage(); return; }
    navigateTo(location.hash.slice(1) || 'dashboard');
  });

  // 首次导航
  const hash = location.hash.slice(1) || 'dashboard';
  if (location.hash !== '#' + hash) {
    location.hash = hash;
  }
  navigateTo(hash);

  // 每分钟更新顶部日期
  setInterval(updateTopbarDate, 60000);
}


// ═══ 登录页面 ═══

/**
 * 显示登录页面
 */
function showLoginPage() {
  document.querySelector('.app-layout').style.display = 'none';

  // 如果已有登录页，直接显示
  let loginWrap = document.getElementById('login-page');
  if (loginWrap) {
    loginWrap.style.display = 'flex';
    return;
  }

  loginWrap = document.createElement('div');
  loginWrap.id = 'login-page';
  loginWrap.className = 'login-page';
  loginWrap.innerHTML = `
    <div class="login-card">
      <div class="login-header">
        <div class="login-logo">🏋️</div>
        <h1 class="login-title">减肥日志</h1>
        <p class="login-subtitle">记录每一天，遇见更好的自己</p>
      </div>

      <div class="login-form">
        <div class="login-field">
          <label for="login-username">用户名</label>
          <input type="text" id="login-username" placeholder="请输入用户名" autocomplete="username">
        </div>
        <div class="login-field">
          <label for="login-password">密码</label>
          <input type="password" id="login-password" placeholder="请输入密码" autocomplete="current-password">
        </div>
        <div id="login-error" class="login-error"></div>
        <button class="login-btn" id="btn-login" onclick="handleLogin()">🔑 登 录</button>
      </div>

      <div class="login-footer">
        <span>💪 坚持就是胜利</span>
      </div>
    </div>
  `;

  document.body.appendChild(loginWrap);

  // Enter 键提交
  loginWrap.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // 自动聚焦（延迟避免移动端键盘弹出过早）
  setTimeout(() => {
    const el = document.getElementById('login-username');
    if (el && window.innerWidth > 768) el.focus();
  }, 300);
}


async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  if (!username || !password) {
    errorEl.textContent = '请输入用户名和密码';
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ 登录中...';
  errorEl.textContent = '';

  try {
    await Auth.doLogin(username, password);
    document.getElementById('login-page').style.display = 'none';
    document.querySelector('.app-layout').style.display = '';
    initApp();
  } catch (err) {
    errorEl.textContent = err.message || '登录失败';
  } finally {
    btn.disabled = false;
    btn.textContent = '🔑 登 录';
  }
}


/**
 * 退出登录
 */
window.handleLogout = function () {
  Auth.logout();
  // 隐藏主界面，显示登录页
  document.querySelector('.app-layout').style.display = 'none';
  const loginPage = document.getElementById('login-page');
  if (loginPage) {
    loginPage.remove();  // 删除旧的，重新生成
  }
  showLoginPage();
};


/**
 * 显示主布局（确保隐藏登录页）
 */
function showAppLayout() {
  const loginPage = document.getElementById('login-page');
  if (loginPage) loginPage.style.display = 'none';
  document.querySelector('.app-layout').style.display = '';
}


/**
 * 渲染侧边栏导航
 */
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  const user = Auth.getUser();
  const displayName = user?.nickname || user?.username || '';

  let html = '';
  const keys = Object.keys(PAGES);

  keys.forEach((key) => {
    const p = PAGES[key];
    if (key === 'settings') {
      html += '<div class="sidebar-divider"></div>';
    }
    html += `
      <div class="sidebar-item" data-page="${key}" onclick="navigateTo('${key}')">
        <span class="nav-icon">${p.icon}</span>
        <span class="nav-text">${p.text}</span>
      </div>
    `;
  });

  // 底部用户信息 + 退出（仅桌面端显示）
  html += `
    <div class="sidebar-divider"></div>
    <div class="sidebar-user">
      <span class="user-avatar">👤</span>
      <span class="user-name nav-text">${escapeHtml(displayName)}</span>
      <button class="btn-logout nav-text" onclick="handleLogout()" title="退出登录">🚪</button>
    </div>
  `;

  nav.innerHTML = html;
}


/**
 * 导航到指定页面
 * 版本号机制防竞态：渲染完成后检查版本号，若不一致则丢弃
 */
async function navigateTo(pageId) {
  if (!PAGES[pageId]) pageId = 'dashboard';

  currentPage = pageId;
  const myVersion = ++_navVersion;

  // 手机端导航时滚回顶部
  window.scrollTo(0, 0);

  // 更新 URL hash
  if (location.hash !== '#' + pageId) {
    location.hash = pageId;
  }

  // 更新侧边栏高亮
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageId);
  });

  // 更新顶部标题
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = PAGES[pageId].title;

  // 获取页面容器
  const container = document.getElementById('page-container');
  if (!container) return;

  // ★ 立即显示骨架屏（即时反馈）
  container.innerHTML = `
    <div class="page-view active">
      <div class="paper" style="padding:40px;">
        <div class="loading-skeleton">
          <div class="skeleton-bar" style="width:40%;height:28px;margin-bottom:24px;"></div>
          <div class="skeleton-bar" style="width:100%;height:16px;margin-bottom:12px;"></div>
          <div class="skeleton-bar" style="width:90%;height:16px;margin-bottom:12px;"></div>
          <div class="skeleton-bar" style="width:75%;height:16px;margin-bottom:24px;"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;">
            <div class="skeleton-bar" style="height:80px;"></div>
            <div class="skeleton-bar" style="height:80px;"></div>
            <div class="skeleton-bar" style="height:80px;"></div>
            <div class="skeleton-bar" style="height:80px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // 查找页面渲染函数 window.render_xxx
  const renderFn = `render_${pageId.replace(/-/g, '_')}`;

  if (typeof window[renderFn] === 'function') {
    const div = document.createElement('div');
    div.className = 'page-view active';
    div.id = `page-${pageId}`;
    container.innerHTML = '';
    container.appendChild(div);

    try {
      await window[renderFn](div);
    } catch (err) {
      // 仅当版本号匹配时才显示错误
      if (_navVersion === myVersion) {
        console.error(`Error rendering ${pageId}:`, err);
        div.innerHTML = `
          <div class="paper">
            <div class="empty-state">
              <div class="empty-icon">⚠️</div>
              <div class="empty-text">页面加载失败: ${escapeHtml(err.message || String(err))}</div>
            </div>
          </div>
        `;
      }
    }
  } else {
    container.innerHTML = `
      <div class="page-view active">
        <div class="paper">
          <div class="empty-state">
            <div class="empty-icon">🔧</div>
            <div class="empty-text">"${PAGES[pageId].text}" 页面开发中...</div>
          </div>
        </div>
      </div>
    `;
  }
}


/**
 * 更新顶部日期显示
 */
function updateTopbarDate() {
  const el = document.getElementById('topbar-date');
  if (!el) return;
  const d = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const w = weekdays[d.getDay()];
  el.textContent = `${y}年${m}月${day}日 周${w}`;
}


// DOM Ready → 初始化
document.addEventListener('DOMContentLoaded', initApp);
