/**
 * 🏋️ 运动记录页 — exercise.js
 * 月历视图 + FAB "+" 按钮弹出表单 + 运动类型可选
 */

const EXERCISE_TYPES = [
  { value: '跑步', icon: '🏃' },
  { value: '快走', icon: '🚶' },
  { value: '骑行', icon: '🚴' },
  { value: '游泳', icon: '🏊' },
  { value: '力量训练', icon: '🏋️' },
  { value: '瑜伽', icon: '🧘' },
  { value: '跳绳', icon: '⏭️' },
  { value: '健身操', icon: '💃' },
  { value: '爬山', icon: '🧗' },
  { value: '篮球', icon: '🏀' },
  { value: '羽毛球', icon: '🏸' },
  { value: '其他', icon: '🏅' },
];

const INTENSITY_LABELS = {
  light: '🟢 轻度',
  moderate: '🟡 中等',
  high: '🔴 高强度',
};

/* ── 页面状态 ── */
let _exSelectedDate = today();
let _exCalendarYear = 0;
let _exCalendarMonth = 0;  // 0-based
let _exMonthSummary = {};  // { '2026-03-01': { count, totalMin, totalCal } }

/* ══════════════════════════════
   主渲染函数
   ══════════════════════════════ */
window.render_exercise = async function (container) {
  const d = new Date();
  _exCalendarYear = d.getFullYear();
  _exCalendarMonth = d.getMonth();
  _exSelectedDate = today();

  container.innerHTML = `
    <!-- ═══ 月历卡片 ═══ -->
    <div class="paper">
      <div class="cal-header">
        <button class="cal-arrow" id="cal-prev" title="上个月">◀</button>
        <h2 class="cal-title" id="cal-title"></h2>
        <button class="cal-arrow" id="cal-next" title="下个月">▶</button>
      </div>
      <div class="cal-weekdays">
        <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
      </div>
      <div class="cal-grid" id="cal-grid"></div>
      <div class="cal-legend">
        <span class="cal-legend-item"><span class="cal-legend-box cal-legend-box--checked"></span>已打卡</span>
        <span class="cal-legend-item"><span class="cal-legend-box cal-legend-box--today"></span>今天</span>
      </div>
    </div>

    <!-- ═══ 当日运动记录 ═══ -->
    <div class="paper">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="margin:0;" id="day-exercise-title">📋 今日运动</h3>
      </div>
      <div id="today-exercises">${skeletonHTML(3)}</div>
    </div>

    <!-- ═══ FAB "+" 按钮 ═══ -->
    <button class="fab-add" id="fab-add-exercise" title="记录运动" onclick="openExerciseModal()">
      <span class="fab-icon">＋</span>
    </button>
  `;

  // 绑定月历导航
  document.getElementById('cal-prev').addEventListener('click', () => {
    _exCalendarMonth--;
    if (_exCalendarMonth < 0) { _exCalendarMonth = 11; _exCalendarYear--; }
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    _exCalendarMonth++;
    if (_exCalendarMonth > 11) { _exCalendarMonth = 0; _exCalendarYear++; }
    renderCalendar();
  });

  await renderCalendar();
  await loadTodayExercises(_exSelectedDate);
};


/* ══════════════════════════════
   月历渲染
   ══════════════════════════════ */
async function renderCalendar() {
  const titleEl = document.getElementById('cal-title');
  const gridEl = document.getElementById('cal-grid');
  if (!titleEl || !gridEl) return;

  const year = _exCalendarYear;
  const month = _exCalendarMonth;
  titleEl.textContent = `${year} 年 ${month + 1} 月`;

  // 获取当月摘要
  await loadMonthSummary(year, month + 1);

  const firstDay = new Date(year, month, 1).getDay(); // 周几开始
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = today();

  let html = '';

  // 空白填充
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-cell cal-cell--empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const summary = _exMonthSummary[dateStr];
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === _exSelectedDate;
    const hasExercise = summary && summary.totalMin > 0;

    const classes = [
      'cal-cell',
      isToday ? 'cal-cell--today' : '',
      isSelected ? 'cal-cell--selected' : '',
      hasExercise ? 'cal-cell--checked' : '',
    ].filter(Boolean).join(' ');

    html += `
      <div class="${classes}" data-date="${dateStr}" onclick="selectCalendarDate('${dateStr}')">
        <span class="cal-day">${d}</span>
        ${hasExercise ? `<span class="cal-cell-min">${summary.totalMin}′</span>` : ''}
      </div>
    `;
  }

  gridEl.innerHTML = html;
}


