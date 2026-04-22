/**
 * 🏋️ 仪表盘页面 — dashboard.js
 * 统计卡片 + 今日波动图 + 趋势图 + 热量概览 + AI 快报
 */

// 图表实例（切换页面前需销毁）
let _todayChart = null;
let _trendChart = null;

/**
 * 渲染仪表盘
 */
window.render_dashboard = async function (container) {
  container.innerHTML = `
    <!-- 统计卡片 -->
    <div class="stat-grid" id="dash-stats">
      <div class="stat-card">
        <div class="stat-label">当前体重</div>
        <div class="stat-value" id="stat-current">--</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">距离目标</div>
        <div class="stat-value" id="stat-gap">--</div>
        <div class="stat-change neutral" id="stat-progress"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">BMI</div>
        <div class="stat-value" id="stat-bmi">--</div>
        <div class="stat-change neutral" id="stat-bmi-label"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今日波动</div>
        <div class="stat-value" id="stat-fluctuation">--</div>
      </div>
    </div>

    <!-- 今日体重波动图 -->
    <div class="paper" style="margin-bottom:24px;">
      <h3 style="margin-bottom:16px;">📈 今日体重波动</h3>
      <div id="today-chart-wrap" style="position:relative; height:280px;">
        <canvas id="today-chart"></canvas>
      </div>
      <div id="today-chart-empty" style="display:none;">
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-text">今天还没有体重记录</div>
        </div>
      </div>
    </div>

    <!-- 趋势图 -->
    <div class="paper" style="margin-bottom:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="margin:0;">📊 体重趋势</h3>
        <div class="chart-controls" id="trend-controls">
          <button class="chart-period-btn active" data-days="7" onclick="changeTrendPeriod(this)">7天</button>
          <button class="chart-period-btn" data-days="14" onclick="changeTrendPeriod(this)">14天</button>
          <button class="chart-period-btn" data-days="30" onclick="changeTrendPeriod(this)">30天</button>
          <button class="chart-period-btn" data-days="90" onclick="changeTrendPeriod(this)">90天</button>
          <button class="chart-period-btn" data-days="0" onclick="changeTrendPeriod(this)">全程</button>
        </div>
      </div>
      <div id="trend-chart-wrap" style="position:relative; height:300px;">
        <canvas id="trend-chart"></canvas>
      </div>
      <div id="trend-chart-empty" style="display:none;">
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-text">暂无趋势数据</div>
        </div>
      </div>
    </div>

    <!-- 底部双栏：热量概览 + AI 快报 -->
    <div class="dashboard-bottom-grid">
      <!-- 热量概览 -->
      <div class="paper">
        <h3 style="margin-bottom:16px;">🔥 今日热量</h3>
        <div id="calorie-summary">
          <div class="empty-state" style="padding:24px;">
            <div class="empty-icon">🍽️</div>
            <div class="empty-text">今天还没有饮食/运动记录</div>
          </div>
        </div>
      </div>

      <!-- AI 快报 -->
      <div class="paper">
        <h3 style="margin-bottom:16px;">🤖 AI 快报</h3>
        <div id="ai-brief">
          <div class="empty-state" style="padding:24px;">
            <div class="empty-icon">💡</div>
            <div class="empty-text">还没有 AI 分析，去 AI 分析页触发一次吧</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // 销毁旧图表
  destroyCharts();

  // 并行加载数据
  let todayData, trendData, statsData;
  try {
    [todayData, trendData, statsData] = await Promise.all([
      API.get(`/dashboard/today?date=${today()}`),
      API.get('/dashboard/trend?days=7'),
      API.get('/dashboard/stats'),
    ]);
  } catch (err) {
    console.error('Dashboard API error:', err);
    showToast('仪表盘数据加载失败', 'error');
    return;
  }

  // 分别渲染各模块，单个失败不影响其他
  try { renderStats(statsData, todayData); } catch (e) { console.error('renderStats error:', e); }
  try { renderTodayChart(todayData.weights); } catch (e) { console.error('renderTodayChart error:', e); }
  try { renderTrendChart(trendData.data); } catch (e) { console.error('renderTrendChart error:', e); }
  try { renderCalorieSummary(todayData.summary); } catch (e) { console.error('renderCalorieSummary error:', e); }
  try { renderAiBrief(todayData.latest_analysis); } catch (e) { console.error('renderAiBrief error:', e); }
};


/**
 * 渲染统计卡片
 */
function renderStats(stats, todayData) {
  // 当前体重
  const currentEl = document.getElementById('stat-current');
  if (currentEl && stats.current_weight != null) {
    currentEl.innerHTML = `${stats.current_weight.toFixed(1)}<span class="stat-unit">kg</span>`;
    animateNumber(currentEl, stats.current_weight, 800, v => v.toFixed(1));
  }

  // 距离目标
  const gapEl = document.getElementById('stat-gap');
  const progressEl = document.getElementById('stat-progress');
  if (gapEl && stats.current_weight != null && stats.target_weight != null) {
    const gap = stats.current_weight - stats.target_weight;
    const cls = gap > 0 ? 'positive' : gap < 0 ? 'negative' : 'neutral';
    gapEl.innerHTML = `${gap > 0 ? '-' : '+'}${Math.abs(gap).toFixed(1)}<span class="stat-unit">kg</span>`;
    if (progressEl) {
      progressEl.textContent = stats.progress != null ? `${stats.progress.toFixed(0)}% 已完成` : '';
      progressEl.className = `stat-change ${cls}`;
      progressEl.style.display = stats.progress != null ? '' : 'none';
    }
  }

  // BMI
  const bmiEl = document.getElementById('stat-bmi');
  const bmiLabel = document.getElementById('stat-bmi-label');
  if (bmiEl && stats.bmi != null) {
    bmiEl.textContent = stats.bmi.toFixed(1);
    if (bmiLabel) {
      let label = '', cls = 'neutral';
      if (stats.bmi < 18.5) { label = '偏瘦'; cls = 'neutral'; }
      else if (stats.bmi < 24) { label = '正常 ✅'; cls = 'negative'; }
      else if (stats.bmi < 28) { label = '超重'; cls = 'positive'; }
      else { label = '肥胖'; cls = 'positive'; }
      bmiLabel.textContent = label;
      bmiLabel.className = `stat-change ${cls}`;
    }
  }

  // 今日波动
  const flucEl = document.getElementById('stat-fluctuation');
  if (flucEl && todayData.weights && todayData.weights.length >= 2) {
    const ws = todayData.weights.map(w => w.weight);
    const range = (Math.max(...ws) - Math.min(...ws)).toFixed(1);
    flucEl.innerHTML = `${range}<span class="stat-unit">kg</span>`;
  } else if (flucEl) {
    flucEl.textContent = todayData.weights && todayData.weights.length === 1 ? '0.0' : '--';
  }
}


/**
 * 今日体重波动图（折线图）
 */
function renderTodayChart(weights) {
  const canvas = document.getElementById('today-chart');
  const emptyDiv = document.getElementById('today-chart-empty');
  const wrapDiv = document.getElementById('today-chart-wrap');

  if (!weights || weights.length === 0) {
    if (wrapDiv) wrapDiv.style.display = 'none';
    if (emptyDiv) emptyDiv.style.display = 'block';
    return;
  }

  const labels = weights.map(w => w.recorded_at ? w.recorded_at.slice(11, 16) : '');
  const data = weights.map(w => w.weight);

  if (typeof Chart === 'undefined') { console.warn('Chart.js not loaded'); return; }
  _todayChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '体重 (kg)',
        data,
        borderColor: '#2bb894',
        backgroundColor: 'rgba(43, 184, 148, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 6,
        pointBackgroundColor: '#2bb894',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y.toFixed(1)} kg`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(218,225,231,0.4)' },
          ticks: { callback: v => v.toFixed(1) + ' kg' },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });
}


