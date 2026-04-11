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
let weeklyCache = {
  thisWeekRevenue: 0,
  thisWeekProfit: 0,
  thisWeekItems: 0,
  thisWeekSalesCount: 0,
  lastWeekRevenue: 0,
  thisWeekByDay: [0,0,0,0,0,0,0],
  lastWeekByDay: [0,0,0,0,0,0,0],
  topProducts: [],
  bestDay: null,
  averageDaily: 0,
  revenueChange: 0,
  profitChange: 0,
  dateRangeLabel: ""
}

function calcPercent(current, previous) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value}%`;
}

function getWeekStart(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - (offsetWeeks * 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getDayIndex(timestamp) {
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDateRange(start, end) {
  const months = ['Jan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
  const endDate = new Date(end);
  endDate.setDate(endDate.getDate() - 1);
  return `${start.getDate()}-${endDate.getDate()} ${months[start.getMonth()]}`;
}

async function loadWeeklyAnalytics(){
  if (!currentShopId) return;

  renderWeeklyUI();

  const thisWeekStart = getWeekStart(0);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 7);
  const lastWeekStart = getWeekStart(1);
  const lastWeekEnd = new Date(thisWeekStart);

  try {
    const [thisWeekSnapshot, lastWeekSnapshot] = await Promise.all([
      db.collection('shops').doc(currentShopId).collection('sales')
        .where('createdAt', '>=', Timestamp.fromDate(thisWeekStart))
        .where('createdAt', '<', Timestamp.fromDate(thisWeekEnd))
        .get(),
      db.collection('shops').doc(currentShopId).collection('sales')
        .where('createdAt', '>=', Timestamp.fromDate(lastWeekStart))
        .where('createdAt', '<', Timestamp.fromDate(lastWeekEnd))
        .get()
    ]);

    const thisWeekDocs = thisWeekSnapshot.docs.map(doc => doc.data());
    const lastWeekDocs = lastWeekSnapshot.docs.map(doc => doc.data());

    const weeklyRevenue = thisWeekDocs.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const lastWeekRevenue = lastWeekDocs.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const weeklyProfit = thisWeekDocs.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const lastWeekProfit = lastWeekDocs.reduce((sum, sale) => sum + (sale.profit || 0), 0);

    const productsSold = thisWeekDocs.reduce((sum, sale) => {
      return sum + (sale.items || []).reduce((count, item) => count + (item.quantity || 0), 0);
    }, 0);

    const salesCount = thisWeekDocs.length;
    const averageCheck = salesCount > 0 ? Math.round(weeklyRevenue / salesCount) : 0;
    const revenueChange = calcPercent(weeklyRevenue, lastWeekRevenue);
    const profitChange = calcPercent(weeklyProfit, lastWeekProfit);

    const thisWeekByDay = [0, 0, 0, 0, 0, 0, 0];
    const lastWeekByDay = [0, 0, 0, 0, 0, 0, 0];

    thisWeekDocs.forEach(sale => {
      if (!sale.createdAt) return;
      const idx = getDayIndex(sale.createdAt);
      thisWeekByDay[idx] += sale.total || 0;
    });

    lastWeekDocs.forEach(sale => {
      if (!sale.createdAt) return;
      const idx = getDayIndex(sale.createdAt);
      lastWeekByDay[idx] += sale.total || 0;
    });

    const productMap = {};
    thisWeekDocs.forEach(sale => {
      (sale.items || []).forEach(item => {
        const name = item.name || "Noma'lum mahsulot";
        const quantity = item.quantity || 0;
        const price = item.price || 0;

        if (!productMap[name]) {
          productMap[name] = { name, quantity: 0, revenue: 0 };
        }
        productMap[name].quantity += quantity;
        productMap[name].revenue += price * quantity;
      });
    });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);

    const bestDayIndex = thisWeekByDay.indexOf(Math.max(...thisWeekByDay));
    const dayNames = ['Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba','Yakshanba'];
    const bestDayName = dayNames[bestDayIndex] || '-';
    const bestDayValue = thisWeekByDay[bestDayIndex] || 0;

    const dailyAverage = Math.round(weeklyRevenue / 7);
    const dateRangeLabel = formatDateRange(thisWeekStart, thisWeekEnd);

    weeklyCache = {
      thisWeekRevenue: weeklyRevenue,
      thisWeekProfit: weeklyProfit,
      thisWeekItems: productsSold,
      thisWeekSalesCount: salesCount,
      lastWeekRevenue: lastWeekRevenue,
      thisWeekByDay,
      lastWeekByDay,
      topProducts,
      bestDay: bestDayName,
      averageDaily: dailyAverage,
      revenueChange,
      profitChange,
      dateRangeLabel,
      bestDayValue,
      salesCount
    };

    updateWeeklyUI();
  } catch (error) {
    console.error('Weekly analytics load failed:', error);
    showWeeklyError();
  }
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
  const rev = document.getElementById('weekRevenueNew');
  const items = document.getElementById('weekItemsNew');
  const profit = document.getElementById('weekProfitNew');
  const avgCheck = document.getElementById('weekAvgCheckNew');
  const weekPercent = document.getElementById('weekPercentNew');
  const topProductsEl = document.getElementById('topProductsListNew');
  const summaryEl = document.getElementById('weeklySummaryNew');
  const dateRangeEl = document.getElementById('weekDateRange');

  if (dateRangeEl) dateRangeEl.textContent = '—';
  if (rev) rev.innerText = formatShortMoney(0);
  if (items) items.innerText = '0';
  if (profit) profit.innerText = formatShortMoney(0);
  if (avgCheck) avgCheck.innerText = formatShortMoney(0);

  if (weekPercent) {
    weekPercent.innerText = '+0%';
    weekPercent.classList.remove('negative');
  }

  renderWeeklyChart(
    ['Dush','Sesh','Chor','Pay','Jum','Shan','Yak'],
    [0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0]
  );

  if (topProductsEl) {
    topProductsEl.innerHTML = `
      <div class="product-item-new">
        <div class="product-rank-new">#1</div>
        <div class="product-info-new">
          <div class="product-name-new">Yuklanmoqda...</div>
          <div class="product-details-new">
            <span class="product-quantity-new">×0</span>
            <span class="product-revenue-new">0</span>
          </div>
          <div class="product-progress-new">
            <div class="progress-fill-new" style="width:0%"></div>
          </div>
        </div>
      </div>
    `;
  }

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="summary-row-new">
        <span class="summary-label-new">Jami tushum</span>
        <span class="summary-value-new blue">${formatShortMoney(0)}</span>
      </div>
      <div class="summary-row-new">
        <span class="summary-label-new">Jami foyda</span>
        <span class="summary-value-new profit">${formatShortMoney(0)}</span>
      </div>
      <div class="summary-row-new">
        <span class="summary-label-new">Sotuvlar soni</span>
        <span class="summary-value-new">0 ta</span>
      </div>
      <div class="summary-row-new">
        <span class="summary-label-new">Eng yaxshi kun</span>
        <span class="summary-value-new orange">- — 0k</span>
      </div>
      <div class="summary-row-new">
        <span class="summary-label-new">O'rtacha kunlik</span>
        <span class="summary-value-new">${formatShortMoney(0)}</span>
      </div>
    `;
  }
}

