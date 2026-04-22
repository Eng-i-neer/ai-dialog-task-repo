/**
 * 🏋️ 饮食记录页 — meals.js
 * 两种记录方式：📷 拍照(AI自动识别) 或 ✏️ 手动输入
 */

const MEAL_TYPES = [
  { value: 'breakfast', label: '🌅 早餐', icon: '🌅' },
  { value: 'lunch', label: '☀️ 午餐', icon: '☀️' },
  { value: 'dinner', label: '🌙 晚餐', icon: '🌙' },
  { value: 'snack', label: '🍪 加餐', icon: '🍪' },
];

const MEAL_TYPE_MAP = {};
MEAL_TYPES.forEach(m => MEAL_TYPE_MAP[m.value] = m.label);

let _selectedPhoto = null;
let _aiDescription = '';       // AI 生成的描述
let _aiCalories = null;        // AI 估算的热量
let _aiAnalysisResult = null;  // AI 完整分析 JSON

window.render_meals = async function (container) {
  let selectedDate = today();
  _selectedPhoto = null;
  _aiDescription = '';
  _aiCalories = null;
  _aiAnalysisResult = null;

  container.innerHTML = `
    <div class="paper">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2 style="margin:0; border:none; padding:0;">🍽️ 记录饮食</h2>
        <div class="date-picker">
          <button class="date-arrow" onclick="adjustDate('meal-date', -1)">◀</button>
          <input type="text" id="meal-date" value="${selectedDate}"
                 readonly
                 onclick="openDatePickerModal('meal-date')"
                 title="点击打开日期选择器"
                 style="cursor: pointer; text-align: center; font-weight: 600;">
          <button class="date-arrow" onclick="adjustDate('meal-date', 1)">▶</button>
        </div>
      </div>

      <!-- 餐次选择 -->
      <div class="form-group">
        <div class="time-picker-group" id="meal-type-group">
          ${MEAL_TYPES.map((m, i) => `
            <button class="time-picker-btn${i === 0 ? ' active' : ''}"
                    data-value="${m.value}" onclick="selectMealType(this)">
              ${m.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- 📷 拍照/选图识别（主要方式） -->
      <div class="form-group">
        <label class="label">📷 食物照片 <span style="color:var(--ink-tertiary); font-weight:400;">— AI 自动识别食物和热量</span></label>
        <!-- 两个隐藏 input：一个拍照、一个选图库 -->
        <input type="file" id="photo-input-camera" accept="image/*" capture="environment"
               style="display:none;" onchange="handlePhotoSelect(this)">
        <input type="file" id="photo-input-gallery" accept="image/*"
               style="display:none;" onchange="handlePhotoSelect(this)">
        <div class="photo-upload-area" id="photo-upload-area"
             ondragover="event.preventDefault(); this.classList.add('dragover')"
             ondragleave="this.classList.remove('dragover')"
             ondrop="handlePhotoDrop(event)">
          <div id="photo-placeholder" style="text-align:center; display:flex; flex-direction:column; align-items:center;">
            <div style="font-size:2.5rem; margin-bottom:8px;">📸</div>
            <div style="color:var(--ink-secondary); margin-bottom:12px; text-align:center;">选择食物照片，AI 自动识别并估算热量</div>
            <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); triggerCamera()" style="min-width:120px;">
                📷 拍照
              </button>
              <button class="btn btn-sm" onclick="event.stopPropagation(); triggerGallery()" style="min-width:120px; border:2px solid var(--color-accent); color:var(--color-accent);">
                🖼️ 从相册选
              </button>
            </div>
          </div>
          <div id="photo-preview" style="display:none;">
            <img id="photo-preview-img" style="max-width:100%; max-height:200px; border-radius:8px;">
            <div style="margin-top:10px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
              <button class="btn btn-sm" onclick="event.stopPropagation(); clearPhoto()">🗑️ 删除</button>
              <button class="btn btn-sm" onclick="event.stopPropagation(); triggerCamera()" style="border:2px solid var(--color-accent); color:var(--color-accent);">📷 重拍</button>
              <button class="btn btn-sm" onclick="event.stopPropagation(); triggerGallery()" style="border:2px solid var(--color-accent); color:var(--color-accent);">🖼️ 换图</button>
              <button class="btn btn-primary btn-sm" id="ai-photo-btn" onclick="event.stopPropagation(); analyzePhoto()">🤖 AI 识别</button>
            </div>
          </div>
        </div>
        <div id="ai-vision-result" style="display:none; margin-top:12px;"></div>
      </div>

      <!-- 分割线：或者手动输入 -->
      <div style="display:flex; align-items:center; gap:12px; margin:20px 0;">
        <div style="flex:1; height:2px; background:var(--grid-line);"></div>
        <span style="color:var(--ink-tertiary); font-size:0.85rem; white-space:nowrap;">或者手动输入</span>
        <div style="flex:1; height:2px; background:var(--grid-line);"></div>
      </div>

      <!-- ✏️ 手动描述 + 热量 -->
      <div class="form-group">
        <label class="label">✏️ 食物描述 <span style="color:var(--ink-tertiary); font-weight:400;">— 拍照后自动填写</span></label>
        <input class="input input-boxed" type="text" id="meal-desc"
               placeholder="拍照 AI 自动填写，或手动输入如：全麦面包、水煮鸡蛋">
      </div>

      <div class="form-group">
        <label class="label">热量（kcal） <span style="color:var(--ink-tertiary); font-weight:400;">— AI 估算或手动填写</span></label>
        <input class="input input-boxed" type="number" id="meal-calories"
               placeholder="AI 自动估算，或手动输入" min="0" step="10">
      </div>

      <!-- 备注 -->
      <div class="form-group">
        <label class="label">📝 备注（可选）</label>
        <input class="input input-boxed" type="text" id="meal-note"
               placeholder="例：外卖、吃得比较清淡、加了辣椒...">
      </div>

      <div style="text-align:center; margin-top:12px;">
        <button class="btn btn-primary btn-lg" id="submit-meal-btn" onclick="submitMeal()">
          🍽️ 记录饮食
        </button>
      </div>
    </div>

    <!-- 今日饮食记录 -->
    <div class="paper">
      <h3 style="margin-bottom:16px;">📋 今日饮食</h3>
      <div id="today-meals">${skeletonHTML(3)}</div>
    </div>
  `;

  document.getElementById('meal-date').addEventListener('change', () => {
    selectedDate = document.getElementById('meal-date').value;
    loadTodayMeals(selectedDate);
  });

  await loadTodayMeals(selectedDate);
};


// ═══ 照片相关 ═══

window.triggerCamera = function () {
  document.getElementById('photo-input-camera').click();
};

window.triggerGallery = function () {
  document.getElementById('photo-input-gallery').click();
};

// 保留旧函数名兼容（桌面端可能拖拽触发）
window.triggerPhotoSelect = function () {
  document.getElementById('photo-input-gallery').click();
};

window.handlePhotoSelect = function (input) {
  if (input.files && input.files[0]) setPhoto(input.files[0]);
};

window.handlePhotoDrop = function (e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) setPhoto(e.dataTransfer.files[0]);
};

function setPhoto(file) {
  if (file.size > 10 * 1024 * 1024) {
    showToast('图片太大，最大 10MB', 'warning');
    return;
  }
  _selectedPhoto = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('photo-preview-img').src = e.target.result;
    document.getElementById('photo-placeholder').style.display = 'none';
    document.getElementById('photo-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

window.clearPhoto = function () {
  _selectedPhoto = null;
  _aiDescription = '';
  _aiCalories = null;
  _aiAnalysisResult = null;
  document.getElementById('photo-input-camera').value = '';
  document.getElementById('photo-input-gallery').value = '';
  document.getElementById('photo-placeholder').style.display = 'block';
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('ai-vision-result').style.display = 'none';
};

window.analyzePhoto = async function () {
  if (!_selectedPhoto) { showToast('请先选择照片', 'warning'); return; }

  const btn = document.getElementById('ai-photo-btn');
  const resultDiv = document.getElementById('ai-vision-result');
  btn.disabled = true;
  btn.textContent = '🤖 识别中...';

  resultDiv.style.display = 'block';
  resultDiv.innerHTML = `
      <div style="text-align:center; padding:16px; border:2px dashed var(--grid-line); border-radius:8px;">
        <div style="animation:pulse 1.5s infinite; font-size:1.5rem;">🧠</div>
        <div style="color:var(--ink-secondary); margin-top:4px;">AI 正在识别食物...</div>
      </div>
    `;

  try {
    const formData = new FormData();
    formData.append('photo', _selectedPhoto);

    // ★ 把备注和手动描述作为上下文一起发给 AI
    const noteText = (document.getElementById('meal-note').value || '').trim();
    const descText = (document.getElementById('meal-desc').value || '').trim();
    const hints = [descText, noteText].filter(Boolean).join('；');
    if (hints) {
      formData.append('text', `用户备注：${hints}\n请结合用户的描述和图片来识别食物并估算热量。`);
    }

    const result = await API.upload('/ai/vision/analyze', formData);
    if (result.error) throw new Error(result.error);

    const parsed = result.parsed || {};
    const foods = parsed.foods || [];
    const totalCal = parsed.total_calories;

    // ★ 保存完整 AI 分析结果
    _aiAnalysisResult = JSON.stringify(result.parsed || {});

    // ★ 自动填入描述和热量
    if (parsed.description) {
      _aiDescription = parsed.description;
      document.getElementById('meal-desc').value = parsed.description;
    } else if (foods.length > 0) {
      _aiDescription = foods.map(f => f.name).join('、');
      document.getElementById('meal-desc').value = _aiDescription;
    }

    if (totalCal) {
      _aiCalories = totalCal;
      document.getElementById('meal-calories').value = totalCal;
    }

    // 显示识别结果
    let foodsHtml = foods.map(f =>
      `<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed var(--grid-line);">
               <span>${escapeHtml(f.name)} <span style="color:var(--ink-tertiary); font-size:0.85rem;">${escapeHtml(f.portion || '')}</span></span>
               <span style="font-weight:700; color:var(--color-warning);">${f.calories || '?'} kcal</span>
             </div>`
    ).join('');

    resultDiv.innerHTML = `
          <div style="border:2px solid var(--color-success); border-radius:8px; padding:16px; background:rgba(46,204,113,0.05);">
            <div style="font-weight:700; margin-bottom:8px; color:var(--color-success);">✅ AI 识别完成 — 已自动填入</div>
            ${foodsHtml}
            ${totalCal ? `<div style="text-align:right; margin-top:8px; font-size:1.1rem; font-weight:700;">总计：${totalCal} kcal</div>` : ''}
            ${parsed.advice ? `<div style="margin-top:8px; padding:8px; background:var(--fill-accent); border-radius:4px; font-size:0.85rem;">💡 ${escapeHtml(parsed.advice)}</div>` : ''}
            <div style="margin-top:4px; font-size:0.75rem; color:var(--ink-tertiary);">
              ${result.model_used || ''} · ${result.tokens_used || 0} tokens
            </div>
          </div>
        `;
    showToast('✅ 已自动填入食物和热量', 'success');

  } catch (err) {
    resultDiv.innerHTML = `
          <div style="border:2px solid var(--color-danger); border-radius:8px; padding:16px;">
            <div style="color:var(--color-danger); font-weight:700;">⚠️ 识别失败</div>
            <div style="color:var(--ink-secondary); margin-top:4px; font-size:0.9rem;">${escapeHtml(err.message || '请重试或手动输入')}</div>
          </div>
        `;
  } finally {
    btn.disabled = false;
    btn.textContent = '🤖 AI 识别';
  }
};


// ═══ 餐次 ═══

window.selectMealType = function (btn) {
  document.querySelectorAll('#meal-type-group .time-picker-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};


// ═══ 提交 ═══

window.submitMeal = async function () {
  const description = document.getElementById('meal-desc').value.trim();

  // ★ 只要描述有内容就行（可以手动输入，也可以 AI 自动填的）
  if (!description) {
    showToast('请拍照识别 或 手动输入食物描述', 'warning');
    return;
  }

  const activeBtn = document.querySelector('#meal-type-group .time-picker-btn.active');
  const mealType = activeBtn ? activeBtn.dataset.value : 'snack';
  const calories = parseFloat(document.getElementById('meal-calories').value) || null;
  const note = (document.getElementById('meal-note').value || '').trim();
  const date = document.getElementById('meal-date').value;
  const recorded_at = `${date} ${new Date().toTimeString().slice(0, 8)}`;

  // 上传照片
  let photoPath = null;
  if (_selectedPhoto) {
    try {
      const formData = new FormData();
      formData.append('photo', _selectedPhoto);
      const uploadResult = await API.upload('/upload/meal-photo', formData);
      photoPath = uploadResult.url;
    } catch (e) {
      console.warn('Photo upload failed:', e);
    }
  }

  const submitBtn = document.getElementById('submit-meal-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ 提交中...';

  // 描述 = 食物描述 + 备注（合并）
  const fullDesc = note ? `${description}（${note}）` : description;

  try {
    await API.post('/meal', {
      date, meal_type: mealType,
      description: fullDesc,
      calories: _aiCalories || calories,
      ai_calorie_estimate: _aiCalories,
      ai_analysis_json: _aiAnalysisResult,
      photo_path: photoPath,
      recorded_at,
    });
    showToast('✅ 已记录饮食', 'success');

    // 清空
    document.getElementById('meal-desc').value = '';
    document.getElementById('meal-calories').value = '';
    document.getElementById('meal-note').value = '';
    _aiDescription = '';
    _aiCalories = null;
    _aiAnalysisResult = null;
    clearPhoto();

    await loadTodayMeals(date);
  } catch (err) {
    showToast(err.message || '记录失败', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '🍽️ 记录饮食';
  }
};


// ═══ 今日列表 ═══

let _mealRecords = [];  // 缓存当前列表数据

async function loadTodayMeals(date) {
  const div = document.getElementById('today-meals');
  if (!div) return;

  try {
    const records = await API.get(`/meal?date=${date}`);
    _mealRecords = records || [];

    if (_mealRecords.length === 0) {
      div.innerHTML = `<div class="empty-state"><div class="empty-icon">🍽️</div><div class="empty-text">还没有饮食记录</div></div>`;
      return;
    }

    const totalCal = _mealRecords.reduce((s, r) => s + (r.ai_calorie_estimate || r.calories || 0), 0);

    let html = `
      <div style="text-align:center; margin-bottom:16px; padding:8px; background:var(--fill-warning); border-radius:4px;">
        <span style="font-weight:700;">今日总摄入：</span>
        <span style="font-size:1.3rem; font-weight:700; color:var(--color-warning);">${totalCal} kcal</span>
      </div>
      <div class="timeline">
    `;

    _mealRecords.forEach(r => {
      const time = r.recorded_at ? r.recorded_at.slice(11, 16) : '--:--';
      const label = MEAL_TYPE_MAP[r.meal_type] || '🍽️ 其他';
      const cal = r.ai_calorie_estimate || r.calories;
      const calText = cal ? ` · ${cal} kcal` : '';
      const hasAi = r.ai_analysis_json ? ' 🤖' : '';
      const photoHtml = r.photo_path
        ? `<img src="${r.photo_path}" style="max-width:60px; max-height:45px; border-radius:4px; margin-top:4px; border:1px solid var(--grid-line);">`
        : '';

      html += `
        <div class="timeline-item" style="cursor:pointer;" onclick="showMealDetail(${r.id})">
          <div class="timeline-actions" onclick="event.stopPropagation()">
            <button class="delete" onclick="deleteMeal(${r.id}, '${date}')" title="删除">🗑️</button>
          </div>
          <div class="timeline-time">${time}</div>
          <div>
            <span class="timeline-weight" style="font-size:1.05rem;">${escapeHtml(r.description)}</span>
            <span class="timeline-tag">${label}${calText}${hasAi}</span>
            ${photoHtml}
          </div>
        </div>
      `;
    });
    html += '</div>';
    div.innerHTML = html;
  } catch (err) {
    div.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">加载失败</div></div>`;
  }
}


