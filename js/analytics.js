if (typeof Chart === "undefined") {
  console.warn("Chart.js not loaded yet");
}
// ===============================
// BARAKA POS ANALYTICS SYSTEM
// ===============================

let weeklyChart = null;

// ===============================
// REAL-TIME WEEKLY ANALYTICS
// ===============================

let weeklyListener = null
// 🔥 NUMBER FORMATTING FUNCTIONS
function formatNumber(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(2).replace(/\.?0+$/, '') + ' mln so\'m';
  if (value >= 1000) return Math.round(value / 1000) + 'k';
  return value.toLocaleString('uz-UZ') + ' so\'m';
}

function formatNumberShort(value) {
  // For chart labels only
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
  if (previous === 0) return 100; // new data, show +100% not +Infinity
  return Math.round(((current - previous) / previous) * 100);
}

// 🔥 WEEK CALCULATION
function getWeekStart(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - (offsetWeeks * 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// 🔥 GET DAY INDEX (Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6)
function getDayIndex(timestamp) {
  const date = timestamp.toDate();
  const day = date.getDay(); // 0=Sun
  return day === 0 ? 6 : day - 1; // convert to Mon=0...Sun=6
}

// 🔥 FORMAT DATE RANGE
function formatDateRange(start, end) {
  const months = ['Jan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
  const endDate = new Date(end);
  endDate.setDate(endDate.getDate() - 1); // end is exclusive
  return `${start.getDate()}-${endDate.getDate()} ${months[start.getMonth()]}`;
}

// 🔥 LOAD WEEKLY ANALYTICS - COMPLETE REWRITE
async function loadWeeklyAnalytics() {
  if (!currentShopId) return;

  // Show loading state
  showWeeklyLoading();

  try {
    // Calculate time ranges
    const thisWeekStart = getWeekStart(0);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 7);

    const lastWeekStart = getWeekStart(1);
    const lastWeekEnd = new Date(thisWeekStart); // last week ends where this week starts

    // Fetch data
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

    // Convert to arrays
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

    // 4. Average check (per transaction, NOT per item)
    const salesCount = thisWeekDocs.length;
    const averageCheck = salesCount > 0 ? Math.round(weeklyRevenue / salesCount) : 0;

    // 5. Percentage changes
    const revenueChange = calcPercent(weeklyRevenue, lastWeekRevenue);
    const profitChange = calcPercent(weeklyProfit, lastWeekProfit);

    // 6. Daily breakdown for chart
    const thisDailyTotals = [0, 0, 0, 0, 0, 0, 0]; // Mon to Sun
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

    // 10. Date range label
    const dateRangeLabel = formatDateRange(thisWeekStart, thisWeekEnd);

    // Update UI
    updateWeeklyUI({
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
  // Stats cards
  document.querySelectorAll('.stat-card-new').forEach(card => {
    card.classList.add('skeleton-new');
    card.innerHTML = '<div style="height:60px;"></div>';
  });

  // Chart
  const chartContainer = document.getElementById('weeklyChartContainerNew');
  if (chartContainer) {
    chartContainer.classList.add('skeleton-new');
    chartContainer.innerHTML = '';
  }

  // Products
  const productsList = document.getElementById('topProductsListNew');
  if (productsList) {
    productsList.innerHTML = `
      <div class="product-item-new skeleton-new"></div>
      <div class="product-item-new skeleton-new"></div>
      <div class="product-item-new skeleton-new"></div>
    `;
  }

  // Summary
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
function updateWeeklyUI(data) {
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

  // Remove loading state
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

  // Remove loading states
  document.querySelectorAll('.skeleton-new').forEach(el => {
    el.classList.remove('skeleton-new');
  });
}

// 🔥 RENDER WEEKLY CHART - COMPLETE REWRITE
function renderWeeklyChartNew(thisWeek, lastWeek) {
  const ctx = document.getElementById('weeklySalesChartNew');
  if (!ctx) return;

  // Destroy existing chart
  if (window.weeklyChartNew) {
    window.weeklyChartNew.destroy();
  }

  const labels = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
  const maxAllDays = Math.max(...thisWeek, ...lastWeek) || 1;
  const barHeight = 80; // px

  // Create bars data
  const barsData = [];
  for (let i = 0; i < 7; i++) {
    const lastWeekValue = lastWeek[i] || 0;
    const thisWeekValue = thisWeek[i] || 0;

    // Calculate heights (minimum 3px for visibility)
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

  // Create HTML bars
  const chartHTML = `
    <div style="display:flex; align-items:flex-end; justify-content:space-between; height:100%; padding:20px 10px;">
      ${barsData.map((data, index) => `
        <div style="display:flex; flex-direction:column; align-items:center; flex:1; max-width:40px;">
          <!-- This week bar (top) -->
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

          <!-- Last week bar (bottom) -->
          <div style="
            width:12px;
            height:${data.lastWeekHeight}px;
            background:#BBDEFB;
            border-radius:0 0 2px 2px;
          " title="${formatNumberShort(data.lastWeek)}">
          </div>

          <!-- Day label -->
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

// 🔥 UPDATE DATE RANGE IN MOBILE HEADER
function updateDateRange(){
  // This is now handled in updateWeeklyUI
}

// Last week same time range
const lastWeekStart = new Date(weekStart)
lastWeekStart.setDate(lastWeekStart.getDate() - 7)
const lastWeekEnd = new Date(lastWeekStart)
lastWeekEnd.setDate(lastWeekEnd.getDate() + 7)

// 🔥 REAL-TIME LISTENER (only needed data)
const salesRef = db.collection("shops").doc(currentShopId).collection("sales")

weeklyListener = salesRef
.where("createdAt", ">=", lastWeekStart)
.orderBy("createdAt")
.onSnapshot((snapshot) => {

  // 🔥 RESET CACHE
  weeklyCache = {
    thisWeekRevenue: 0,
    thisWeekProfit: 0,
    thisWeekItems: 0,
    thisWeekSalesCount: 0,
    lastWeekRevenue: 0,
    thisWeekByDay: [0,0,0,0,0,0,0],
    lastWeekByDay: [0,0,0,0,0,0,0],
    topProducts: {},
    bestDay: null,
    averageDaily: 0
  }

  snapshot.forEach(doc => {
    const sale = doc.data()
    let date

    // 🔥 SAFE DATE PARSING
    if(sale.createdAt?.seconds){
      date = new Date(sale.createdAt.seconds * 1000)
    } else if(sale.createdAt instanceof Date){
      date = sale.createdAt
    } else {
      date = new Date(sale.createdAt)
    }

    // 🔥 THIS WEEK (until now)
    if(date >= weekStart && date <= now){

      // Revenue (cash + card + debt_payment)
      if(sale.type === "cash" || sale.type === "card" || sale.type === "debt_payment"){
        weeklyCache.thisWeekRevenue += sale.total || 0
      }

      // Sales count
      if(sale.type === "cash" || sale.type === "debt"){
        weeklyCache.thisWeekSalesCount++
      }

      // Items and profit
      if(sale.items && (sale.type === "cash" || sale.type === "card" || sale.type === "debt_payment")){

        sale.items.forEach(item => {
          const qty = item.qty || 0
          const price = item.price || 0
          const cost = item.cost || 0

          weeklyCache.thisWeekItems += qty
          weeklyCache.thisWeekProfit += (price - cost) * qty

          // 🔥 TOP PRODUCTS AGGREGATION
          const productName = item.name || "Noma'lum"
          if(!weeklyCache.topProducts[productName]){
            weeklyCache.topProducts[productName] = {
              quantity: 0,
              revenue: 0
            }
          }
          weeklyCache.topProducts[productName].quantity += qty
          weeklyCache.topProducts[productName].revenue += price * qty
        })
      }

      // 🔥 BY DAY (this week)
      const dayIndex = date.getDay()
      const adjustedIndex = (dayIndex === 0) ? 6 : dayIndex - 1

      if(sale.type === "cash" || sale.type === "card" || sale.type === "debt_payment"){
        weeklyCache.thisWeekByDay[adjustedIndex] += sale.total || 0
      }
    }

    // 🔥 LAST WEEK (same time range)
    if(date >= lastWeekStart && date < lastWeekEnd){

      if(sale.type === "cash" || sale.type === "card" || sale.type === "debt_payment"){
        weeklyCache.lastWeekRevenue += sale.total || 0

        // 🔥 BY DAY (last week)
        const dayIndex = date.getDay()
        const adjustedIndex = (dayIndex === 0) ? 6 : dayIndex - 1
        weeklyCache.lastWeekByDay[adjustedIndex] += sale.total || 0
      }
    }
  })

  // 🔥 CALCULATE DERIVED METRICS
  calculateWeeklyMetrics(now, weekStart)

  // 🔥 UPDATE UI
  updateWeeklyUI()

}, (error) => {
  console.error("Weekly analytics error:", error)
})
}

// 🔥 CALCULATE METRICS
function calculateWeeklyMetrics(now, weekStart){

  // Best day (this week)
  const days = ["Dush","Sesh","Chor","Pay","Jum","Shan","Yak"]
  const maxDayIndex = weeklyCache.thisWeekByDay.indexOf(Math.max(...weeklyCache.thisWeekByDay))
  weeklyCache.bestDay = maxDayIndex >= 0 ? days[maxDayIndex] : null

  // Average daily (this week until now)
  const daysPassed = Math.max(1, Math.ceil((now - weekStart) / (1000 * 60 * 60 * 24)))
  weeklyCache.averageDaily = weeklyCache.thisWeekRevenue / daysPassed

  // Top products (sort and take top 3)
  const sortedProducts = Object.entries(weeklyCache.topProducts)
    .sort(([,a], [,b]) => b.quantity - a.quantity)
    .slice(0, 3)

  weeklyCache.topProducts = sortedProducts
}

// 🔥 INSTANT UI RENDER
function renderWeeklyUI(){

  // Cards with zeros
  const rev = document.getElementById("weekRevenue")
  const items = document.getElementById("weekItems")
  const profit = document.getElementById("weekProfit")
  const avgCheck = document.getElementById("weekAvgCheck")

  if(rev) rev.innerText = formatShortMoney(0)
  if(items) items.innerText = "0"
  if(profit) profit.innerText = formatShortMoney(0)
  if(avgCheck) avgCheck.innerText = formatShortMoney(0)

  // Percentages
  const revPercent = document.getElementById("weekRevenuePercent")
  const profitPercent = document.getElementById("weekProfitPercent")

  if(revPercent){
    revPercent.innerText = "0%"
    revPercent.style.color = "#64748b"
  }
  if(profitPercent){
    profitPercent.innerText = "0%"
    profitPercent.style.color = "#64748b"
  }

  // Chart placeholder
  renderWeeklyChart(["Dush","Sesh","Chor","Pay","Jum","Shan","Yak"], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0])

  // Top products placeholder
  const topProductsEl = document.getElementById("topProductsList")
  if(topProductsEl){
    topProductsEl.innerHTML = `
      <div class="top-product-item">
        <div class="product-info">
          <div class="product-name">Yuklanmo...</div>
          <div class="product-meta">0 dona • 0 so'm</div>
        </div>
        <div class="product-bar">
          <div class="bar-fill" style="width:0%"></div>
        </div>
      </div>
    `
  }

  // Weekly summary placeholder
  const summaryEl = document.getElementById("weeklySummary")
  if(summaryEl){
    summaryEl.innerHTML = `
      <div class="summary-item">
        <span>Jami tushum</span>
        <strong>${formatShortMoney(0)}</strong>
      </div>
      <div class="summary-item">
        <span>Jami foyda</span>
        <strong>${formatShortMoney(0)}</strong>
      </div>
      <div class="summary-item">
        <span>Sotuvlar soni</span>
        <strong>0</strong>
      </div>
      <div class="summary-item">
        <span>Eng yaxshi kun</span>
        <strong>-</strong>
      </div>
      <div class="summary-item">
        <span>O'rtacha kunlik</span>
        <strong>${formatShortMoney(0)}</strong>
      </div>
    `
  }
}

// 🔥 UPDATE UI WITH REAL DATA
function updateWeeklyUI(){

// 🔥 UPDATE DATE RANGE IN HEADER
updateDateRange()

  // Cards
  const rev = document.getElementById("weekRevenue")
  const items = document.getElementById("weekItems")
  const profit = document.getElementById("weekProfit")
  const avgCheck = document.getElementById("weekAvgCheck")

  if(rev) rev.innerText = formatShortMoney(weeklyCache.thisWeekRevenue)
  if(items) items.innerText = weeklyCache.thisWeekItems
  if(profit) profit.innerText = formatShortMoney(weeklyCache.thisWeekProfit)
  if(avgCheck) avgCheck.innerText = formatShortMoney(
    weeklyCache.thisWeekSalesCount > 0 ?
    weeklyCache.thisWeekRevenue / weeklyCache.thisWeekSalesCount : 0
  )

  // Percentages
  const revPercent = document.getElementById("weekRevenuePercent")
  const profitPercent = document.getElementById("weekProfitPercent")

  // Revenue percentage (time-aligned comparison)
  if(revPercent){
    const revDiff = weeklyCache.thisWeekRevenue - weeklyCache.lastWeekRevenue
    let revPct = 0
    if(weeklyCache.lastWeekRevenue > 0){
      revPct = (revDiff / weeklyCache.lastWeekRevenue) * 100
    }

    const sign = revPct >= 0 ? "+" : ""
    const color = revPct >= 0 ? "#22c55e" : "#ef4444"
    revPercent.innerText = `${sign}${revPct.toFixed(0)}%`
    revPercent.style.color = color
  }

  // Update the comparison block percentage
  const weekPercent = document.getElementById("weekPercent")
  if(weekPercent){
    const revDiff = weeklyCache.thisWeekRevenue - weeklyCache.lastWeekRevenue
    let revPct = 0
    if(weeklyCache.lastWeekRevenue > 0){
      revPct = (revDiff / weeklyCache.lastWeekRevenue) * 100
    }

    const sign = revPct >= 0 ? "+" : ""
    const color = revPct >= 0 ? "#22c55e" : "#ef4444"
    weekPercent.innerText = `${sign}${revPct.toFixed(0)}%`
    weekPercent.style.color = color
  }

  // Chart
  renderWeeklyChart(
    ["Dush","Sesh","Chor","Pay","Jum","Shan","Yak"],
    weeklyCache.thisWeekByDay,
    weeklyCache.lastWeekByDay
  )

  // Top products
  updateTopProducts()

  // Weekly summary
  updateWeeklySummary()
}

// 🔥 TOP PRODUCTS
function updateTopProducts(){
  const container = document.getElementById("topProductsList")
  if(!container) return

  if(weeklyCache.topProducts.length === 0){
    container.innerHTML = `
      <div class="top-product-item">
        <div class="product-info">
          <div class="product-name">Ma'lumot yo'q</div>
          <div class="product-meta">Haftada sotuv bo'lmagan</div>
        </div>
        <div class="product-bar">
          <div class="bar-fill" style="width:0%"></div>
        </div>
      </div>
    `
    return
  }

  // Sort by revenue instead of quantity
  const sortedProducts = Object.entries(weeklyCache.topProducts)
    .sort(([,a], [,b]) => b.revenue - a.revenue)
    .slice(0, 3)

  // Find max revenue for progress bar scaling
  const maxRevenue = Math.max(...sortedProducts.map(([,data]) => data.revenue))

  container.innerHTML = sortedProducts.map(([name, data], index) => {
    const percentage = maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0
    const rank = index + 1
    return `
      <div class="top-product-item">
        <div class="product-info">
          <div class="product-rank">#${rank}</div>
          <div class="product-name">${name}</div>
          <div class="product-meta">×${data.quantity} • ${formatShortMoney(data.revenue)}</div>
        </div>
        <div class="product-bar">
          <div class="bar-fill" style="width:${percentage}%"></div>
        </div>
      </div>
    `
  }).join('')
}

// 🔥 WEEKLY SUMMARY
function updateWeeklySummary(){
  const container = document.getElementById("weeklySummary")
  if(!container) return

  container.innerHTML = `
    <div class="summary-item">
      <span>Jami tushum</span>
      <strong>${formatShortMoney(weeklyCache.thisWeekRevenue)}</strong>
    </div>
    <div class="summary-item">
      <span>Jami foyda</span>
      <strong>${formatShortMoney(weeklyCache.thisWeekProfit)}</strong>
    </div>
    <div class="summary-item">
      <span>Sotuvlar soni</span>
      <strong>${weeklyCache.thisWeekSalesCount}</strong>
    </div>
    <div class="summary-item">
      <span>Eng yaxshi kun</span>
      <strong>${weeklyCache.bestDay || '-'}</strong>
    </div>
    <div class="summary-item">
      <span>O'rtacha kunlik</span>
      <strong>${formatShortMoney(weeklyCache.averageDaily)}</strong>
    </div>
  `
}


function renderWeeklyChart(labels, thisWeek, lastWeek){

const ctx = document.getElementById("weeklySalesChart")
if(!ctx) return

if(weeklyChart){
  weeklyChart.destroy()
}

// 🔥 FORMAT NUMBERS FOR LABELS
function formatChartLabel(value){
  if(value >= 1000000){
    return (value/1000000).toFixed(1) + 'm'
  }
  if(value >= 1000){
    return (value/1000).toFixed(0) + 'k'
  }
  return value.toString()
}

weeklyChart = new Chart(ctx,{

type:"bar",

data:{
labels: labels,

datasets:[

// 🔥 LAST WEEK (gray)
{
label: 'O\'tgan hafta',
data: lastWeek,
backgroundColor: "#e2e8f0",
borderRadius: 4,
barThickness: 16,
borderSkipped: false,
order: 1
},

// 🔥 THIS WEEK (blue)
{
label: 'Bu hafta',
data: thisWeek,
backgroundColor: "#3b82f6",
borderRadius: 4,
barThickness: 16,
borderSkipped: false,
order: 2
}

]

},

options:{
responsive:true,
maintainAspectRatio:false,

plugins:{
legend:{ display:false },

tooltip:{ enabled:false },

// 🔥 SHOW VALUES ABOVE BARS (only this week)
datalabels:{
anchor:'end',
align:'top',
offset:4,

formatter:(value, ctx)=>{
// Only show for THIS WEEK bars (dataset index 1)
if(ctx.datasetIndex !== 1) return ''
return formatChartLabel(value)
},

color:'#1e40af',
font:{
weight:'600',
size:11
}
}
},

scales:{

x:{
stacked:false,
grid:{display:false},
border:{display:false},
ticks:{
color:"#64748b",
font:{ size:12 }
}
},

y:{
stacked:false,
beginAtZero:true,
display:false,
grid:{display:false},
ticks:{display:false}
}
},

interaction: {
  mode: 'index',
  intersect: false
},

layout:{
  padding:{ top:20, right:10, bottom:10, left:10 }
}

}

})

// 🔥 UPDATE CHART LEGEND WITH PEAK VALUES
updateChartLegend(thisWeek, lastWeek)

}

// 🔥 ADD PEAK VALUES TO CHART LEGEND
function updateChartLegend(thisWeek, lastWeek){

const thisWeekMax = Math.max(...thisWeek)
const lastWeekMax = Math.max(...lastWeek)

const legendHTML = `
<div class="chart-legend">
  <div class="legend-item">
    <div class="legend-dot current"></div>
    <span class="legend-text">Bu hafta (${formatShortMoney(thisWeekMax)})</span>
  </div>
  <div class="legend-item">
    <div class="legend-dot previous"></div>
    <span class="legend-text">O'tgan hafta (${formatShortMoney(lastWeekMax)})</span>
  </div>
</div>
`

// Find chart header and add legend
const chartHeader = document.querySelector('.chart-header')
if(chartHeader){
  // Remove existing legend if any
  const existingLegend = chartHeader.querySelector('.chart-legend')
  if(existingLegend) existingLegend.remove()

  // Add new legend
  chartHeader.insertAdjacentHTML('beforeend', legendHTML)
}
}

// 🔥 UPDATE DATE RANGE IN MOBILE HEADER
function updateDateRange(){

// Calculate current week range
const now = new Date()
const weekStart = new Date(now)
weekStart.setHours(0,0,0,0)

// Monday start (0 = Sunday, so adjust)
const day = weekStart.getDay()
const diff = (day === 0 ? -6 : 1 - day)
weekStart.setDate(weekStart.getDate() + diff)

const weekEnd = new Date(weekStart)
weekEnd.setDate(weekEnd.getDate() + 6)

// Format dates (DD.MM - DD.MM)
const startStr = weekStart.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })
const endStr = weekEnd.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })
const dateRange = `${startStr} - ${endStr}`

// Update header
const dateRangePill = document.querySelector('.date-range-pill span')
if(dateRangePill){
  dateRangePill.textContent = dateRange
}
}

async function loadDashboardStats(){

if(!currentShopId) return

const start = new Date()
start.setHours(0,0,0,0)

const snapshot = await db
.collection("shops")
.doc(currentShopId)
.collection("sales")
.where("createdAt", ">=", start)
.get()

let revenue = 0
let profit = 0
let items = 0
let debt = 0

snapshot.forEach(doc=>{

const sale = doc.data()

// 🔥 revenue
if(sale.type !== "debt"){
  revenue += sale.total || 0
}

// 🔥 debt
if(sale.type === "debt"){
  debt += sale.total || 0
}

if(!sale.items) return

sale.items.forEach(item=>{
  const qty = item.qty || 0
  const price = item.price || 0
  const cost = item.cost || 0

  items += qty
  profit += (price - cost) * qty
})

})

// 🔥 UPDATE UI
const r = document.getElementById("todayRevenue")
const p = document.getElementById("todayProfit")
const i = document.getElementById("todayItems")
const d = document.getElementById("todayDebt")

if(r) r.innerText = formatMoney(revenue) + " so'm"
if(p) p.innerText = formatMoney(profit) + " so'm"
if(i) i.innerText = items
if(d) d.innerText = formatMoney(debt) + " so'm"

}
async function loadMonthlyAnalytics(){

if(!currentShopId) return

const now = new Date()

const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

const salesRef = db
.collection("shops")
.doc(currentShopId)
.collection("sales")

const snapshot = await salesRef
.where("createdAt", ">=", startOfMonth)
.orderBy("createdAt")
.get()
   
let monthRevenue = 0
let monthItems = 0
let monthProfit = 0

const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()

const labels = []
const chartTotals = []

for(let i=1;i<=daysInMonth;i++){
labels.push(i.toString())
chartTotals.push(0)
}
snapshot.forEach(doc=>{

const sale = doc.data()

let date

if(sale.createdAt?.seconds){
date = new Date(sale.createdAt.seconds*1000)
}else{
date = new Date(sale.createdAt)
}

const day = date.getDate() - 1

if(chartTotals[day] !== undefined && sale.type !== "debt_payment"){
  chartTotals[day] += sale.total || 0
}
if(
date.getMonth() === now.getMonth() &&
date.getFullYear() === now.getFullYear()
){

monthRevenue += sale.total || 0

if(sale.items){

sale.items.forEach(item=>{

const qty = item.qty || 0
const price = item.price || 0
const cost = item.cost || 0

monthItems += qty
monthProfit += (price-cost)*qty

})

}

}
})

const rev = document.getElementById("monthRevenue")
const items = document.getElementById("monthItems")
const profit = document.getElementById("monthProfit")

if(rev) rev.innerText = formatMoney(monthRevenue)
if(items) items.innerText = monthItems
if(profit) profit.innerText = formatMoney(monthProfit)
renderMonthlyChart(labels, chartTotals)
}
let monthlyChart = null

function renderMonthlyChart(labels, values){

  const ctx = document.getElementById("monthlySalesChart")
  if(!ctx) return

  // destroy old chart
  if(monthlyChart){
    monthlyChart.destroy()
  }

  // 🎨 THEME COLOR
  const isLight = document.body.classList.contains("light-mode")

  const barColor = isLight
    ? "rgba(37,99,235,0.7)"   // blue
    : "rgba(34,197,94,0.7)"   // green

  // 🔥 GRADIENT (SAFE)
  const gradient = ctx.getContext("2d").createLinearGradient(0,0,0,220)
  gradient.addColorStop(0, "rgba(37,99,235,0.35)")
  gradient.addColorStop(1, "rgba(37,99,235,0.02)")

  // 🚀 CREATE CHART
  monthlyChart = new Chart(ctx, {

    type: "bar",

    data: {
      labels: labels,

      datasets: [{
        data: values,

        backgroundColor: barColor, // 🔥 use theme color
        borderRadius: 8,

        barThickness: 18,
        maxBarThickness: 20,

        categoryPercentage: 0.7,
        barPercentage: 0.8
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: { display: false }
      },

      scales: {

        x: {
          grid: { display: false },

          ticks: {
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            color: "#9aa4b2",
            font: { size: 11 }
          }
        },

        y: {
          beginAtZero: true,

          grid: {
            color: "rgba(0,0,0,0.05)"
          },

          ticks: {
            color: "#9aa4b2",
            font: { size: 10 },

            callback: function(value){
              if(value >= 1000000){
                return (value / 1000000).toFixed(1) + "M"
              }
              if(value >= 1000){
                return (value / 1000).toFixed(1) + "k"
              }
              return value
            }
          }
        }

      }
    }

  })
}
async function loadTopProducts(){

const container = document.getElementById("topProductsList")

if(!container || !currentShopId) return
const snapshot = await db
.collection("shops")
.doc(currentShopId)
.collection("sales")
.orderBy("createdAt","desc")
.limit(500)
.get()

const stats = {}

container.innerHTML = ""

snapshot.forEach(doc=>{

const sale = doc.data()

if(!sale.items) return

if(sale.type === "debt_payment") return

sale.items.forEach(item=>{

const profit = (item.price - item.cost) * item.qty

   
if(!stats[item.name]){
stats[item.name] = 0
}

stats[item.name] += profit

})

})

const sorted = Object.entries(stats)
.sort((a,b)=>b[1]-a[1])
.slice(0,10)

container.innerHTML = ""

sorted.forEach(p=>{

const div = document.createElement("div")

div.style.display = "flex"
div.style.justifyContent = "space-between"
div.style.padding = "8px 0"

div.innerHTML = `
<span>${p[0]}</span>
<strong>${formatMoney(p[1])}</strong>
`

container.appendChild(div)

})

}
function openShopAnalytics(){

document.querySelectorAll(".page").forEach(p=>{
p.classList.add("hidden")
})

document.getElementById("shopAnalyticsPage")
.classList.remove("hidden")

loadShopAnalytics()

}
async function loadShopAnalytics(){

const snapshot = await db
.collection("shops")
.doc(currentShopId)
.collection("products")
.get()

let totalCost = 0
let totalSell = 0

snapshot.forEach(doc=>{

const p = doc.data()

const stock = p.stock || 0
const cost = p.cost || 0
const price = p.price || 0

totalCost += stock * cost
totalSell += stock * price

})

const potentialProfit = totalSell - totalCost

document.getElementById("inventoryCost").innerText =
formatMoney(totalCost) + " so'm"

document.getElementById("inventorySell").innerText =
formatMoney(totalSell) + " so'm"

document.getElementById("inventoryProfit").innerText =
formatMoney(potentialProfit) + " so'm"

}


function openSalesAnalytics(){

document.querySelectorAll(".page").forEach(p=>{
p.classList.add("hidden")
})

document.getElementById("salesAnalyticsPage")
.classList.remove("hidden")

loadSalesAnalytics()

}
async function loadSalesAnalytics(){

const container = document.getElementById("salesAnalyticsList")
if(!container) return
db
.collection("shops")
.doc(currentShopId)
.collection("sales")
.orderBy("createdAt","desc")
.get()
.then(snapshot=>{

container.innerHTML = ""

snapshot.forEach(doc=>{

const sale = doc.data()

let date

if(sale.createdAt?.seconds){
date = new Date(sale.createdAt.seconds*1000)
}else{
date = new Date(sale.createdAt)
}

const day = date.toLocaleDateString()
const time = date.toLocaleTimeString('uz-UZ', {
hour:'2-digit',
minute:'2-digit',
hour12:false
})
// skip debt payment records
if(sale.type === "debt_payment") return

const type = sale.type === "debt" ? "Nasiya" : "Naqd"

if(!sale.items) return

sale.items.forEach(item=>{

const profit = (item.price - item.cost) * item.qty

const profitPercent = item.cost
? ((item.price - item.cost) / item.cost) * 100
: 0

const percentColor = profitPercent >= 0 ? "#22c55e" : "#ef4444"

const row = document.createElement("tr")

row.innerHTML = `
<td>${item.name}</td>
<td>${type}</td>
<td>${item.qty}</td>
<td>${formatMoney(profit)}</td>

<td style="color:${percentColor};font-weight:600">
${profitPercent.toFixed(0)}%
</td>

<td>${day}</td>
<td>${time}</td>
`

container.appendChild(row)

})
})
}) 
}
function filterSalesTable(){

const search = document
.getElementById("salesSearch")
.value
.toLowerCase()

const rows = document.querySelectorAll("#salesAnalyticsList tr")

rows.forEach(row=>{

const product = row.children[0].innerText.toLowerCase()

if(product.includes(search)){
row.style.display = ""
}else{
row.style.display = "none"
}

})

}
// ===============================
// ANALYTICS CARDS
// ===============================

function renderAnalyticsCards(revenue,profit,sales){

   const container = document.getElementById("analyticsContent")
if(!container) return
    container.innerHTML = `

    <div class="dashboard-card glass">

        <div class="card-title">
        Umumiy tushum
        </div>

        <div class="dashboard-amount">
        ${formatMoney(revenue)} so'm
        </div>

    </div>


    <div class="dashboard-card glass">

        <div class="card-title">
        Umumiy foyda
        </div>

        <div class="dashboard-amount">
        ${formatMoney(profit)} so'm
        </div>

    </div>


    <div class="dashboard-card glass">

        <div class="card-title">
        Savdolar soni
        </div>

        <div class="dashboard-amount">
        ${sales}
        </div>

    </div>

    `;

}



// ===============================
// WEEKLY CHART
// ===============================



// ===============================
// MONTHLY CHART
// ===============================




// ===============================
// TOP PRODUCTS
// ===============================

function renderTopProducts(stats){

    const containerRoot = document.getElementById("analyticsContent");

    if(!containerRoot) return; // prevents crash

    const sorted = Object.entries(stats)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,5);

    const container = document.createElement("div");

    container.className = "card glass";

    let html = "<h3>Eng ko'p sotilgan mahsulotlar</h3>";

    sorted.forEach(p=>{

        html += `
        <div style="display:flex;justify-content:space-between">

        <span>${p[0]}</span>

        <strong>${p[1]}</strong>

        </div>
        `;

    });

    container.innerHTML = html;

    containerRoot.appendChild(container);

}
// ===============================
// LOAD DASHBOARD
// ===============================


let todayChart = null

function formatShortMoney(value){
  if(value >= 1000000){
    const result = value / 1000000
    return Number.isInteger(result) ? `${result} mln` : `${result.toFixed(1)} mln`
  }
  if(value >= 1000){
    const result = value / 1000
    return Number.isInteger(result) ? `${result} ming` : `${result.toFixed(1)} ming`
  }
  return `${value}`
}

function renderTodaySalesChart(data){

const ctx = document.getElementById("todaySalesChart")
if(!ctx || !data || !data.labels || !data.values) return

  // 🔥 PERFORMANCE: update instead of destroy
  if(todayChart && todayChart.data){
    // Filter labels to show only key times (4-6 labels max)
    const filteredLabels = filterChartLabels(data.labels)
    todayChart.data.labels = filteredLabels
    if(todayChart.data.datasets && todayChart.data.datasets[0]){
      todayChart.data.datasets[0].data = data.values
      todayChart.update('none')
    }
    return
  }

  // 🔥 GREEN GRADIENT - Ultra subtle
  const chartHeight = ctx.clientHeight || 320
  const gradient = ctx.getContext("2d").createLinearGradient(0,0,0,chartHeight)
  gradient.addColorStop(0, "rgba(34,197,94,0.2)")
  gradient.addColorStop(0.5, "rgba(34,197,94,0.08)")
  gradient.addColorStop(1, "rgba(34,197,94,0.01)")

  // Filter labels to show only key times
  const filteredLabels = filterChartLabels(data.labels)

  todayChart = new Chart(ctx,{
    type:"line",

    data:{
      labels: filteredLabels,

      datasets:[{

        data: data.values,

        borderColor: "#22c55e",
        backgroundColor: gradient,

        fill: true,
        tension: 0.5,
        borderWidth: 3.5,
        borderCapStyle: 'round',
        borderJoinStyle: 'round',

        // 🔥 ONLY LAST POINT - larger for focus
        pointRadius: (ctx)=>{
          return ctx.dataIndex === data.values.length - 1 ? 7 : 0
        },

        pointHoverRadius: 8,
        pointBackgroundColor: "#22c55e",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 3
      }]
    },

    options:{

      responsive: true,
      maintainAspectRatio: false,

      plugins:{
        legend:{ display:false }
      },

      scales:{

        x:{
          grid:{ display:false },
          ticks:{
            color:"#94a3b8",
            font:{ size:12, weight:'500' },
            autoSkip:false,
            maxRotation:0,
            callback: function(value, index){
              return value
            }
          }
        },

        y:{
          display:false,
          beginAtZero:true,
          grid:{ display:false },
          ticks:{ display:false }
        }

      },

      interaction: {
        intersect: false,
        mode: 'index'
      },

      layout:{
        padding:{ top:16, right:12, bottom:8, left:8 }
      },

      elements: {
        point: {
          hoverRadius: 9
        }
      }

    }

  })

}

// Helper function to filter labels for clean display
function filterChartLabels(labels){
  if(!labels || labels.length < 6) return labels
  
  // Keep first, last, and evenly spaced labels (4-6 total)
  const filtered = []
  const interval = Math.ceil(labels.length / 5)
  
  for(let i = 0; i < labels.length; i += interval){
    filtered.push(labels[i])
  }
  
  // Ensure last label is always included
  if(filtered[filtered.length - 1] !== labels[labels.length - 1]){
    filtered.pop()
    filtered.push(labels[labels.length - 1])
  }
  
  return filtered
}

function filterDebtAnalytics(){

const search = document
.getElementById("debtAnalyticsSearch")
.value
.toLowerCase()

const cards = document.querySelectorAll("#debtAnalyticsList .dashboard-card")

cards.forEach(card=>{

const name = card.querySelector("h3").innerText.toLowerCase()

if(name.includes(search)){
card.style.display = ""
}else{
card.style.display = "none"
}

})

}
function loadLowStock(){

const container = document.getElementById("lowStockList")

if(!container || !currentShopId) return

db
.collection("shops")
.doc(currentShopId)
.collection("products")
.where("stock","<=",5)
.limit(20)
.onSnapshot(snapshot=>{

container.innerHTML = ""

if(snapshot.empty){
container.innerHTML = "Hammasi yetarli"
return
}

snapshot.forEach(doc=>{

const p = doc.data()

const div = document.createElement("div")

div.style.display = "flex"
div.style.justifyContent = "space-between"
div.style.padding = "6px 0"

div.innerHTML = `
<span>${p.name}</span>
<strong style="color:#ef4444">${p.stock} ta qoldi</strong>
`

container.appendChild(div)

})

})

}
function showAnalyticsTab(tab){

// Hide all analytics sections
document.getElementById("weeklyAnalytics").classList.add("hidden")
document.getElementById("monthlyAnalytics").classList.add("hidden")
document.getElementById("extraAnalytics").classList.add("hidden")

// Remove active class from all tab buttons
const tabButtons = document.querySelectorAll('.tab-option')
tabButtons.forEach(button => {
  button.classList.remove('active')
})

if(tab === "weekly"){
  document.getElementById("weeklyAnalytics").classList.remove("hidden")

  // Find and activate the weekly tab button
  const weeklyButton = Array.from(tabButtons).find(button =>
    button.textContent.trim() === 'Haftalik'
  )
  if(weeklyButton) weeklyButton.classList.add('active')

  // Load weekly analytics
  loadWeeklyAnalytics()
}

if(tab === "monthly"){
  document.getElementById("monthlyAnalytics").classList.remove("hidden")

  // Find and activate the monthly tab button
  const monthlyButton = Array.from(tabButtons).find(button =>
    button.textContent.trim() === 'Oylik'
  )
  if(monthlyButton) monthlyButton.classList.add('active')

  // Load monthly analytics
  loadMonthlyAnalytics()
}

if(tab === "extra"){
  document.getElementById("extraAnalytics").classList.remove("hidden")

  // Find and activate the extra tab button
  const extraButton = Array.from(tabButtons).find(button =>
    button.textContent.trim() === 'Boshqa'
  )
  if(extraButton) extraButton.classList.add('active')
}
}
window.showAnalyticsTab = showAnalyticsTab   
function openDebtAnalytics(){

navigate("debtAnalyticsPage")

loadDebtAnalytics()

}
async function loadDebtAnalytics(){

const list = document.getElementById("debtAnalyticsList")
const totalBox = document.getElementById("totalDebtAmount")

list.innerHTML = "<div style='opacity:0.6'>Yuklanmoqda...</div>"
   
let totalDebt = 0
let customers = {}

const snapshot = await db
.collection("shops")
.doc(currentShopId)
.collection("sales")
.get()

snapshot.forEach(doc=>{

const sale = doc.data()

if(sale.type !== "debt" && sale.type !== "debt_payment") return

const name = sale.customer || "Noma'lum"

if(!customers[name]){
customers[name] = {
total:0,
lastDate:sale.createdAt
}
}

if(sale.type === "debt"){
customers[name].total += sale.total
totalDebt += sale.total
}

if(sale.type === "debt_payment"){
customers[name].total -= sale.total
totalDebt -= sale.total
}

if(
sale.createdAt &&
customers[name].lastDate &&
sale.createdAt > customers[name].lastDate
){
customers[name].lastDate = sale.createdAt
}

})


renderDebtCustomers(customers)

totalBox.innerText = totalDebt.toLocaleString()+" so'm"

}
function renderDebtCustomers(customers){

const list = document.getElementById("debtAnalyticsList")

list.innerHTML = ""

Object.keys(customers).forEach(name=>{

const c = customers[name]

const card = document.createElement("div")

card.className = "glass dashboard-card"

card.innerHTML = `

<div style="font-weight:600;font-size:16px">
${name}
</div>

<div style="margin-top:6px;color:#94a3b8">
Qarz: ${c.total.toLocaleString()} so'm
</div>

<div style="font-size:12px;color:#64748b;margin-bottom:10px">
Oxirgi nasiya: ${
c.lastDate?.seconds
? new Date(c.lastDate.seconds * 1000).toLocaleDateString()
: "-"
}
</div>

<input type="number"
placeholder="To'lov miqdori"
id="pay-${name.replace(/\s/g,'_')}"
style="margin-bottom:8px">

<button class="btn-primary"
onclick="reduceDebt('${name}',${c.total})">

To'lov qo'shish

</button>

`

list.appendChild(card)

})

}
async function reduceDebt(customer,total){

const input = document.getElementById(
"pay-"+customer.replace(/\s/g,'_')
)

const btn = input.nextElementSibling

// prevent double click
if(btn.disabled) return
btn.disabled = true

const pay = Number(input.value || 0)
if(!pay || pay <= 0){
showTopBanner("To'lov kiriting", "error")
btn.disabled = false
return
}

if(pay > total){
showTopBanner("To'lov qarzdan katta bo'lishi mumkin emas", "error")
btn.disabled = false
return
}

// find all debt sales for this customer
const snapshot = await db
.collection("shops")
.doc(currentShopId)
.collection("sales")
.where("customer","==",customer)
.where("type","==","debt")
.get()

let totalDebt = 0
let totalCost = 0
let totalProfit = 0

snapshot.forEach(doc=>{
const s = doc.data()
totalDebt += s.total || 0
totalCost += s.totalCost || 0
totalProfit += s.totalProfit || 0
})

// calculate ratios
const costRatio = totalDebt ? totalCost / totalDebt : 0
const profitRatio = totalDebt ? totalProfit / totalDebt : 0

const costPart = pay * costRatio
const profitPart = pay * profitRatio

try{

await db
.collection("shops")
.doc(currentShopId)
.collection("sales")
.add({

type: "debt_payment",
customer: customer,
total: pay,
costPart: costPart,
profitPart: profitPart,
createdAt: firebase.firestore.FieldValue.serverTimestamp()

})

input.value = ""

loadDebtAnalytics()

showTopBanner("To'lov qo'shildi", "success")

}catch(e){

showTopBanner("Xatolik yuz berdi", "error")

}

btn.disabled = false

}
document.addEventListener("DOMContentLoaded", () => {

  // ❌ DISABLED (conflicts with real-time system)

  // loadTodayAnalytics()
  // loadDashboardStats()

})