/**
 * 趋势图（多周期）
 */
function renderTrendChart(data) {
  const canvas = document.getElementById('trend-chart');
  const emptyDiv = document.getElementById('trend-chart-empty');
  const wrapDiv = document.getElementById('trend-chart-wrap');

  if (!data || data.length === 0) {
    if (wrapDiv) wrapDiv.style.display = 'none';
    if (emptyDiv) emptyDiv.style.display = 'block';
    return;
  }

  if (wrapDiv) wrapDiv.style.display = 'block';
  if (emptyDiv) emptyDiv.style.display = 'none';

  const labels = data.map(d => d.date.slice(5));      // MM-DD
  const morningWeights = data.map(d => d.morning_weight);
  const avgWeights = data.map(d => d.avg_weight);

  if (typeof Chart === 'undefined') { console.warn('Chart.js not loaded'); return; }
  if (_trendChart) _trendChart.destroy();

  _trendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '晨起体重',
          data: morningWeights,
          borderColor: '#2bb894',
          backgroundColor: 'rgba(43, 184, 148, 0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#2bb894',
          spanGaps: true,
        },
        {
          label: '日均体重',
          data: avgWeights,
          borderColor: '#90a4ae',
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#90a4ae',
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { usePointStyle: true, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + ' kg' : '无数据'}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(218,225,231,0.4)' },
          ticks: { callback: v => v.toFixed(1) },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });
}