// ═══ 详情弹窗（使用系统 .modal-overlay + .modal 风格） ═══

window.showMealDetail = function (id) {
  const r = _mealRecords.find(m => m.id === id);
  if (!r) return;

  const time = r.recorded_at ? r.recorded_at.slice(11, 16) : '--:--';
  const label = MEAL_TYPE_MAP[r.meal_type] || '其他';
  const cal = r.ai_calorie_estimate || r.calories || 0;

  // 解析 AI 分析 JSON
  let aiDetail = '';
  let aiObj = null;
  if (r.ai_analysis_json) {
    try {
      aiObj = typeof r.ai_analysis_json === 'string' ? JSON.parse(r.ai_analysis_json) : r.ai_analysis_json;
    } catch (e) { /* ignore */ }
  }

  if (aiObj && aiObj.foods && aiObj.foods.length > 0) {
    let foodRows = aiObj.foods.map(f =>
      `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed var(--grid-line);">
         <span>${escapeHtml(f.name)} <span style="color:var(--ink-tertiary); font-size:0.85rem;">${escapeHtml(f.portion || '')}</span></span>
         <span style="font-weight:700; color:var(--color-warning); white-space:nowrap;">${f.calories || '?'} kcal</span>
       </div>`
    ).join('');

    aiDetail = `
      <div style="margin-top:16px; padding:12px; border:2px dashed var(--grid-line); border-radius:4px;">
        <div style="font-weight:700; margin-bottom:8px; color:var(--color-accent);">🤖 AI 分析明细</div>
        ${foodRows}
        ${aiObj.total_calories ? `<div style="text-align:right; margin-top:8px; font-size:1.1rem; font-weight:700;">总计：${aiObj.total_calories} kcal</div>` : ''}
        ${aiObj.advice ? `<div style="margin-top:10px; padding:8px; background:var(--fill-accent); border-radius:4px; font-size:0.85rem;">💡 ${escapeHtml(aiObj.advice)}</div>` : ''}
        ${aiObj.confidence ? `<div style="margin-top:4px; font-size:0.75rem; color:var(--ink-tertiary);">置信度: ${aiObj.confidence}</div>` : ''}
      </div>
    `;
  }

  const photoHtml = r.photo_path
    ? `<div style="margin:12px 0; text-align:center;"><img src="${r.photo_path}" style="max-width:100%; max-height:260px; border-radius:4px; border:2px solid var(--grid-line);"></div>`
    : '';

  // 用系统弹窗组件
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'meal-detail-overlay';
  overlay.innerHTML = `
    <div class="modal" style="min-width:400px; max-width:520px;">
      <div class="modal-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>${label} · ${time}</span>
        <span style="font-size:1.3rem; color:var(--color-warning);">${cal} kcal</span>
      </div>

      <!-- 查看模式 -->
      <div id="meal-view-mode">
        <div style="font-size:1.05rem; margin-bottom:8px; line-height:1.6;">${escapeHtml(r.description)}</div>
        ${photoHtml}
        ${aiDetail}
      </div>

      <!-- 编辑模式（默认隐藏） -->
      <div id="meal-edit-mode" style="display:none;">
        <div class="form-group">
          <label class="label">餐次</label>
          <select class="input input-boxed" id="edit-meal-type">
            ${MEAL_TYPES.map(m => `<option value="${m.value}" ${m.value === r.meal_type ? 'selected' : ''}>${m.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="label">食物描述</label>
          <input class="input input-boxed" type="text" id="edit-meal-desc" value="${escapeHtml(r.description)}">
        </div>
        <div class="form-group">
          <label class="label">热量（kcal）</label>
          <input class="input input-boxed" type="number" id="edit-meal-cal" value="${cal}" min="0" step="10">
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn" id="edit-meal-toggle" onclick="toggleMealEdit()">✏️ 编辑</button>
        <button class="btn btn-primary" id="save-meal-btn" onclick="saveMealEdit(${r.id})" style="display:none;">💾 保存</button>
        <button class="btn" onclick="closeMealDetail()">关闭</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 点遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeMealDetail();
  });
};

