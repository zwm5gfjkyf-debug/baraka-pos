if (typeof Chart === "undefined") {
  console.warn("Chart.js not loaded yet");
}
// ===============================
// BARAKA POS ANALYTICS SYSTEM
// ===============================

let weeklyChart = null;

async function loadWeeklyAnalytics(){

if(!currentShopId) return

const now = new Date()

const now = new Date()

const weekStart = new Date(now)
weekStart.setHours(0,0,0,0)

// 🔥 FIX: Monday as start
const day = weekStart.getDay() // 0=Sun,1=Mon...
const diff = (day === 0 ? -6 : 1 - day)

weekStart.setDate(weekStart.getDate() + diff)
const salesRef = db
.collection("shops")
.doc(currentShopId)
.collection("sales")

const snapshot = await salesRef
.where("createdAt", ">=", weekStart)
.orderBy("createdAt")
.get()
   
let weekRevenue = 0
let weekItems = 0
let weekProfit = 0


const days = ["Dush","Sesh","Chor","Pay","Jum","Shan","Yak"]
const chartTotals = [0,0,0,0,0,0,0]

snapshot.forEach(doc=>{

const sale = doc.data()

let date

if(sale.createdAt?.seconds){
date = new Date(sale.createdAt.seconds*1000)
}else{
date = new Date(sale.createdAt)
}

if(date >= weekStart){

if(sale.type !== "debt"){
  weekRevenue += sale.total || 0
}
let dayIndex = date.getDay()

// 🔥 convert to Monday-first index
dayIndex = (dayIndex === 0) ? 6 : dayIndex - 1

chartTotals[dayIndex] += sale.total || 0
if(!sale.items) return

sale.items.forEach(item=>{

const qty = item.qty || 0
const price = item.price || 0
const cost = item.cost || 0

weekItems += qty
weekProfit += (price-cost)*qty

})

}

})

const rev = document.getElementById("weekRevenue")
const items = document.getElementById("weekItems")
const profit = document.getElementById("weekProfit")

if(rev) rev.innerText = formatMoney(weekRevenue)
if(items) items.innerText = weekItems
if(profit) profit.innerText = formatMoney(weekProfit)

renderWeeklyChart(days, chartTotals)

}

function renderWeeklyChart(labels, values){

const ctx = document.getElementById("weeklySalesChart")
if(!ctx) return

if(weeklyChart){
weeklyChart.destroy()
}

const isLight = document.body.classList.contains("light-mode")

const barColor = isLight
? "rgba(37,99,235,0.7)"
: "rgba(34,197,94,0.7)"

weeklyChart = new Chart(ctx,{

type:"line",
data:{
labels:labels,

datasets:[{
  data: values,

  borderColor: "#2563eb",
  backgroundColor: "rgba(37,99,235,0.15)",

  fill: true,
  tension: 0.4,

  pointRadius: 0,
  pointHoverRadius: 5
}]

},

options:{
responsive:true,
maintainAspectRatio:false,

plugins:{
legend:{display:false}
},

scales:{

x:{
grid:{display:false},
ticks:{
color:"#9aa4b2",
font:{size:11}
}
},

y:{
beginAtZero:true,
grid:{color:"rgba(255,255,255,0.05)"},
ticks:{
color:"#9aa4b2",
font:{size:10}
}
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

function renderTodaySalesChart(data){

const ctx = document.getElementById("todaySalesChart")
if(!ctx) return

  // 🔥 PERFORMANCE: update instead of destroy
  if(todayChart){
    todayChart.data.labels = data.labels
    todayChart.data.datasets[0].data = data.values
    todayChart.update()
    return
  }

  // 🔥 BLUE GRADIENT
  const gradient = ctx.getContext("2d").createLinearGradient(0,0,0,220)
  gradient.addColorStop(0, "rgba(37,99,235,0.35)")
  gradient.addColorStop(1, "rgba(37,99,235,0.02)")

  todayChart = new Chart(ctx,{

    type:"line",

    data:{
      labels: data.labels,

      datasets:[{

        data: data.values,

 borderColor: "#16a34a",
backgroundColor: "rgba(34,197,94,0.15)",

        fill: true,
        tension: 0.4,
        borderWidth: 3,

        // 🔥 ONLY LAST POINT
        pointRadius: (ctx)=>{
          return ctx.dataIndex === data.values.length - 1 ? 5 : 0
        },

pointBackgroundColor: "#16a34a"      }]
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
            color:"#9aa4b2",
            font:{ size:10 }
          }
        },

        y:{
          beginAtZero:true,

          grid:{
            color:"rgba(0,0,0,0.05)"
          },

          ticks:{
            color:"#9aa4b2",
            font:{ size:10 },

            // 🔥 FORMAT NUMBERS (1.2M, 500k)
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
