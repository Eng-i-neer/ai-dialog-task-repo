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
 * 当前打开的日期选择器弹窗状态
 */
let _datePickerState = {
    isOpen: false,
    inputId: null,
    selectedDate: null,
    currentMonth: null,
    callback: null,
};

/**
 * 创建日期选择器 HTML（带前后箭头）
 * @param {string} id    - input 的 id
 * @param {string} value - 默认值 YYYY-MM-DD
 * @returns {string} HTML 字符串
 */
function createDatePicker(id, value) {
    return `
    <div class="date-picker">
      <button class="date-arrow" onclick="adjustDate('${id}', -1)" title="前一天">◀</button>
      <input type="text" id="${id}" value="${value}" 
             readonly
             onclick="openDatePickerModal('${id}')" 
             title="点击打开日期选择器"
             style="cursor: pointer; text-align: center; font-weight: 600;">
      <button class="date-arrow" onclick="adjustDate('${id}', 1)" title="后一天">▶</button>
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

/**
 * 格式化日期显示为更友好的格式
 * @param {string} dateStr - YYYY-MM-DD 格式
 * @returns {string} 格式化后的日期字符串
 */
function formatDateDisplay(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    
    if (dateOnly.getTime() === todayOnly.getTime()) {
        return `今天 (${dateStr})`;
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
        return `昨天 (${dateStr})`;
    } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
        return `明天 (${dateStr})`;
    } else {
        return `${weekday} ${dateStr}`;
    }
}

/**
 * 打开日期选择弹窗
 * @param {string} inputId - 目标 input 的 id
 * @param {Function} callback - 选择日期后的回调函数（可选）
 */
window.openDatePickerModal = function (inputId, callback) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const currentValue = input.value || today();
    const selectedDate = new Date(currentValue);
    const currentMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

    _datePickerState = {
        isOpen: true,
        inputId: inputId,
        selectedDate: new Date(selectedDate),
        currentMonth: new Date(currentMonth),
        callback: callback || null,
    };

    _renderDatePickerModal();
};

/**
 * 关闭日期选择弹窗
 */
window.closeDatePickerModal = function () {
    const overlay = document.getElementById('date-picker-overlay');
    if (overlay) {
        overlay.remove();
    }
    _datePickerState.isOpen = false;
    _datePickerState.inputId = null;
    _datePickerState.callback = null;
};

/**
 * 渲染日期选择弹窗
 */
function _renderDatePickerModal() {
    const { currentMonth, selectedDate } = _datePickerState;

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayDate = new Date();
    const todayStr = todayDate.toISOString().slice(0, 10);
    const selectedStr = selectedDate.toISOString().slice(0, 10);

    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
        '七月', '八月', '九月', '十月', '十一月', '十二月'];

    let daysHtml = '';

    const startPadding = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < startPadding; i++) {
        const day = daysInPrevMonth - startPadding + i + 1;
        daysHtml += `<div class="date-picker-day other-month" 
                        onclick="selectDate(${year}, ${month}, ${day}, -1)">${day}</div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isSelected = dateStr === selectedStr;
        const isToday = dateStr === todayStr;
        const classes = ['date-picker-day'];
        if (isSelected) classes.push('selected');
        if (isToday) classes.push('today');

        daysHtml += `<div class="${classes.join(' ')}" 
                        onclick="selectDate(${year}, ${month}, ${day}, 0)"
                        data-date="${dateStr}">${day}</div>`;
    }

    const totalCells = startPadding + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) {
        daysHtml += `<div class="date-picker-day other-month"
                        onclick="selectDate(${year}, ${month + 1}, ${i}, 1)">${i}</div>`;
    }

    const overlay = document.getElementById('date-picker-overlay');
    if (overlay) {
        overlay.remove();
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'date-picker-overlay';
    modalOverlay.className = 'date-picker-overlay';
    modalOverlay.innerHTML = `
    <div class="date-picker-modal" onclick="event.stopPropagation()">
      <div class="date-picker-header">
        <div class="date-picker-title">${year}年 ${monthNames[month]}</div>
        <div class="date-picker-nav">
          <button class="date-picker-nav-btn" onclick="navigateMonth(-1)" title="上一月">◀</button>
          <button class="date-picker-nav-btn" onclick="navigateMonth(1)" title="下一月">▶</button>
        </div>
      </div>
      
      <div class="date-picker-calendar">
        <div class="date-picker-weekdays">
          <div class="date-picker-weekday">一</div>
          <div class="date-picker-weekday">二</div>
          <div class="date-picker-weekday">三</div>
          <div class="date-picker-weekday">四</div>
          <div class="date-picker-weekday">五</div>
          <div class="date-picker-weekday">六</div>
          <div class="date-picker-weekday">日</div>
        </div>
        <div class="date-picker-days">
          ${daysHtml}
        </div>
      </div>
      
      <div class="date-picker-quick">
        <button class="date-picker-quick-btn" onclick="selectToday()">今天</button>
        <button class="date-picker-quick-btn" onclick="selectRelativeDay(-1)">昨天</button>
        <button class="date-picker-quick-btn" onclick="selectRelativeDay(-7)">上周今天</button>
        <button class="date-picker-quick-btn" onclick="selectRelativeDay(1)">明天</button>
      </div>
      
      <div class="date-picker-input-section">
        <label class="date-picker-input-label">输入日期（格式：YYYY-MM-DD 或 YYYY/MM/DD）</label>
        <div class="date-picker-input-row">
          <input type="text" class="date-picker-input" id="date-picker-text-input" 
                 placeholder="例如：2026-04-22 或 2026/04/22"
                 value="${selectedStr}"
                 onkeydown="handleDateInputKeydown(event)">
          <button class="btn btn-primary" onclick="confirmTextInput()">确定</button>
        </div>
      </div>
      
      <div class="date-picker-actions">
        <button class="btn" onclick="closeDatePickerModal()">取消</button>
        <button class="btn btn-primary" onclick="confirmDateSelection()">确定</button>
      </div>
    </div>
  `;

    document.body.appendChild(modalOverlay);

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeDatePickerModal();
        }
    });

    setTimeout(() => {
        const textInput = document.getElementById('date-picker-text-input');
        if (textInput) {
            textInput.focus();
            textInput.select();
        }
    }, 50);
}

