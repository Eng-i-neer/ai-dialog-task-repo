/**
 * 🤖 AI 智能分析页 — analysis.js
 * 一键触发分析 + 后台运行 + 轮询获取结果 + 历史报告列表
 */

let _analysisDisplayIntervalId = null;

function stopAnalysisDisplayTimer() {
  if (_analysisDisplayIntervalId) {
    clearInterval(_analysisDisplayIntervalId);
    _analysisDisplayIntervalId = null;
  }
}

function startAnalysisDisplayTimer(startTime) {
  stopAnalysisDisplayTimer();
  
  function updateDisplay() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    updateAnalysisProgress({
      status: 'polling',
      elapsed: elapsed,
      message: `AI 正在分析中... 已等待 ${elapsed} 秒`,
    });
  }
  
  updateDisplay();
  _analysisDisplayIntervalId = setInterval(updateDisplay, 1000);
}

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

      <!-- 触发按钮区域 -->
      <div id="trigger-section">
        <div style="text-align:center; margin-bottom:8px;">
          <button class="btn btn-primary btn-lg" id="trigger-ai-btn" onclick="triggerAnalysis()">
            🤖 开始 AI 分析
          </button>
          <div style="margin-top:8px; font-size:0.85rem; color:var(--ink-tertiary);">
            基于今日数据，AI 将进行交叉分析并给出个性化建议
          </div>
        </div>
      </div>

      <!-- 分析状态显示（默认隐藏） -->
      <div id="analysis-status" style="display:none; margin-bottom:16px;">
        <div style="text-align:center; padding:20px; border-radius:12px; background:var(--fill-accent);">
          <div id="status-icon" style="font-size:2.5rem; margin-bottom:8px; animation: pulse 1.5s infinite;">🧠</div>
          <div id="status-text" style="font-size:1.1rem; font-weight:600; color:var(--ink-primary);">AI 正在分析中...</div>
          <div id="status-subtext" style="font-size:0.85rem; color:var(--ink-secondary); margin-top:4px;">已等待 0 秒，通常需要 10-30 秒</div>
          <div style="margin-top:12px; font-size:0.8rem; color:var(--ink-tertiary);">
            💡 您可以切换页面或退出，分析会在后台继续进行
          </div>
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

  stopAiPolling();
  stopAnalysisDisplayTimer();

  document.getElementById('analysis-date').addEventListener('change', () => {
    selectedDate = document.getElementById('analysis-date').value;
    stopAiPolling();
    stopAnalysisDisplayTimer();
    updateTriggerSection(false);
    loadDataPreview(selectedDate);
    loadHistory(selectedDate);
  });

  const ongoingTask = checkOngoingAiTask(selectedDate);
  if (ongoingTask && ongoingTask.isRunning) {
    console.log('Found ongoing AI task, resuming polling...');
    updateTriggerSection(true);
    startAnalysisDisplayTimer(ongoingTask.task.startTime);
    startAiPolling(selectedDate, {
      onProgress: (data) => {
        updateAnalysisProgress(data);
      },
      onComplete: (data) => {
        handleAnalysisComplete(data);
      },
      onError: (data) => {
        handleAnalysisError(data);
      },
    });
  } else {
    clearAiTask();
  }

  await loadDataPreview(selectedDate);
  await loadHistory(selectedDate);
};


/**
 * 加载当天数据预览
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
  const date = document.getElementById('analysis-date').value;

  const ongoingTask = checkOngoingAiTask(date);
  if (ongoingTask && ongoingTask.isRunning) {
    showToast('⚠️ 已有分析任务正在进行中', 'warning');
    return;
  }

  updateTriggerSection(true);
  
  const requestStartTime = Date.now();
  startAnalysisDisplayTimer(requestStartTime);

  showToast('🚀 AI 分析已开始，可切换页面等待', 'info');

  const result = await triggerAiAnalysis(date);

  if (result.success && result.result) {
    const elapsed = Math.floor((Date.now() - requestStartTime) / 1000);
    handleAnalysisComplete({ result: result.result, elapsed: elapsed });
  } else {
    startAiPolling(date, {
      onProgress: (data) => {
        updateAnalysisProgress(data);
      },
      onComplete: (data) => {
        handleAnalysisComplete(data);
      },
      onError: (data) => {
        handleAnalysisError(data);
      },
    });
  }
};


/**
 * 更新触发按钮区域状态
 */