window.closeMealDetail = function () {
  const overlay = document.getElementById('meal-detail-overlay');
  if (overlay) overlay.remove();
};

window.toggleMealEdit = function (id) {
  const viewMode = document.getElementById('meal-view-mode');
  const editMode = document.getElementById('meal-edit-mode');
  const toggleBtn = document.getElementById('edit-meal-toggle');
  const saveBtn = document.getElementById('save-meal-btn');

  if (editMode.style.display === 'none') {
    editMode.style.display = 'block';
    viewMode.style.display = 'none';
    toggleBtn.textContent = '👁️ 查看';
    saveBtn.style.display = '';
  } else {
    editMode.style.display = 'none';
    viewMode.style.display = 'block';
    toggleBtn.textContent = '✏️ 编辑';
    saveBtn.style.display = 'none';
  }
};

window.saveMealEdit = async function (id) {
  const desc = document.getElementById('edit-meal-desc').value.trim();
  if (!desc) { showToast('描述不能为空', 'warning'); return; }

  const mealType = document.getElementById('edit-meal-type').value;
  const cal = parseFloat(document.getElementById('edit-meal-cal').value) || null;

  const btn = document.getElementById('save-meal-btn');
  btn.disabled = true;
  btn.textContent = '⏳ 保存中...';

  try {
    await API.put(`/meal/${id}`, {
      meal_type: mealType,
      description: desc,
      calories: cal,
      ai_calorie_estimate: cal,
    });
    showToast('✅ 已保存修改', 'success');
    closeMealDetail();

    // 刷新列表
    const date = document.getElementById('meal-date').value;
    await loadTodayMeals(date);
  } catch (err) {
    showToast(err.message || '保存失败', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 保存修改';
  }
};


// ═══ 删除 ═══

window.deleteMeal = async function (id, date) {
  const confirmed = await showConfirm('确定删除这条饮食记录？');
  if (!confirmed) return;
  try {
    await API.delete(`/meal/${id}`);
    showToast('已删除', 'info');
    await loadTodayMeals(date);
  } catch (err) {
    showToast('删除失败', 'error');
  }
};
