/**
 * 🏋️ 体重录入页 — record.js
 * 体重输入 + 时段快选 + 备注 + 今日记录时间线
 */

// 时段选项
const TIME_OF_DAY_OPTIONS = [
    { value: 'morning', label: '☀️ 晨起' },
    { value: 'pre_lunch', label: '🍽️ 午饭前' },
    { value: 'post_lunch', label: '🍚 午饭后' },
    { value: 'pre_dinner', label: '🌆 晚饭前' },
    { value: 'post_dinner', label: '🌙 晚饭后' },
    { value: 'bedtime', label: '😴 睡前' },
    { value: 'pre_toilet', label: '🚻 厕所前' },
    { value: 'post_toilet', label: '✨ 厕所后' },
    { value: 'post_exercise', label: '🏃 运动后' },
    { value: 'other', label: '📝 其他' },
];

// 时段值 → 显示标签的快速映射
const TIME_LABEL_MAP = {};
TIME_OF_DAY_OPTIONS.forEach(o => TIME_LABEL_MAP[o.value] = o.label);

/**
 * 渲染体重录入页
 */
window.render_record = async function (container) {
    // 当前选中的日期
    let selectedDate = today();

    container.innerHTML = `
    <div class="paper">
      <!-- 日期选择 -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2 style="margin:0; border:none; padding:0;">⚖️ 记录体重</h2>
        <div class="date-picker">
          <button class="date-arrow" onclick="adjustDate('record-date', -1)">◀</button>
          <input type="text" id="record-date" value="${selectedDate}" 
                 readonly
                 onclick="openDatePickerModal('record-date')"
                 title="点击打开日期选择器"
                 style="cursor: pointer; text-align: center; font-weight: 600;">
          <button class="date-arrow" onclick="adjustDate('record-date', 1)">▶</button>
        </div>
      </div>

      <!-- 体重输入 -->
      <div class="weight-input-wrap">
        <input type="number" id="weight-input" placeholder="0.0" step="0.1" min="0" max="300">
        <span class="weight-unit">kg</span>
      </div>

      <!-- 时段快选 -->
      <div class="form-group">
        <label class="label" style="text-align:center;">选择时段</label>
        <div class="time-picker-group" id="time-picker-group">
          ${TIME_OF_DAY_OPTIONS.map(o => `
            <button class="time-picker-btn${o.value === 'morning' ? ' active' : ''}"
                    data-value="${o.value}"
                    onclick="selectTimeOfDay(this)">
              ${o.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- 备注 -->
      <div class="form-group" style="max-width:500px; margin:0 auto 20px;">
        <label class="label">备注（可选）</label>
        <input class="input input-boxed" type="text" id="weight-note" placeholder="例：空腹、饭后、运动后...">
      </div>

      <!-- 提交按钮 -->
      <div style="text-align:center; margin-bottom:8px;">
        <button class="btn btn-primary btn-lg" id="submit-weight-btn" onclick="submitWeight()">
          📝 记录体重
        </button>
      </div>
    </div>

    <!-- 今日已记录 -->
    <div class="paper">
      <h3 style="margin-bottom:16px;">📋 今日记录</h3>
      <div id="today-records">
        ${skeletonHTML(3)}
      </div>
    </div>
  `;

    // 日期变化时重新加载记录
    document.getElementById('record-date').addEventListener('change', () => {
        selectedDate = document.getElementById('record-date').value;
        loadTodayRecords(selectedDate);
    });

    // 自动聚焦到体重输入框
    document.getElementById('weight-input').focus();

    // 加载今日记录
    await loadTodayRecords(selectedDate);
};


/**
 * 选择时段按钮
 */
window.selectTimeOfDay = function (btn) {
    document.querySelectorAll('#time-picker-group .time-picker-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};


/**
 * 提交体重记录
 */
window.submitWeight = async function () {
    const weightInput = document.getElementById('weight-input');
    const weight = parseFloat(weightInput.value);

    if (isNaN(weight) || weight <= 0) {
        showToast('请输入有效的体重数值', 'warning');
        weightInput.focus();
        return;
    }

    const activeBtn = document.querySelector('#time-picker-group .time-picker-btn.active');
    const timeOfDay = activeBtn ? activeBtn.dataset.value : 'other';
    const note = document.getElementById('weight-note').value.trim();
    const date = document.getElementById('record-date').value;

    // 构建 recorded_at（使用选中日期 + 当前时间）
    const recorded_at = `${date} ${new Date().toTimeString().slice(0, 8)}`;

    const submitBtn = document.getElementById('submit-weight-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ 提交中...';

    try {
        await API.post('/weight', {
            weight,
            time_of_day: timeOfDay,
            note,
            recorded_at,
        });

        showToast(`✅ 已记录 ${weight} kg`, 'success');

        // 清空输入，保留时段选择
        weightInput.value = '';
        document.getElementById('weight-note').value = '';
        weightInput.focus();

        // 刷新今日记录
        await loadTodayRecords(date);

    } catch (err) {
        showToast(err.message || '记录失败', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '📝 记录体重';
    }
};


/**
 * 加载某天的体重记录并渲染时间线
 */
async function loadTodayRecords(date) {
    const recordsDiv = document.getElementById('today-records');
    if (!recordsDiv) return;

    try {
        const records = await API.get(`/weight?date=${date}`);

        if (!records || records.length === 0) {
            recordsDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-text">今天还没有记录，快来记录第一笔吧！</div>
        </div>
      `;
            return;
        }

        // 顶部统计摘要
        const weights = records.map(r => r.weight);
        const min = Math.min(...weights);
        const max = Math.max(...weights);
        const avg = (weights.reduce((s, w) => s + w, 0) / weights.length).toFixed(1);

        let summaryHtml = `
      <div class="stat-grid" style="grid-template-columns:repeat(3,1fr); margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-label">最低</div>
          <div class="stat-value">${min.toFixed(1)}<span class="stat-unit">kg</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">最高</div>
          <div class="stat-value">${max.toFixed(1)}<span class="stat-unit">kg</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均</div>
          <div class="stat-value">${avg}<span class="stat-unit">kg</span></div>
        </div>
      </div>
    `;

        // 时间线
        let timelineHtml = '<div class="timeline">';
        records.forEach(r => {
            const time = r.recorded_at ? r.recorded_at.slice(11, 16) : '--:--';
            const label = TIME_LABEL_MAP[r.time_of_day] || '📝 其他';
            const noteHtml = r.note ? `<div class="timeline-note">${escapeHtml(r.note)}</div>` : '';

            timelineHtml += `
        <div class="timeline-item" data-id="${r.id}">
          <div class="timeline-actions">
            <button onclick="editWeight(${r.id})" title="编辑">✏️</button>
            <button class="delete" onclick="deleteWeight(${r.id}, '${date}')" title="删除">🗑️</button>
          </div>
          <div class="timeline-time">${time}</div>
          <div>
            <span class="timeline-weight">${r.weight.toFixed(1)} kg</span>
            <span class="timeline-tag">${label}</span>
          </div>
          ${noteHtml}
        </div>
      `;
        });
        timelineHtml += '</div>';

        recordsDiv.innerHTML = summaryHtml + timelineHtml;

    } catch (err) {
        recordsDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">加载失败: ${escapeHtml(err.message || '未知错误')}</div>
      </div>
    `;
    }
}


/**
 * 编辑体重记录（弹窗）
 */
window.editWeight = async function (id) {
    try {
        const record = await API.get(`/weight/${id}`);

        // 创建编辑弹窗
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'edit-weight-overlay';
        overlay.innerHTML = `
      <div class="modal" style="min-width:420px;">
        <div class="modal-title">✏️ 编辑体重记录</div>

        <div class="form-group">
          <label class="label">体重 (kg)</label>
          <input class="input input-boxed" type="number" id="edit-weight-value"
                 value="${record.weight}" step="0.1" min="0" max="300">
        </div>

        <div class="form-group">
          <label class="label">时段</label>
          <div class="time-picker-group" id="edit-time-picker">
            ${TIME_OF_DAY_OPTIONS.map(o => `
              <button class="time-picker-btn${o.value === record.time_of_day ? ' active' : ''}"
                      data-value="${o.value}"
                      onclick="selectEditTimeOfDay(this)">
                ${o.label}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="label">备注</label>
          <input class="input input-boxed" type="text" id="edit-weight-note"
                 value="${escapeHtml(record.note || '')}" placeholder="备注...">
        </div>

        <div class="modal-actions">
          <button class="btn" onclick="closeEditModal()">取消</button>
          <button class="btn btn-primary" onclick="saveEditWeight(${id}, '${record.date}')">保存</button>
        </div>
      </div>
    `;
        document.body.appendChild(overlay);

        // 点遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeEditModal();
        });

        document.getElementById('edit-weight-value').focus();

    } catch (err) {
        showToast('获取记录失败: ' + (err.message || ''), 'error');
    }
};