function updateTriggerSection(isAnalyzing) {
  const triggerSection = document.getElementById('trigger-section');
  const statusSection = document.getElementById('analysis-status');
  const btn = document.getElementById('trigger-ai-btn');

  if (!triggerSection || !statusSection) return;

  if (isAnalyzing) {
    triggerSection.style.display = 'none';
    statusSection.style.display = 'block';
  } else {
    triggerSection.style.display = 'block';
    statusSection.style.display = 'none';
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🤖 开始 AI 分析';
    }
  }
}


/**
 * 显示分析状态
 */
function showAnalysisStatus(elapsed) {
  const statusSection = document.getElementById('analysis-status');
  if (!statusSection) return;

  statusSection.style.display = 'block';
  updateAnalysisProgress({
    status: 'polling',
    elapsed: elapsed,
    message: elapsed > 0 ? `AI 正在分析中... 已等待 ${elapsed} 秒` : 'AI 正在分析中...',
  });
}


/**
 * 更新分析进度
 */
function updateAnalysisProgress(data) {
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const statusSubtext = document.getElementById('status-subtext');

  if (statusIcon) {
    statusIcon.textContent = '🧠';
    statusIcon.style.animation = 'pulse 1.5s infinite';
  }
  if (statusText) statusText.textContent = 'AI 正在分析中...';
  if (statusSubtext) {
    statusSubtext.textContent = `已等待 ${data.elapsed} 秒，通常需要 10-30 秒`;
  }
}


/**
 * 处理分析完成
 */
function handleAnalysisComplete(data) {
  const resultSection = document.getElementById('analysis-result-section');
  const resultDiv = document.getElementById('analysis-result');
  const date = document.getElementById('analysis-date')?.value || today();

  stopAiPolling();
  stopAnalysisDisplayTimer();
  clearAiTask();

  updateTriggerSection(false);

  if (resultSection) resultSection.style.display = 'block';

  if (resultDiv && data.result) {
    resultDiv.innerHTML = `
      <div class="analysis-card">
        <div class="analysis-time">
          🕐 ${data.result.created_at ? data.result.created_at.slice(11, 16) : ''} · ${data.result.model_used || 'AI'}
          ${data.result.tokens_used ? ` · ${data.result.tokens_used} tokens` : ''}
          ${data.elapsed != null ? ` · 用时 ${data.elapsed} 秒` : ''}
        </div>
        <div class="analysis-content">${renderMarkdown(data.result.analysis_text)}</div>
      </div>
    `;
  }

  showToast('✅ AI 分析完成！', 'success');

  loadHistory(date);
}


/**
 * 处理分析错误
 */
function handleAnalysisError(data) {
  const resultSection = document.getElementById('analysis-result-section');
  const resultDiv = document.getElementById('analysis-result');

  stopAiPolling();
  stopAnalysisDisplayTimer();
  clearAiTask();

  updateTriggerSection(false);

  if (resultSection) resultSection.style.display = 'block';

  if (resultDiv) {
    resultDiv.innerHTML = `
      <div class="empty-state" style="padding:24px;">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">${data.message || 'AI 分析失败'}</div>
        <div style="margin-top:8px; font-size:0.85rem; color:var(--ink-tertiary);">
          请检查「系统设置」中的 AI API Key 是否正确配置
        </div>
      </div>
    `;
  }

  showToast('❌ ' + (data.error || '分析失败'), 'error');
}


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
 */
function renderMarkdown(text) {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 style="margin:16px 0 8px; color:var(--ink-primary);">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin:20px 0 10px; color:var(--ink-primary);">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0; padding-left:4px;">$1</li>')
    .replace(/^---$/gm, '<hr style="border:none; border-top:2px dashed var(--grid-line); margin:16px 0;">')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/(<li[^>]*>.*<\/li>)/gs, '<ul style="padding-left:20px; margin:8px 0;">$1</ul>')
    .replace(/<\/ul>\s*<ul[^>]*>/g, '');
}
