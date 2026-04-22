/**
 * 🤖 AI 智能分析页 — analysis.js
 * 一键触发分析 + Markdown 渲染 + 历史报告列表
 */

window.render_analysis = async function (container) {
  let selectedDate = today();

  container.innerHTML = `
    <div class="paper">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="margin:0; border:none; padding:0;">🤖 AI 智能分析</h2>
        <div class="date-picker">
          <button class="date-arrow" onclick="adjustDate('analysis-date', -1)">◀</button>
          <input type="text" id="analysis-date" value="${selectedDate}"
                 readonly
                 onclick="openDatePickerModal('analysis-date')"
                 title="点击打开日期选择器"
                 style="cursor: pointer; text-align: center; font-weight: 600;">
          <button class="date-arrow" onclick="adjustDate('analysis-date', 1)">▶</button>
        </div>
      </div>

      <!-- 数据预览 -->
      <div id="analysis-data-preview" style="margin-bottom:20px;">
        ${skeletonHTML(2)}
      </div>

      <!-- 触发按钮 -->
      <div style="text-align:center; margin-bottom:8px;">
        <button class="btn btn-primary btn-lg" id="trigger-ai-btn" onclick="triggerAnalysis()">
          🤖 开始 AI 分析
        </button>
        <div style="margin-top:8px; font-size:0.85rem; color:var(--ink-tertiary);">
          基于今日数据，AI 将进行交叉分析并给出个性化建议
        </div>
      </div>
    </div>

    <!-- 分析结果 -->
    <div class="paper" id="analysis-result-section" style="display:none;">
      <h3 style="margin-bottom:16px;">📋 分析报告</h3>
      <div id="analysis-result"></div>
    </div>

    <!-- 历史报告 -->
    <div class="paper">
      <h3 style="margin-bottom:16px;">📚 历史报告</h3>
      <div id="analysis-history">${skeletonHTML(3)}</div>
    </div>
  `;

  // 日期变化时重新加载
  document.getElementById('analysis-date').addEventListener('change', () => {
    selectedDate = document.getElementById('analysis-date').value;
    loadDataPreview(selectedDate);
    loadHistory(selectedDate);
  });

  await loadDataPreview(selectedDate);
  await loadHistory(selectedDate);
};


/**
 * 加载当天数据预览（让用户看到 AI 将分析哪些数据）
 */
async function loadDataPreview(date) {
  const div = document.getElementById('analysis-data-preview');
  if (!div) return;

  try {
    const data = await API.get(`/dashboard/today?date=${date}`);
    const wCount = data.weights ? data.weights.length : 0;
    const mCount = data.meals ? data.meals.length : 0;
    const eCount = data.exercises ? data.exercises.length : 0;

    let latestWeight = '--';
    if (data.weights && data.weights.length > 0) {
      latestWeight = data.weights[data.weights.length - 1].weight.toFixed(1) + ' kg';
    }

    let totalCalIn = 0, totalCalOut = 0;
    if (data.meals) data.meals.forEach(m => totalCalIn += (m.ai_calorie_estimate || m.calories || 0));
    if (data.exercises) data.exercises.forEach(e => totalCalOut += (e.calories_burned || 0));

    div.innerHTML = `
      <div class="stat-grid" style="grid-template-columns:repeat(4, 1fr); margin-bottom:0;">
        <div class="stat-card">
          <div class="stat-label">当前体重</div>
          <div class="stat-value" style="font-size:1.4rem;">${latestWeight}</div>
          <div class="stat-change neutral">${wCount} 条记录</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">饮食记录</div>
          <div class="stat-value" style="font-size:1.4rem;">${mCount}</div>
          <div class="stat-change neutral">${totalCalIn} kcal</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">运动记录</div>
          <div class="stat-value" style="font-size:1.4rem;">${eCount}</div>
          <div class="stat-change neutral">${totalCalOut} kcal</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">净摄入</div>
          <div class="stat-value" style="font-size:1.4rem; color:${totalCalIn - totalCalOut > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">
            ${totalCalIn - totalCalOut}
          </div>
          <div class="stat-change neutral">kcal</div>
        </div>
      </div>
    `;
  } catch (err) {
    div.innerHTML = '<div style="color:var(--ink-tertiary); text-align:center;">无法加载数据预览</div>';
  }
}


/**
 * 触发 AI 分析
 */
