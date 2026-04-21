/**
 * 🏋️ 减肥日志系统 — API 请求封装
 * 提供统一的 fetch 请求方法，支持 JSON 和文件上传
 * ★ V2: 集成 Token 认证管理
 */

const API_BASE = '/api';

// ═══ Token 管理 ═══

const Auth = {
  /** 保存登录信息 */
  login(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  },

  /** 退出登录 */
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  /** 获取 token */
  getToken() {
    return localStorage.getItem('token');
  },

  /** 获取当前用户信息 */
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch { return null; }
  },

  /** 是否已登录 */
  isLoggedIn() {
    return !!this.getToken();
  },

  /** 登录 API */
  async doLogin(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (!res.ok) throw { status: res.status, message: json.error || '登录失败' };
    this.login(json);
    return json;
  },

  /** 注册 API */
  async doRegister(username, password, nickname) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, nickname }),
    });
    const json = await res.json();
    if (!res.ok) throw { status: res.status, message: json.error || '注册失败' };
    this.login(json);
    return json;
  },
};


// ═══ API 请求（自动附带 Token） ═══

/**
 * 通用 API 请求
 */
async function api(method, path, data = null) {
  const headers = { 'Content-Type': 'application/json' };

  // 自动附带 Token
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (data) opts.body = JSON.stringify(data);

  try {
    const res = await fetch(`${API_BASE}${path}`, opts);
    const json = await res.json();
    if (!res.ok) {
      // 401 → token 失效，跳转登录
      if (res.status === 401) {
        Auth.logout();
        showLoginPage();
        throw { status: 401, message: '登录已过期，请重新登录' };
      }
      throw {
        status: res.status,
        message: json.error || json.message || '请求失败',
        data: json,
      };
    }
    return json;
  } catch (err) {
    if (err.status) throw err;
    console.error('Network error:', err);
    throw { status: 0, message: '网络连接失败，请检查服务是否运行' };
  }
}

/**
 * 文件上传专用（multipart/form-data）
 */
async function apiUpload(path, formData) {
  const headers = {};
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        Auth.logout();
        showLoginPage();
        throw { status: 401, message: '登录已过期' };
      }
      throw {
        status: res.status,
        message: json.error || json.message || '上传失败',
        data: json,
      };
    }
    return json;
  } catch (err) {
    if (err.status) throw err;
    console.error('Upload error:', err);
    throw { status: 0, message: '上传失败，请检查网络连接' };
  }
}

// ═══ 便捷方法 ═══
const API = {
  get: (path) => api('GET', path),
  post: (path, data) => api('POST', path, data),
  put: (path, data) => api('PUT', path, data),
  delete: (path) => api('DELETE', path),
  upload: (path, formData) => apiUpload(path, formData),
};