/* ── 加载当月汇总 ── */
async function loadMonthSummary(year, month) {
  try {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const data = await API.get(`/exercise/month-summary?month=${monthStr}`);
    _exMonthSummary = {};
    if (Array.isArray(data)) {
      data.forEach(r => {
        _exMonthSummary[r.date] = {
          count: r.count,
          totalMin: r.total_minutes,
          totalCal: r.total_calories,
        };
      });
    }
  } catch (err) {
    console.warn('Failed to load month summary:', err);
    _exMonthSummary = {};
  }
}


/* ── 选择日期 ── */
window.selectCalendarDate = function (dateStr) {
  _exSelectedDate = dateStr;
  // 更新高亮
  document.querySelectorAll('.cal-cell--selected').forEach(el => el.classList.remove('cal-cell--selected'));
  const cell = document.querySelector(`.cal-cell[data-date="${dateStr}"]`);
  if (cell) cell.classList.add('cal-cell--selected');
  // 更新标题
  const titleEl = document.getElementById('day-exercise-title');
  if (titleEl) {
    const isToday = dateStr === today();
    titleEl.textContent = isToday ? '📋 今日运动' : `📋 ${dateStr} 运动`;
  }
  loadTodayExercises(dateStr);
};


/* ══════════════════════════════
   弹窗表单（+ 按钮）
   ══════════════════════════════ */
