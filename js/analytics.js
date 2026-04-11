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
  averageDaily: 0
}

function loadWeeklyAnalytics(){

if(!currentShopId) return

// 🔥 INSTANT UI RENDER (no delay)
renderWeeklyUI()

// 🔥 DETACH OLD LISTENER
if(weeklyListener){
  weeklyListener()
  weeklyListener = null
}

// 🔥 CALCULATE TIME RANGES
const now = new Date()
const weekStart = new Date(now)
weekStart.setHours(0,0,0,0)

// Monday start (0 = Sunday, so adjust)
const day = weekStart.getDay()
const diff = (day === 0 ? -6 : 1 - day)
weekStart.setDate(weekStart.getDate() + diff)

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

  if(rev) rev.innerText = formatMoney(0)
  if(items) items.innerText = "0"
  if(profit) profit.innerText = formatMoney(0)
  if(avgCheck) avgCheck.innerText = formatMoney(0)

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
        <strong>${formatMoney(0)}</strong>
      </div>
      <div class="summary-item">
        <span>Jami foyda</span>
        <strong>${formatMoney(0)}</strong>
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
        <strong>${formatMoney(0)}</strong>
      </div>
    `
  }
}

// 🔥 UPDATE UI WITH REAL DATA
function updateWeeklyUI(){

  // Cards
  const rev = document.getElementById("weekRevenue")
  const items = document.getElementById("weekItems")
  const profit = document.getElementById("weekProfit")
  const avgCheck = document.getElementById("weekAvgCheck")

  if(rev) rev.innerText = formatMoney(weeklyCache.thisWeekRevenue)
  if(items) items.innerText = weeklyCache.thisWeekItems
  if(profit) profit.innerText = formatMoney(weeklyCache.thisWeekProfit)
  if(avgCheck) avgCheck.innerText = formatMoney(
    weeklyCache.thisWeekSalesCount > 0 ?
    weeklyCache.thisWeekRevenue / weeklyCache.thisWeekSalesCount : 0
  )

  // Percentages
  const revPercent = document.getElementById("weekRevenuePercent")
  const profitPercent = document.getElementById("weekProfitPercent")

  // Revenue percentage
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

  // Profit percentage (same logic)
  if(profitPercent){
    // Note: We don't have last week profit, so we'll show revenue percentage for now
    // In a full implementation, you'd track profit for last week too
    const profitDiff = weeklyCache.thisWeekProfit - (weeklyCache.lastWeekRevenue * 0.1) // Estimate
    let profitPct = 0
    if(weeklyCache.lastWeekRevenue > 0){
      profitPct = (profitDiff / (weeklyCache.lastWeekRevenue * 0.1)) * 100
    }

    const sign = profitPct >= 0 ? "+" : ""
    const color = profitPct >= 0 ? "#22c55e" : "#ef4444"
    profitPercent.innerText = `${sign}${profitPct.toFixed(0)}%`
    profitPercent.style.color = color
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

  // Find max quantity for progress bar scaling
  const maxQty = Math.max(...weeklyCache.topProducts.map(([,data]) => data.quantity))

  container.innerHTML = weeklyCache.topProducts.map(([name, data]) => {
    const percentage = maxQty > 0 ? (data.quantity / maxQty) * 100 : 0
    return `
      <div class="top-product-item">
        <div class="product-info">
          <div class="product-name">${name}</div>
          <div class="product-meta">${data.quantity} dona • ${formatMoney(data.revenue)}</div>
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
      <strong>${formatMoney(weeklyCache.thisWeekRevenue)}</strong>
    </div>
    <div class="summary-item">
      <span>Jami foyda</span>
      <strong>${formatMoney(weeklyCache.thisWeekProfit)}</strong>
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
      <strong>${formatMoney(weeklyCache.averageDaily)}</strong>
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

// 🔥 LAST WEEK (gray background)
{
data: lastWeek,
backgroundColor: "#f1f5f9",
borderRadius: 8,
barThickness: 24,
order: 1
},

// 🔥 THIS WEEK (blue)
{
data: thisWeek,
backgroundColor: (ctx)=>{
const i = ctx.dataIndex
const isLastDay = i === labels.length - 1
return isLastDay ? "#1d4ed8" : "#3b82f6"
},
borderRadius: 8,
barThickness: 24,
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
offset:6,

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
display:false, // 🔥 HIDE Y-AXIS
grid:{display:false},
ticks:{display:false}
}
}

}

})
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

document.getElementById("weeklyAnalytics").classList.add("hidden")
document.getElementById("monthlyAnalytics").classList.add("hidden")
document.getElementById("extraAnalytics").classList.add("hidden")

document.getElementById("weeklyTab").classList.remove("active")
document.getElementById("monthlyTab").classList.remove("active")
document.getElementById("extraTab").classList.remove("active")

if(tab === "weekly"){
document.getElementById("weeklyAnalytics").classList.remove("hidden")
document.getElementById("weeklyTab").classList.add("active")

// 🔥 ADD THIS
loadWeeklyAnalytics()
}

if(tab === "monthly"){
document.getElementById("monthlyAnalytics").classList.remove("hidden")
document.getElementById("monthlyTab").classList.add("active")

// 🔥 ADD THIS
loadMonthlyAnalytics()
}

if(tab === "extra"){
document.getElementById("extraAnalytics").classList.remove("hidden")
document.getElementById("extraTab").classList.add("active")
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