/**
 * 切换趋势周期
 */
window.changeTrendPeriod = async function (btn) {
  // 更新按钮状态
  document.querySelectorAll('#trend-controls .chart-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const days = parseInt(btn.dataset.days);
  const url = days === 0 ? '/dashboard/trend?days=9999' : `/dashboard/trend?days=${days}`;

  try {
    const data = await API.get(url);
    renderTrendChart(data.data);
  } catch (err) {
    showToast('加载趋势数据失败', 'error');
  }
};


/**
 * 热量概览
 */
function renderCalorieSummary(summary) {
  const el = document.getElementById('calorie-summary');
  if (!el) return;

  if (!summary || (summary.total_calories_in === 0 && summary.total_calories_out === 0)) {
    return;  // 保留默认空状态
  }

  const calIn = summary.total_calories_in || 0;
  const calOut = summary.total_calories_out || 0;
  const net = calIn - calOut;

  el.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; text-align:center;">
      <div>
        <div style="font-size:0.85rem; color:var(--ink-secondary); margin-bottom:4px;">摄入</div>
        <div style="font-size:1.8rem; font-weight:700; color:var(--color-warning);">${calIn}</div>
        <div style="font-size:0.8rem; color:var(--ink-tertiary);">kcal</div>
      </div>
      <div>
        <div style="font-size:0.85rem; color:var(--ink-secondary); margin-bottom:4px;">消耗</div>
        <div style="font-size:1.8rem; font-weight:700; color:var(--color-success);">${calOut}</div>
        <div style="font-size:0.8rem; color:var(--ink-tertiary);">kcal</div>
      </div>
    </div>
    <div style="text-align:center; margin-top:16px; padding-top:12px; border-top:2px dashed var(--grid-line);">
      <span style="font-size:0.85rem; color:var(--ink-secondary);">净摄入</span>
      <span style="font-size:1.2rem; font-weight:700; color:${net > 0 ? 'var(--color-danger)' : 'var(--color-success)'}; margin-left:8px;">
        ${net > 0 ? '+' : ''}${net} kcal
      </span>
    </div>
  `;
}


/**
 * AI 快报
 */
function renderAiBrief(analysis) {
  const el = document.getElementById('ai-brief');
  if (!el || !analysis) return;

  // 显示最新分析摘要
  const time = analysis.created_at ? analysis.created_at.slice(11, 16) : '';
  let content = analysis.analysis_text || '';
  // 截断到 200 字
  if (content.length > 200) content = content.slice(0, 200) + '...';

  el.innerHTML = `
    <div class="analysis-card" style="margin-bottom:0;">
      <div class="analysis-time">🕐 ${time} · ${analysis.model_used || 'AI'}</div>
      <div class="analysis-content" style="font-size:0.9rem;">${escapeHtml(content)}</div>
      <div style="margin-top:12px; text-align:right;">
        <button class="btn btn-sm" onclick="navigateTo('analysis')">查看详情 →</button>
      </div>
    </div>
  `;
}


/**
 * 销毁图表实例
 */
function destroyCharts() {
  if (_todayChart) { _todayChart.destroy(); _todayChart = null; }
  if (_trendChart) { _trendChart.destroy(); _trendChart = null; }
}