/**
 * 切换月份
 */
window.navigateMonth = function (delta) {
    _datePickerState.currentMonth.setMonth(_datePickerState.currentMonth.getMonth() + delta);
    _renderDatePickerModal();
};

/**
 * 选择日期（从日历点击）
 */
window.selectDate = function (year, month, day, monthDelta) {
    const newDate = new Date(year, month + monthDelta, day);
    _datePickerState.selectedDate = newDate;
    _datePickerState.currentMonth = new Date(newDate.getFullYear(), newDate.getMonth(), 1);

    const input = document.getElementById('date-picker-text-input');
    if (input) {
        input.value = newDate.toISOString().slice(0, 10);
    }

    _renderDatePickerModal();
};

/**
 * 选择今天
 */
window.selectToday = function () {
    const todayDate = new Date();
    _datePickerState.selectedDate = new Date(todayDate);
    _datePickerState.currentMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    _renderDatePickerModal();
};

/**
 * 选择相对日期
 */
window.selectRelativeDay = function (delta) {
    const date = new Date();
    date.setDate(date.getDate() + delta);
    _datePickerState.selectedDate = new Date(date);
    _datePickerState.currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    _renderDatePickerModal();
};

/**
 * 处理文本输入的键盘事件
 */
window.handleDateInputKeydown = function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        confirmTextInput();
    } else if (event.key === 'Escape') {
        closeDatePickerModal();
    }
};

/**
 * 确认文本输入的日期
 */
window.confirmTextInput = function () {
    const input = document.getElementById('date-picker-text-input');
    if (!input) return;

    const value = input.value.trim();
    if (!value) {
        showToast('请输入日期', 'warning');
        return;
    }

    const parsed = parseDateInput(value);
    if (!parsed) {
        showToast('日期格式无效，请使用 YYYY-MM-DD 或 YYYY/MM/DD 格式', 'warning');
        input.focus();
        input.select();
        return;
    }

    _datePickerState.selectedDate = new Date(parsed);
    _datePickerState.currentMonth = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    _renderDatePickerModal();
};

/**
 * 解析日期输入
 * 支持多种格式：YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD, MM/DD, DD
 */
function parseDateInput(value) {
    const trimmed = value.trim();

    const dashMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dashMatch) {
        const year = parseInt(dashMatch[1]);
        const month = parseInt(dashMatch[2]) - 1;
        const day = parseInt(dashMatch[3]);
        const date = new Date(year, month, day);
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
            return date;
        }
    }

    const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (slashMatch) {
        const year = parseInt(slashMatch[1]);
        const month = parseInt(slashMatch[2]) - 1;
        const day = parseInt(slashMatch[3]);
        const date = new Date(year, month, day);
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
            return date;
        }
    }

    const plainMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (plainMatch) {
        const year = parseInt(plainMatch[1]);
        const month = parseInt(plainMatch[2]) - 1;
        const day = parseInt(plainMatch[3]);
        const date = new Date(year, month, day);
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
            return date;
        }
    }

    const shortSlashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (shortSlashMatch) {
        const now = new Date();
        const month = parseInt(shortSlashMatch[1]) - 1;
        const day = parseInt(shortSlashMatch[2]);
        let year = now.getFullYear();

        let date = new Date(year, month, day);
        if (date > now) {
            year -= 1;
            date = new Date(year, month, day);
        }

        if (date.getMonth() === month && date.getDate() === day) {
            return date;
        }
    }

    const dayMatch = trimmed.match(/^(\d{1,2})$/);
    if (dayMatch) {
        const now = new Date();
        const day = parseInt(dayMatch[1]);
        let month = now.getMonth();
        let year = now.getFullYear();

        let date = new Date(year, month, day);
        if (date > now) {
            month -= 1;
            if (month < 0) {
                month = 11;
                year -= 1;
            }
            date = new Date(year, month, day);
        }

        if (date.getDate() === day) {
            return date;
        }
    }

    return null;
}