window.openExerciseModal = function () {
  // 移除已有弹窗
  const old = document.getElementById('exercise-modal-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'exercise-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal exercise-modal" id="exercise-modal">
      <div class="modal-title">🏃 记录运动</div>

      <!-- 日期 -->
      <div class="form-group">
        <label class="label">📅 日期</label>
        <input class="input input-boxed" type="date" id="ex-modal-date" value="${_exSelectedDate}">
      </div>

      <!-- 运动类型 — 下拉选择 -->
      <div class="form-group">
        <label class="label">🏅 运动类型</label>
        <select class="input input-boxed ex-select" id="ex-modal-type">
          ${EXERCISE_TYPES.map(e => `<option value="${e.value}">${e.icon} ${e.value}</option>`).join('')}
        </select>
        <input class="input input-boxed" type="text" id="ex-modal-custom-type"
               placeholder="或输入自定义类型..." style="margin-top:8px;">
      </div>

      <!-- 时长 + 强度 (横排) -->
      <div class="ex-modal-row">
        <div class="form-group" style="flex:1;">
          <label class="label">⏱️ 时长（分钟）</label>
          <input class="input input-boxed" type="number" id="ex-modal-duration"
                 placeholder="30" min="1" step="1">
        </div>
        <div class="form-group" style="flex:1;">
          <label class="label">🔥 热量（kcal）</label>
          <input class="input input-boxed" type="number" id="ex-modal-calories"
                 placeholder="选填" min="0" step="10">
        </div>
      </div>

      <!-- 强度 -->
      <div class="form-group">
        <label class="label">💪 强度</label>
        <div class="ex-intensity-group" id="ex-modal-intensity-group">
          <button class="ex-int-btn" data-value="light" onclick="selectModalIntensity(this)">🟢 轻度</button>
          <button class="ex-int-btn active" data-value="moderate" onclick="selectModalIntensity(this)">🟡 中等</button>
          <button class="ex-int-btn" data-value="high" onclick="selectModalIntensity(this)">🔴 高强度</button>
        </div>
      </div>

      <!-- 备注 -->
      <div class="form-group">
        <label class="label">📝 备注（可选）</label>
        <input class="input input-boxed" type="text" id="ex-modal-note"
               placeholder="例：操场5圈、游泳1000m...">
      </div>

      <!-- 操作按钮 -->
      <div class="modal-footer">
        <button class="btn" id="ex-modal-cancel" onclick="closeExerciseModal()">取消</button>
        <button class="btn btn-primary btn-lg" id="ex-modal-submit" onclick="submitExerciseFromModal()">
          🏃 记录运动
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeExerciseModal();
  });
  // ESC 关闭
  const escHandler = (e) => {
    if (e.key === 'Escape') { closeExerciseModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  // 自动聚焦到时长输入
  setTimeout(() => {
    const el = document.getElementById('ex-modal-duration');
    if (el && window.innerWidth > 768) el.focus();
  }, 200);
};


window.closeExerciseModal = function () {
  const overlay = document.getElementById('exercise-modal-overlay');
  if (overlay) overlay.remove();
};


window.selectModalIntensity = function (btn) {
  document.querySelectorAll('#ex-modal-intensity-group .ex-int-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};


/* ── 提交运动记录 ── */
window.submitExerciseFromModal = async function () {
  const customType = document.getElementById('ex-modal-custom-type').value.trim();
  const selectType = document.getElementById('ex-modal-type').value;
  const exerciseType = customType || selectType;

  const duration = parseInt(document.getElementById('ex-modal-duration').value);
  if (!duration || duration <= 0) {
    showToast('请输入运动时长', 'warning');
    document.getElementById('ex-modal-duration').focus();
    return;
  }

  const calories = parseFloat(document.getElementById('ex-modal-calories').value) || null;
  const intensityBtn = document.querySelector('#ex-modal-intensity-group .ex-int-btn.active');
  const intensity = intensityBtn ? intensityBtn.dataset.value : 'moderate';
  const note = document.getElementById('ex-modal-note').value.trim();
  const date = document.getElementById('ex-modal-date').value;
  const recorded_at = `${date} ${new Date().toTimeString().slice(0, 8)}`;

  const submitBtn = document.getElementById('ex-modal-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ 提交中...';

  try {
    await API.post('/exercise', {
      date, exercise_type: exerciseType, duration_minutes: duration,
      calories_burned: calories, intensity, note, recorded_at,
    });
    showToast(`✅ 已记录 ${exerciseType} ${duration}分钟`, 'success');
    closeExerciseModal();

    // 刷新当日列表 + 月历
    _exSelectedDate = date;
    const titleEl = document.getElementById('day-exercise-title');
    if (titleEl) {
      const isToday = date === today();
      titleEl.textContent = isToday ? '📋 今日运动' : `📋 ${date} 运动`;
    }

    // 如果日期在当前月就重新加载日历
    const dateParts = date.split('-');
    if (parseInt(dateParts[0]) === _exCalendarYear && parseInt(dateParts[1]) - 1 === _exCalendarMonth) {
      await renderCalendar();
    }
    await loadTodayExercises(date);
  } catch (err) {
    showToast(err.message || '记录失败', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '🏃 记录运动';
  }
};


/* ══════════════════════════════
   加载当日运动列表
   ══════════════════════════════ */
async function loadTodayExercises(date) {
  const div = document.getElementById('today-exercises');
  if (!div) return;

  try {
    const records = await API.get(`/exercise?date=${date}`);
    if (!records || records.length === 0) {
      div.innerHTML = `<div class="empty-state"><div class="empty-icon">🏃</div><div class="empty-text">还没有运动记录，点击右下角 ＋ 开始记录！</div></div>`;
      return;
    }

    const totalCal = records.reduce((s, r) => s + (r.calories_burned || 0), 0);
    const totalMin = records.reduce((s, r) => s + (r.duration_minutes || 0), 0);

    let html = `
      <div class="ex-day-stats">
        <div class="ex-stat-chip ex-stat-chip--time">
          <span class="ex-stat-label">总时长</span>
          <span class="ex-stat-value">${totalMin} <small>分钟</small></span>
        </div>
        <div class="ex-stat-chip ex-stat-chip--cal">
          <span class="ex-stat-label">总消耗</span>
          <span class="ex-stat-value">${totalCal} <small>kcal</small></span>
        </div>
      </div>
      <div class="timeline">
    `;

    records.forEach(r => {
      const time = r.recorded_at ? r.recorded_at.slice(11, 16) : '--:--';
      const intLabel = INTENSITY_LABELS[r.intensity] || '🟡 中等';
      const calText = r.calories_burned ? ` · ${r.calories_burned} kcal` : '';
      const noteHtml = r.note ? `<div class="timeline-note">${escapeHtml(r.note)}</div>` : '';

      html += `
        <div class="timeline-item">
          <div class="timeline-actions">
            <button class="delete" onclick="deleteExercise(${r.id}, '${date}')" title="删除">🗑️</button>
          </div>
          <div class="timeline-time">${time}</div>
          <div>
            <span class="timeline-weight" style="font-size:1.1rem;">${escapeHtml(r.exercise_type)}</span>
            <span class="timeline-tag">${r.duration_minutes}分钟 · ${intLabel}${calText}</span>
          </div>
          ${noteHtml}
        </div>
      `;
    });
    html += '</div>';
    div.innerHTML = html;
  } catch (err) {
    div.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">加载失败</div></div>`;
  }
}


/* ── 删除运动记录 ── */
window.deleteExercise = async function (id, date) {
  const confirmed = await showConfirm('确定删除这条运动记录？');
  if (!confirmed) return;
  try {
    await API.delete(`/exercise/${id}`);
    showToast('已删除', 'info');
    await loadTodayExercises(date);
    // 刷新日历
    const dateParts = date.split('-');
    if (parseInt(dateParts[0]) === _exCalendarYear && parseInt(dateParts[1]) - 1 === _exCalendarMonth) {
      await renderCalendar();
    }
  } catch (err) {
    showToast('删除失败', 'error');
  }
};
