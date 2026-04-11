if (typeof Chart === "undefined") {
  console.warn("Chart.js not loaded yet");
}

// ===============================
// BARAKA POS ANALYTICS SYSTEM
// ===============================

let weeklyChart = null;
let weeklyListener = null;

// 🔥 NUMBER FORMATTING FUNCTIONS
function formatNumber(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(2).replace(/\.?0+$/, '') + ' mln so\'m';
  if (value >= 1000) return Math.round(value / 1000) + 'k';
  return value.toLocaleString('uz-UZ') + ' so\'m';
}

function formatNumberShort(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'm';
  if (value >= 1000) return Math.round(value / 1000) + 'k';
  return value.toString();
}

function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value}%`;
}

// 🔥 SAFE PERCENT CALCULATION
function calcPercent(current, previous) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

// 🔥 WEEK CALCULATION
function getWeekStart(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - (offsetWeeks * 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// 🔥 GET DAY INDEX
function getDayIndex(timestamp) {
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

// 🔥 FORMAT DATE RANGE
function formatDateRange(start, end) {
  const months = ['Jan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
  const endDate = new Date(end);
  endDate.setDate(endDate.getDate() - 1);
  return `${start.getDate()}-${endDate.getDate()} ${months[start.getMonth()]}`;
}

// 🔥 LOAD WEEKLY ANALYTICS - COMPLETE REWRITE
async function loadWeeklyAnalytics() {
  if (!currentShopId) return;

  showWeeklyLoading();

  try {
    const thisWeekStart = getWeekStart(0);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 7);

    const lastWeekStart = getWeekStart(1);
    const lastWeekEnd = new Date(thisWeekStart);

    const [thisWeekSnapshot, lastWeekSnapshot] = await Promise.all([
      db.collection('sales')
        .where('createdAt', '>=', Timestamp.fromDate(thisWeekStart))
        .where('createdAt', '<', Timestamp.fromDate(thisWeekEnd))
        .get(),
      db.collection('sales')
        .where('createdAt', '>=', Timestamp.fromDate(lastWeekStart))
        .where('createdAt', '<', Timestamp.fromDate(lastWeekEnd))
        .get()
    ]);

    const thisWeekDocs = thisWeekSnapshot.docs.map(d => d.data());
    const lastWeekDocs = lastWeekSnapshot.docs.map(d => d.data());

    // 1. Weekly revenue
    const weeklyRevenue = thisWeekDocs.reduce((sum, d) => sum + (d.total || 0), 0);
    const lastWeekRevenue = lastWeekDocs.reduce((sum, d) => sum + (d.total || 0), 0);

    // 2. Weekly profit
    const weeklyProfit = thisWeekDocs.reduce((sum, d) => sum + (d.profit || 0), 0);
    const lastWeekProfit = lastWeekDocs.reduce((sum, d) => sum + (d.profit || 0), 0);

    // 3. Products sold count
    const productsSold = thisWeekDocs.reduce((sum, d) => {
      return sum + (d.items || []).reduce((s, item) => s + (item.quantity || 0), 0);
    }, 0);

    // 4. Average check
    const salesCount = thisWeekDocs.length;
    const averageCheck = salesCount > 0 ? Math.round(weeklyRevenue / salesCount) : 0;

    // 5. Percentage changes
    const revenueChange = calcPercent(weeklyRevenue, lastWeekRevenue);
    const profitChange = calcPercent(weeklyProfit, lastWeekProfit);

    // 6. Daily breakdown
    const thisDailyTotals = [0, 0, 0, 0, 0, 0, 0];
    const lastDailyTotals = [0, 0, 0, 0, 0, 0, 0];

    thisWeekDocs.forEach(d => {
      const idx = getDayIndex(d.createdAt);
      thisDailyTotals[idx] += d.total || 0;
    });
    lastWeekDocs.forEach(d => {
      const idx = getDayIndex(d.createdAt);
      lastDailyTotals[idx] += d.total || 0;
    });

    // 7. Top 3 products
    const productMap = {};
    thisWeekDocs.forEach(doc => {
      (doc.items || []).forEach(item => {
        const name = item.name || 'Noma\'lum mahsulot';
        if (!productMap[name]) productMap[name] = { name, quantity: 0, revenue: 0 };
        productMap[name].quantity += item.quantity || 0;
        productMap[name].revenue += (item.price || 0) * (item.quantity || 0);
      });
    });
    const top3 = Object.values(productMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);

    // 8. Best day
    const bestDayIndex = thisDailyTotals.indexOf(Math.max(...thisDailyTotals));
    const dayNames = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
    const bestDayName = dayNames[bestDayIndex];
    const bestDayValue = thisDailyTotals[bestDayIndex];

    // 9. Daily average
    const dailyAverage = Math.round(weeklyRevenue / 7);

    // 10. Date range
    const dateRangeLabel = formatDateRange(thisWeekStart, thisWeekEnd);

    // Update UI
    updateWeeklyUINew({
      weeklyRevenue,
      lastWeekRevenue,
      weeklyProfit,
      lastWeekProfit,
      productsSold,
      averageCheck,
      salesCount,
      revenueChange,
      profitChange,
      thisDailyTotals,
      lastDailyTotals,
      top3,
      bestDayName,
      bestDayValue,
      dailyAverage,
      dateRangeLabel
    });

  } catch (error) {
    console.error('Error loading weekly analytics:', error);
    showWeeklyError();
  }
}

// 🔥 SHOW LOADING STATE
function showWeeklyLoading() {
  document.querySelectorAll('.stat-card-new').forEach(card => {
    card.classList.add('skeleton-new');
    card.innerHTML = '<div style="height:60px;"></div>';
  });

  const chartContainer = document.getElementById('weeklyChartContainerNew');
  if (chartContainer) {
    chartContainer.classList.add('skeleton-new');
    chartContainer.innerHTML = '';
  }

  const productsList = document.getElementById('topProductsListNew');
  if (productsList) {
    productsList.innerHTML = `
      <div class="product-item-new skeleton-new"></div>
      <div class="product-item-new skeleton-new"></div>
      <div class="product-item-new skeleton-new"></div>
    `;
  }

  const summary = document.getElementById('weeklySummaryNew');
  if (summary) {
    summary.innerHTML = `
      <div class="summary-row-new skeleton-new"></div>
      <div class="summary-row-new skeleton-new"></div>
      <div class="summary-row-new skeleton-new"></div>
      <div class="summary-row-new skeleton-new"></div>
      <div class="summary-row-new skeleton-new"></div>
    `;
  }
}

// 🔥 SHOW ERROR STATE
function showWeeklyError() {
  const weeklyAnalytics = document.getElementById('weeklyAnalytics');
  if (weeklyAnalytics) {
    weeklyAnalytics.innerHTML = `
      <div style="text-align:center; padding:40px 20px;">
        <div style="font-size:16px; color:#666; margin-bottom:16px;">
          Ma'lumotlarni yuklashda xato
        </div>
        <button onclick="loadWeeklyAnalytics()" style="
          background:#1976D2;
          color:white;
          border:none;
          padding:12px 24px;
          border-radius:8px;
          font-weight:600;
          cursor:pointer;
        ">
          Qayta urinish
        </button>
      </div>
    `;
  }
}

// 🔥 UPDATE WEEKLY UI - COMPLETE REWRITE
function updateWeeklyUINew(data) {
  const {
    weeklyRevenue,
    lastWeekRevenue,
    weeklyProfit,
    lastWeekProfit,
    productsSold,
    averageCheck,
    salesCount,
    revenueChange,
    profitChange,
    thisDailyTotals,
    lastDailyTotals,
    top3,
    bestDayName,
    bestDayValue,
    dailyAverage,
    dateRangeLabel
  } = data;

  // Update date range
  const dateRangePill = document.querySelector('.date-range-pill span');
  if (dateRangePill) {
    dateRangePill.textContent = dateRangeLabel;
  }

  // Stats cards
  document.getElementById('weekRevenueNew').textContent = formatNumber(weeklyRevenue);
  document.getElementById('weekRevenuePercentNew').textContent =
    `${revenueChange >= 0 ? '↑' : '↓'} ${formatPercent(revenueChange)} o'tgan haftadan`;

  document.getElementById('weekProfitNew').textContent = formatNumber(weeklyProfit);
  document.getElementById('weekProfitPercentNew').textContent = formatPercent(profitChange);

  document.getElementById('weekItemsNew').textContent = productsSold.toLocaleString('uz-UZ');
  document.getElementById('weekAvgCheckNew').textContent = formatNumber(averageCheck);

  document.querySelectorAll('.stat-card-new').forEach(card => {
    card.classList.remove('skeleton-new');
  });

  // Chart
  renderWeeklyChartNew(thisDailyTotals, lastDailyTotals);

  // Peak values
  const lastWeekMax = Math.max(...lastDailyTotals);
  const thisWeekMax = Math.max(...thisDailyTotals);
  document.getElementById('lastWeekPeakNew').textContent = formatNumberShort(lastWeekMax);
  document.getElementById('thisWeekPeakNew').textContent = formatNumberShort(thisWeekMax);

  // Comparison strip
  const weekPercentEl = document.getElementById('weekPercentNew');
  weekPercentEl.textContent = formatPercent(revenueChange);
  weekPercentEl.classList.toggle('negative', revenueChange < 0);

  // Top products
  const productsList = document.getElementById('topProductsListNew');
  if (top3.length === 0) {
    productsList.innerHTML = `
      <div style="text-align:center; color:#888; padding:20px;">
        Bu hafta sotuvlar yo'q
      </div>
    `;
  } else {
    const maxQuantity = Math.max(...top3.map(p => p.quantity));
    productsList.innerHTML = top3.map((product, index) => {
      const progressWidth = maxQuantity > 0 ? (product.quantity / maxQuantity) * 100 : 0;
      return `
        <div class="product-item-new">
          <div class="product-rank-new">#${index + 1}</div>
          <div class="product-info-new">
            <div class="product-name-new">${product.name}</div>
            <div class="product-progress-new">
              <div class="progress-fill-new" style="width:${progressWidth}%"></div>
            </div>
            <div class="product-details-new">
              <span class="product-quantity-new">×${product.quantity}</span>
              <span class="product-revenue-new">${formatNumber(product.revenue)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Weekly summary
  const summary = document.getElementById('weeklySummaryNew');
  summary.innerHTML = `
    <div class="summary-row-new">
      <span class="summary-label-new">Jami tushum</span>
      <span class="summary-value-new blue">${formatNumber(weeklyRevenue)}</span>
    </div>
    <div class="summary-row-new">
      <span class="summary-label-new">Jami foyda</span>
      <span class="summary-value-new profit">${formatNumber(weeklyProfit)}</span>
    </div>
    <div class="summary-row-new">
      <span class="summary-label-new">Sotuvlar soni</span>
      <span class="summary-value-new">${salesCount} ta</span>
    </div>
    <div class="summary-row-new">
      <span class="summary-label-new">Eng yaxshi kun</span>
      <span class="summary-value-new orange">${bestDayName} — ${formatNumberShort(bestDayValue)}</span>
    </div>
    <div class="summary-row-new">
      <span class="summary-label-new">O'rtacha kunlik</span>
      <span class="summary-value-new">${formatNumber(dailyAverage)}</span>
    </div>
  `;

  document.querySelectorAll('.skeleton-new').forEach(el => {
    el.classList.remove('skeleton-new');
  });
}

// 🔥 RENDER WEEKLY CHART
function renderWeeklyChartNew(thisWeek, lastWeek) {
  const ctx = document.getElementById('weeklySalesChartNew');
  if (!ctx) return;

  if (window.weeklyChartNew) {
    window.weeklyChartNew.destroy();
  }

  const labels = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
  const maxAllDays = Math.max(...thisWeek, ...lastWeek) || 1;
  const barHeight = 80;

  const barsData = [];
  for (let i = 0; i < 7; i++) {
    const lastWeekValue = lastWeek[i] || 0;
    const thisWeekValue = thisWeek[i] || 0;

    const lastWeekHeight = Math.max((lastWeekValue / maxAllDays) * barHeight, lastWeekValue > 0 ? 3 : 0);
    const thisWeekHeight = Math.max((thisWeekValue / maxAllDays) * barHeight, thisWeekValue > 0 ? 3 : 0);

    barsData.push({
      day: labels[i],
      lastWeek: lastWeekValue,
      thisWeek: thisWeekValue,
      lastWeekHeight,
      thisWeekHeight
    });
  }

  const chartHTML = `
    <div style="display:flex; align-items:flex-end; justify-content:space-between; height:100%; padding:20px 10px;">
      ${barsData.map((data, index) => `
        <div style="display:flex; flex-direction:column; align-items:center; flex:1; max-width:40px;">
          <div style="
            width:12px;
            height:${data.thisWeekHeight}px;
            background:#1976D2;
            border-radius:2px 2px 0 0;
            margin-bottom:2px;
            position:relative;
          " title="${formatNumberShort(data.thisWeek)}">
            ${data.thisWeek > 0 ? `<div style="
              position:absolute;
              top:-18px;
              left:50%;
              transform:translateX(-50%);
              font-size:10px;
              font-weight:600;
              color:#1976D2;
              white-space:nowrap;
            ">${formatNumberShort(data.thisWeek)}</div>` : ''}
          </div>

          <div style="
            width:12px;
            height:${data.lastWeekHeight}px;
            background:#BBDEFB;
            border-radius:0 0 2px 2px;
          " title="${formatNumberShort(data.lastWeek)}">
          </div>

          <div style="
            margin-top:8px;
            font-size:10px;
            color:${index === new Date().getDay() ? '#1a1a2e' : '#aaa'};
            font-weight:${index === new Date().getDay() ? '600' : '400'};
          ">
            ${data.day}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  ctx.innerHTML = chartHTML;
}

// 🔥 SHOW ANALYTICS TAB
function showAnalyticsTab(tab){
  const tabButtons = document.querySelectorAll('.tab-option');
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });

  document.getElementById("weeklyAnalytics").classList.add("hidden");
  document.getElementById("monthlyAnalytics").classList.add("hidden");
  document.getElementById("extraAnalytics").classList.add("hidden");

  if(tab === "weekly"){
    document.getElementById("weeklyAnalytics").classList.remove("hidden");
    const weeklyButton = Array.from(tabButtons).find(button =>
      button.textContent.trim() === 'Haftalik'
    );
    if(weeklyButton) weeklyButton.classList.add('active');
    loadWeeklyAnalytics();
  }

  if(tab === "monthly"){
    document.getElementById("monthlyAnalytics").classList.remove("hidden");
    const monthlyButton = Array.from(tabButtons).find(button =>
      button.textContent.trim() === 'Oylik'
    );
    if(monthlyButton) monthlyButton.classList.add('active');
    loadMonthlyAnalytics();
  }

  if(tab === "extra"){
    document.getElementById("extraAnalytics").classList.remove("hidden");
    const extraButton = Array.from(tabButtons).find(button =>
      button.textContent.trim() === 'Boshqa'
    );
    if(extraButton) extraButton.classList.add('active');
  }
}

// Placeholder functions (implement as needed)
function loadMonthlyAnalytics() {
  console.log("Loading monthly analytics");
}

async function loadDashboardStats() {
  if(!currentShopId) return;
  console.log("Loading dashboard stats");
}