/**
 * 确认日期选择并应用
 */
window.confirmDateSelection = function () {
    const { inputId, selectedDate, callback } = _datePickerState;

    const dateStr = selectedDate.toISOString().slice(0, 10);

    const input = document.getElementById(inputId);
    if (input) {
        input.value = dateStr;
        input.dispatchEvent(new Event('change'));
    }

    if (callback) {
        callback(dateStr);
    }

    closeDatePickerModal();
};


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


// ═══ AI 分析后台任务管理 ═══

/**
 * AI 分析任务状态管理器
 * 支持后台运行，页面切换/退出后仍可继续获取结果
 */

// 存储 key
const AI_TASK_KEY = 'ai_analysis_task';
const AI_TASK_HISTORY_KEY = 'ai_analysis_history';

// 轮询间隔（毫秒）
const POLL_INTERVAL = 2000;
// 最大轮询次数（约 2 分钟）
const MAX_POLL_COUNT = 60;

// 当前轮询状态
let _pollingState = {
    isPolling: false,
    pollCount: 0,
    intervalId: null,
    displayIntervalId: null,
    taskDate: null,
    taskStartTime: null,
    onProgress: null,
    onComplete: null,
    onError: null,
};

/**
 * 获取当前进行中的分析任务
 */
function getOngoingAiTask() {
    try {
        const saved = localStorage.getItem(AI_TASK_KEY);
        if (saved) {
            const task = JSON.parse(saved);
            if (task.status === 'running' || task.status === 'triggered') {
                return task;
            }
        }
    } catch (e) {
        console.error('Failed to get AI task:', e);
    }
    return null;
}

/**
 * 保存分析任务状态
 */
function saveAiTask(task) {
    try {
        localStorage.setItem(AI_TASK_KEY, JSON.stringify(task));
    } catch (e) {
        console.error('Failed to save AI task:', e);
    }
}

/**
 * 清除分析任务状态
 */
function clearAiTask() {
    try {
        localStorage.removeItem(AI_TASK_KEY);
    } catch (e) {
        console.error('Failed to clear AI task:', e);
    }
}

/**
 * 触发 AI 分析（后台模式）
 * @param {string} date - 分析日期 YYYY-MM-DD
 * @returns {Promise<Object>} 任务状态
 */
window.triggerAiAnalysis = async function (date) {
    const task = {
        id: `task_${Date.now()}`,
        date: date,
        status: 'triggered',
        startTime: Date.now(),
        lastPollTime: null,
        error: null,
    };

    saveAiTask(task);

    try {
        const controller = new AbortController();
        const signal = controller.signal;

        const timeoutId = setTimeout(() => {
            console.log('AI analysis request will continue in background');
        }, 5000);

        const result = await API.post('/ai/analyze', { date });

        clearTimeout(timeoutId);

        if (result && !result.error) {
            task.status = 'completed';
            task.completedTime = Date.now();
            task.result = result;
            saveAiTask(task);
            return { success: true, task, result };
        } else {
            task.status = 'polling';
            task.error = result?.error || 'Request may be running, will poll for result';
            saveAiTask(task);
            return { success: false, task, needPoll: true };
        }

    } catch (err) {
        console.log('AI analysis triggered, will poll for result:', err.message);
        task.status = 'polling';
        task.error = err.message;
        saveAiTask(task);
        return { success: false, task, needPoll: true };
    }
};

/**
 * 开始轮询获取分析结果
 * @param {string} date - 分析日期
 * @param {Object} callbacks - 回调函数
 */