window.triggerAnalysis = async function () {
  const btn = document.getElementById('trigger-ai-btn');
  const resultSection = document.getElementById('analysis-result-section');
  const resultDiv = document.getElementById('analysis-result');
  const date = document.getElementById('analysis-date').value;

  btn.disabled = true;
  btn.innerHTML = '<span class="loading-dots">🤖 AI 正在分析中</span>';

  // 显示结果区域并展示动画
  resultSection.style.display = 'block';
  resultDiv.innerHTML = `
    <div style="text-align:center; padding:40px;">
      <div style="font-size:2rem; margin-bottom:12px; animation: pulse 1.5s infinite;">🧠</div>
      <div style="color:var(--ink-secondary);">AI 正在分析你的数据，请稍等...</div>
      <div style="color:var(--ink-tertiary); font-size:0.85rem; margin-top:8px;">通常需要 5-15 秒</div>
    </div>
  `;

  try {
    const result = await API.post('/ai/analyze', { date });

    if (result.error) {
      throw new Error(result.error);
    }

    // 渲染 Markdown 结果
    resultDiv.innerHTML = `
      <div class="analysis-card">
        <div class="analysis-time">
          🕐 ${result.created_at ? result.created_at.slice(11, 16) : ''} · ${result.model_used || 'AI'}
          ${result.tokens_used ? ` · ${result.tokens_used} tokens` : ''}
        </div>
        <div class="analysis-content">${renderMarkdown(result.analysis_text)}</div>
      </div>
    `;

    showToast('✅ AI 分析完成！', 'success');

    // 刷新历史
    await loadHistory(date);

  } catch (err) {
    resultDiv.innerHTML = `
      <div class="empty-state" style="padding:24px;">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">${escapeHtml(err.message || 'AI 分析失败')}</div>
        <div style="margin-top:8px; font-size:0.85rem; color:var(--ink-tertiary);">
          请检查「系统设置」中的 AI API Key 是否正确配置
        </div>
      </div>
    `;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🤖 开始 AI 分析';
  }
};


/**
 * 加载历史分析报告
 */
async function loadHistory(date) {
  const div = document.getElementById('analysis-history');
  if (!div) return;

  try {
    const reports = await API.get(`/ai/history?date=${date}`);

    if (!reports || reports.length === 0) {
      div.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-text">今天还没有 AI 分析报告</div>
        </div>
      `;
      return;
    }

    let html = '';
    reports.forEach((r, i) => {
      const time = r.created_at ? r.created_at.slice(11, 16) : '';
      const isFirst = i === 0;

      html += `
        <div class="analysis-card" style="margin-bottom:16px; ${isFirst ? '' : 'opacity:0.7;'}">
          <div class="analysis-time" style="display:flex; justify-content:space-between; align-items:center;">
            <span>🕐 ${time} · ${r.model_used || 'AI'} ${r.tokens_used ? `· ${r.tokens_used} tokens` : ''}</span>
            <button class="btn btn-sm" onclick="toggleReportDetail(this)">展开</button>
          </div>
          <div class="analysis-preview" style="margin-top:8px;">
            ${escapeHtml((r.analysis_text || '').slice(0, 120))}...
          </div>
          <div class="analysis-full" style="display:none; margin-top:12px;">
            ${renderMarkdown(r.analysis_text)}
          </div>
        </div>
      `;
    });

    div.innerHTML = html;
  } catch (err) {
    div.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">加载失败</div></div>`;
  }
}


/**
 * 展开/收起历史报告详情
 */
window.toggleReportDetail = function (btn) {
  const card = btn.closest('.analysis-card');
  const preview = card.querySelector('.analysis-preview');
  const full = card.querySelector('.analysis-full');

  if (full.style.display === 'none') {
    full.style.display = 'block';
    preview.style.display = 'none';
    btn.textContent = '收起';
  } else {
    full.style.display = 'none';
    preview.style.display = 'block';
    btn.textContent = '展开';
  }
};


/**
 * 简易 Markdown → HTML 渲染器
 * 支持：标题、加粗、列表、emoji、分割线
 */
function renderMarkdown(text) {
  if (!text) return '';

  return text
    // 转义 HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 标题
    .replace(/^### (.+)$/gm, '<h4 style="margin:16px 0 8px; color:var(--ink-primary);">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin:20px 0 10px; color:var(--ink-primary);">$1</h3>')
    // 加粗
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 无序列表
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0; padding-left:4px;">$1</li>')
    // 分割线
    .replace(/^---$/gm, '<hr style="border:none; border-top:2px dashed var(--grid-line); margin:16px 0;">')
    // 段落换行
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    // 包裹列表项
    .replace(/(<li[^>]*>.*<\/li>)/gs, '<ul style="padding-left:20px; margin:8px 0;">$1</ul>')
    // 去除连续 ul 标签
    .replace(/<\/ul>\s*<ul[^>]*>/g, '');
}
