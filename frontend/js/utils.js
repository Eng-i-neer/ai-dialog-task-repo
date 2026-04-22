/**
 * 🏋️ 减肥日志系统 — 工具函数库
 * 包含日期、格式化、动画、弹窗、主题切换等可复用工具
 */

// ═══ 主题管理 ═══

const THEMES = {
    notebook: { name: '📓 手帐记事本', className: '' },
    zen: { name: '🌿 禅意自然', className: 'theme-zen' },
    ios: { name: '🍎 iOS 极简', className: 'theme-ios' },
};

/** 加载用户保存的主题（启动时调用） */
function loadTheme() {
    const saved = localStorage.getItem('theme') || 'notebook';
    applyTheme(saved);
}

/** 切换到指定主题 */
function applyTheme(themeId) {
    // 清除所有主题类
    Object.values(THEMES).forEach(t => {
        if (t.className) document.documentElement.classList.remove(t.className);
    });
    // 应用新主题
    const theme = THEMES[themeId];
    if (theme && theme.className) {
        document.documentElement.classList.add(theme.className);
    }
    localStorage.setItem('theme', themeId);
}

/** 获取当前主题 ID */
function getCurrentTheme() {
    return localStorage.getItem('theme') || 'notebook';
}

// ═══ 日期与时间 ═══

/** 获取今天日期 YYYY-MM-DD（本地时间） */
function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 获取当前时间 HH:MM */
function now() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}


// ═══ 格式化 ═══

/** 格式化体重（保留1位小数 + "kg"） */
function formatWeight(n) {
    if (n == null || isNaN(n)) return '--';
    return Number(n).toFixed(1) + ' kg';
}

/** 格式化热量（带 "kcal"） */
function formatCalories(n) {
    if (n == null || isNaN(n)) return '0 kcal';
    return Math.round(Number(n)).toLocaleString('zh-CN') + ' kcal';
}

/** 格式化体重变化（带+-号和颜色提示） */
function formatWeightChange(n) {
    if (n == null || isNaN(n)) return '--';
    const val = Number(n);
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)} kg`;
}


// ═══ 数字跳动动画 ═══

/**
 * 数字跳动动画（easeOutExpo 曲线）
 * @param {HTMLElement} el     - 目标元素
 * @param {number}      target - 目标数值
 * @param {number}      duration - 动画时长（ms）
 * @param {function}    format - 格式化函数，如 formatWeight
 */
function animateNumber(el, target, duration = 800, format = null) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        if (!el || !el.parentNode) return;    // 元素已从 DOM 移除则停止
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        let current;
        if (progress >= 1) {
            current = target;
        } else {
            // easeOutExpo
            const eased = 1 - Math.pow(2, -10 * progress);
            current = start + (target - start) * eased;
        }

        el.textContent = format ? format(current) : current.toFixed(1);

        if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}


// ═══ Toast 通知 ═══

/**
 * Toast 通知
 * @param {string} message  - 消息内容
 * @param {string} type     - 类型：success / warning / error / info
 * @param {number} duration - 显示时长（ms）
 */
function showToast(message, type = 'success', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
    toast.textContent = `${icons[type] || ''} ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(80px)';
        toast.style.transition = '0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}


// ═══ 自定义确认弹窗 ═══

/**
 * 自定义确认弹窗（Promise，匹配手帐风格）
 * @param {string} message - 确认提示文案
 * @returns {Promise<boolean>}
 */
function showConfirm(message) {
    return new Promise(resolve => {
        const old = document.getElementById('custom-confirm-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'custom-confirm-overlay';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
      <div class="modal" style="min-width:360px; max-width:460px; padding:28px 32px;">
        <div style="text-align:center; margin-bottom:16px;">
          <div style="font-size:2.5rem; margin-bottom:8px;">⚠️</div>
          <div style="font-size:1.1rem; color:var(--ink-primary); line-height:1.6; white-space:pre-line;">${escapeHtml(message)}</div>
        </div>
        <div style="display:flex; gap:16px; margin-top:24px; padding-top:16px; border-top:2px dashed var(--grid-line);">
          <button class="btn" id="confirm-cancel-btn" style="flex:1; justify-content:center; border-radius:8px;">取消</button>
          <button class="btn btn-danger" id="confirm-ok-btn" style="flex:1; justify-content:center; border-radius:8px;">确定</button>
        </div>
      </div>
    `;
        document.body.appendChild(overlay);

        document.getElementById('confirm-ok-btn').onclick = () => {
            overlay.remove();
            resolve(true);
        };
        document.getElementById('confirm-cancel-btn').onclick = () => {
            overlay.remove();
            resolve(false);
        };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                resolve(false);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        document.getElementById('confirm-ok-btn').focus();
    });
}


// ═══ 日期选择器 ═══

/**
 * 创建日期选择器 HTML（带前后箭头）
 * @param {string} id    - input 的 id
 * @param {string} value - 默认值 YYYY-MM-DD
 * @returns {string} HTML 字符串
 */
function createDatePicker(id, value) {
    return `
    <div class="date-picker">
      <button class="arrow" onclick="adjustDate('${id}', -1)" title="前一天">◀</button>
      <input type="date" id="${id}" value="${value}">
      <button class="arrow" onclick="adjustDate('${id}', 1)" title="后一天">▶</button>
    </div>
  `;
}

/** 调整日期（前后一天） */
function adjustDate(inputId, delta) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const d = new Date(input.value);
    d.setDate(d.getDate() + delta);
    input.value = d.toISOString().slice(0, 10);
    input.dispatchEvent(new Event('change'));
}


// ═══ 安全工具 ═══

/** XSS 防护 — HTML 转义 */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// ═══ 骨架屏 ═══

/**
 * 生成骨架屏 HTML（即时反馈）
 * @param {number} bars - 骨架条数量
 * @returns {string} HTML
 */
function skeletonHTML(bars = 3) {
    let html = '<div class="loading-skeleton" style="padding:32px;">';
    const widths = ['80%', '60%', '90%', '45%', '70%'];
    for (let i = 0; i < bars; i++) {
        html += `<div class="skeleton-bar" style="width:${widths[i % widths.length]}"></div>`;
    }
    html += '</div>';
    return html;
}