window.startAiPolling = function (date, callbacks = {}) {
    if (_pollingState.isPolling) {
        console.log('Polling already in progress');
        return;
    }

    const task = getOngoingAiTask();
    if (!task) {
        console.log('No ongoing AI task found');
        return;
    }

    if (task.date !== date) {
        console.log(`Task date mismatch: task=${task.date}, requested=${date}`);
        return;
    }

    _pollingState = {
        isPolling: true,
        pollCount: 0,
        intervalId: null,
        displayIntervalId: null,
        taskDate: date,
        taskStartTime: task.startTime,
        onProgress: callbacks.onProgress || null,
        onComplete: callbacks.onComplete || null,
        onError: callbacks.onError || null,
    };

    const initialElapsed = Math.floor((Date.now() - task.startTime) / 1000);
    console.log(`Starting AI polling for date: ${date}, initial elapsed: ${initialElapsed}s`);

    if (_pollingState.onProgress) {
        _pollingState.onProgress({
            status: 'polling',
            pollCount: 0,
            elapsed: initialElapsed,
            message: `AI 正在分析中... 已等待 ${initialElapsed} 秒`,
        });
    }

    function updateDisplayTime() {
        if (!_pollingState.isPolling) return;
        
        const elapsed = Math.floor((Date.now() - _pollingState.taskStartTime) / 1000);
        if (_pollingState.onProgress) {
            _pollingState.onProgress({
                status: 'polling',
                pollCount: _pollingState.pollCount,
                elapsed: elapsed,
                message: `AI 正在分析中... 已等待 ${elapsed} 秒`,
            });
        }
    }

    _pollingState.displayIntervalId = setInterval(updateDisplayTime, 1000);

    _pollingState.intervalId = setInterval(async () => {
        if (!_pollingState.isPolling) {
            if (_pollingState.intervalId) {
                clearInterval(_pollingState.intervalId);
                _pollingState.intervalId = null;
            }
            return;
        }

        _pollingState.pollCount++;
        const elapsed = Math.floor((Date.now() - _pollingState.taskStartTime) / 1000);

        console.log(`Polling attempt ${_pollingState.pollCount}, elapsed: ${elapsed}s`);

        if (_pollingState.pollCount > MAX_POLL_COUNT) {
            console.log('Max poll count reached, stopping');
            stopAiPolling();
            if (_pollingState.onError) {
                _pollingState.onError({
                    error: '分析超时',
                    message: 'AI 分析超时，请稍后重试或检查历史记录',
                });
            }
            return;
        }

        try {
            const history = await API.get(`/ai/history?date=${_pollingState.taskDate}`);
            
            if (history && history.length > 0) {
                const latest = history[0];
                const task = getOngoingAiTask();
                
                if (task) {
                    const taskTime = new Date(task.startTime);
                    const latestTime = latest.created_at ? new Date(latest.created_at) : null;
                    
                    if (latestTime && latestTime > taskTime) {
                        console.log('Found new analysis result!');
                        
                        task.status = 'completed';
                        task.completedTime = Date.now();
                        task.result = latest;
                        saveAiTask(task);
                        
                        stopAiPolling();
                        
                        if (_pollingState.onComplete) {
                            _pollingState.onComplete({
                                status: 'completed',
                                result: latest,
                                elapsed: elapsed,
                            });
                        }
                        return;
                    }
                }
            }

        } catch (err) {
            console.error('Polling error:', err);
        }
    }, POLL_INTERVAL);
};

/**
 * 停止轮询
 */
window.stopAiPolling = function () {
    _pollingState.isPolling = false;
    if (_pollingState.intervalId) {
        clearInterval(_pollingState.intervalId);
        _pollingState.intervalId = null;
    }
    if (_pollingState.displayIntervalId) {
        clearInterval(_pollingState.displayIntervalId);
        _pollingState.displayIntervalId = null;
    }
    console.log('AI polling stopped');
};

/**
 * 检查是否有进行中的分析任务
 * @param {string} date - 要检查的日期
 * @returns {Object|null} 任务信息
 */
window.checkOngoingAiTask = function (date) {
    const task = getOngoingAiTask();
    if (!task) return null;
    
    if (task.date !== date) return null;
    
    const elapsed = Math.floor((Date.now() - task.startTime) / 1000);
    
    return {
        task,
        elapsed,
        isRunning: task.status === 'running' || task.status === 'polling' || task.status === 'triggered',
    };
};

/**
 * 获取分析任务的显示状态文本
 */
function getAiTaskDisplayInfo(task) {
    const elapsed = Math.floor((Date.now() - task.startTime) / 1000);
    
    if (task.status === 'triggered') {
        return {
            text: '🚀 分析已触发',
            subtext: `正在连接 AI 服务...`,
            class: 'info',
        };
    } else if (task.status === 'polling') {
        return {
            text: '🧠 AI 正在分析中',
            subtext: `已等待 ${elapsed} 秒，通常需要 10-30 秒`,
            class: 'warning',
        };
    } else if (task.status === 'completed') {
        return {
            text: '✅ 分析完成',
            subtext: `用时 ${elapsed} 秒`,
            class: 'success',
        };
    } else {
        return {
            text: '⏳ 处理中',
            subtext: `已等待 ${elapsed} 秒`,
            class: 'neutral',
        };
    }
}