// 🔥 UPDATE UI WITH REAL DATA
function updateWeeklyUI(){
  const dateRangeEl = document.getElementById('weekDateRange');
  if (dateRangeEl) dateRangeEl.textContent = weeklyCache.dateRangeLabel;

  const rev = document.getElementById('weekRevenueNew');
  const items = document.getElementById('weekItemsNew');
  const profit = document.getElementById('weekProfitNew');
  const avgCheck = document.getElementById('weekAvgCheckNew');
  const revPercent = document.getElementById('weekRevenuePercentNew');
  const weekPercent = document.getElementById('weekPercentNew');

  if (rev) rev.innerText = formatShortMoney(weeklyCache.thisWeekRevenue);
  if (items) items.innerText = weeklyCache.thisWeekItems.toLocaleString('uz-UZ');
  if (profit) profit.innerText = formatShortMoney(weeklyCache.thisWeekProfit);
  if (avgCheck) avgCheck.innerText = formatShortMoney(weeklyCache.averageDaily);

  if (revPercent) {
    revPercent.innerText = `${weeklyCache.revenueChange >= 0 ? '↑' : '↓'} ${formatPercent(weeklyCache.revenueChange)} o'tgan haftadan`;
    revPercent.style.color = weeklyCache.revenueChange >= 0 ? '#ffffff' : '#ffffff';
  }

  if (weekPercent) {
    weekPercent.innerText = formatPercent(weeklyCache.revenueChange);
    weekPercent.classList.toggle('negative', weeklyCache.revenueChange < 0);
  }

  renderWeeklyChart(
    ['Dush','Sesh','Chor','Pay','Jum','Shan','Yak'],
    weeklyCache.thisWeekByDay,
    weeklyCache.lastWeekByDay
  );

  document.getElementById('lastWeekPeakNew').textContent = formatShortMoney(Math.max(...weeklyCache.lastWeekByDay));
  document.getElementById('thisWeekPeakNew').textContent = formatShortMoney(Math.max(...weeklyCache.thisWeekByDay));

  updateTopProducts();
  updateWeeklySummary();
}