window.selectEditTimeOfDay = function (btn) {
    document.querySelectorAll('#edit-time-picker .time-picker-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};

window.closeEditModal = function () {
    const overlay = document.getElementById('edit-weight-overlay');
    if (overlay) overlay.remove();
};

window.saveEditWeight = async function (id, date) {
    const weight = parseFloat(document.getElementById('edit-weight-value').value);
    if (isNaN(weight) || weight <= 0) {
        showToast('请输入有效的体重数值', 'warning');
        return;
    }

    const activeBtn = document.querySelector('#edit-time-picker .time-picker-btn.active');
    const timeOfDay = activeBtn ? activeBtn.dataset.value : 'other';
    const note = document.getElementById('edit-weight-note').value.trim();

    try {
        await API.put(`/weight/${id}`, { weight, time_of_day: timeOfDay, note });
        showToast('✅ 已更新', 'success');
        closeEditModal();
        await loadTodayRecords(date);
    } catch (err) {
        showToast('更新失败: ' + (err.message || ''), 'error');
    }
};


/**
 * 删除体重记录
 */
window.deleteWeight = async function (id, date) {
    const confirmed = await showConfirm('确定要删除这条体重记录吗？');
    if (!confirmed) return;

    try {
        await API.delete(`/weight/${id}`);
        showToast('已删除', 'info');
        await loadTodayRecords(date);
    } catch (err) {
        showToast('删除失败: ' + (err.message || ''), 'error');
    }
};