// 🔥 TOP PRODUCTS
function updateTopProducts(){
  const container = document.getElementById('topProductsListNew');
  if (!container) return;

  if (!weeklyCache.topProducts || weeklyCache.topProducts.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; color:#888; padding:20px;">
        Bu hafta sotuvlar yo'q
      </div>
    `;
    return;
  }

  const maxQuantity = Math.max(...weeklyCache.topProducts.map(product => product.quantity));

  container.innerHTML = weeklyCache.topProducts.map((product, index) => {
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
            <span class="product-revenue-new">${formatShortMoney(product.revenue)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 🔥 WEEKLY SUMMARY
function updateWeeklySummary(){
  const container = document.getElementById('weeklySummaryNew');
  if (!container) return;

  container.innerHTML = `
    <div class="summary-row-new">
      <span class="summary-label-new">Jami tushum</span>
      <span class="summary-value-new blue">${formatShortMoney(weeklyCache.thisWeekRevenue)}</span>
    </div>
    <div class="summary-row-new">
      <span class="summary-label-new">Jami foyda</span>
      <span class="summary-value-new profit">${formatShortMoney(weeklyCache.thisWeekProfit)}</span>
    </div>
    <div class="summary-row-new">
      <span class="summary-label-new">Sotuvlar soni</span>
      <span class="summary-value-new">${weeklyCache.thisWeekSalesCount} ta</span>
    </div>
    <div class="summary-row-new">
      <span class="summary-label-new">Eng yaxshi kun</span>
      <span class="summary-value-new orange">${weeklyCache.bestDay || '-'} — ${formatShortMoney(weeklyCache.bestDayValue || 0)}</span>
    </div>
    <div class="summary-row-new">
      <span class="summary-label-new">O'rtacha kunlik</span>
      <span class="summary-value-new">${formatShortMoney(weeklyCache.averageDaily)}</span>
    </div>
  `;
}


function renderWeeklyChart(labels, thisWeek, lastWeek){
  const ctx = document.getElementById('weeklySalesChartNew');
  if (!ctx) return;

  if (weeklyChart) {
    weeklyChart.destroy();
  }

  weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: "O'tgan hafta",
          data: lastWeek,
          backgroundColor: '#e2e8f0',
          borderRadius: 6,
          barThickness: 16,
          borderSkipped: false,
          order: 1,
        },
        {
          label: 'Bu hafta',
          data: thisWeek,
          backgroundColor: '#2563eb',
          borderRadius: 6,
          barThickness: 16,
          borderSkipped: false,
          order: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          stacked: false,
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#64748b', font: { size: 12 } },
        },
        y: {
          stacked: false,
          beginAtZero: true,
          display: false,
          grid: { display: false },
          ticks: { display: false },
        },
      },
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 12, right: 10, bottom: 10, left: 10 } },
    },
  });
}

function updateChartLegend() {
  return;
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
        pointBorderColor: "#ffffffff",
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
  const tabs = document.querySelectorAll('.tab-option');
  tabs.forEach(button => button.classList.remove('active'));

  const weeklySection = document.getElementById('weeklyAnalytics');
  const monthlySection = document.getElementById('monthlyAnalytics');
  const extraSection = document.getElementById('extraAnalytics');

  if (weeklySection) weeklySection.classList.add('hidden');
  if (monthlySection) monthlySection.classList.add('hidden');
  if (extraSection) extraSection.classList.add('hidden');

  if (tab === 'weekly') {
    if (weeklySection) weeklySection.classList.remove('hidden');
    const weeklyTab = Array.from(tabs).find(button => button.textContent.trim() === 'Haftalik');
    if (weeklyTab) weeklyTab.classList.add('active');
    loadWeeklyAnalytics();
  }

  if (tab === 'monthly') {
    if (monthlySection) monthlySection.classList.remove('hidden');
    const monthlyTab = Array.from(tabs).find(button => button.textContent.trim() === 'Oylik');
    if (monthlyTab) monthlyTab.classList.add('active');
    loadMonthlyAnalytics();
  }

  if (tab === 'extra') {
    if (extraSection) extraSection.classList.remove('hidden');
    const extraTab = Array.from(tabs).find(button => button.textContent.trim() === 'Boshqa');
    if (extraTab) extraTab.classList.add('active');
  }
}
window.showAnalyticsTab = showAnalyticsTab   
function openDebtAnalytics(){
  navigate("debtAnalyticsPage")
}
document.addEventListener("DOMContentLoaded", () => {

  // ❌ DISABLED (conflicts with real-time system)

  // loadTodayAnalytics()
  // loadDashboardStats()

})
