
// ===============================
// BARAKA POS ANALYTICS SYSTEM
// ===============================

let weeklyChart = null;

async function loadWeeklyAnalytics(){

if(!currentShopId) return

const now = new Date()

const weekStart = new Date()
weekStart.setHours(0,0,0,0)
weekStart.setDate(weekStart.getDate() - weekStart.getDay())

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


const days = ["Yak","Dush","Sesh","Chor","Pay","Jum","Shan"]

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

weekRevenue += sale.total || 0
const day = date.getDay()

chartTotals[day] += sale.total || 0

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

weeklyChart = new Chart(ctx,{

type:"bar",

data:{
labels:labels,

datasets:[{

data:values,

backgroundColor:"rgba(34,197,94,0.7)",

borderRadius:8,

barThickness:28

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

chartTotals[day] += sale.total || 0
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

if(monthlyChart){
monthlyChart.destroy()
}

monthlyChart = new Chart(ctx,{

type:"bar",

data:{
labels:labels,

datasets:[{

data:values,

backgroundColor:"rgba(34,197,94,0.7)",

borderRadius:8,

barThickness:26

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
// ===============================
// LOAD ANALYTICS
// ===============================
async function loadDebtAnalytics(){

const container = document.querySelector("#debtAnalyticsPage #debtAnalyticsList")
if(!container) return

container.innerHTML = ""

const snapshot = await db
.collection("shops")
.doc(currentShopId)
.collection("debts")
.get()

if(snapshot.empty){
container.innerHTML = "Nasiya mavjud emas"
return
}

const customers = {}

snapshot.forEach(doc=>{

const d = doc.data()

if(!customers[d.customer]){

customers[d.customer] = {
items:0,
total:0,
remaining:0
}

}

let itemCount = 0

if(d.items){
d.items.forEach(i=>{
itemCount += i.qty || 0
})
}

customers[d.customer].items += itemCount
customers[d.customer].total += d.total || 0
customers[d.customer].remaining += d.remaining || 0

})

Object.entries(customers).forEach(([name,data])=>{
const paid = data.total - data.remaining
const status = data.remaining <= 0
? "To'langan ✅"
: "Qarzdor ⏳"

const div = document.createElement("div")

div.className = "dashboard-card glass"

div.innerHTML = `
<h3>${name}</h3>
<p>Mahsulotlar soni: ${data.items}</p>
<p>Jami nasiya: ${formatMoney(data.total)}</p>
<p>To'langan: ${formatMoney(paid)}</p>
<p>Qolgan qarz: ${formatMoney(data.remaining)}</p>
<p>Status: ${status}</p>
`

container.appendChild(div)

})

}
function openDebtAnalytics(){

document.querySelectorAll(".page").forEach(p=>{
p.classList.add("hidden")
})

document.getElementById("debtAnalyticsPage")
.classList.remove("hidden")

loadDebtAnalytics()

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
const time = date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})

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

// destroy old chart
if(todayChart){
todayChart.destroy()
}

todayChart = new Chart(ctx,{
type:"line",

data:{
labels:data.labels,

datasets:[{

data:data.values,

borderColor:"#22c55e",

backgroundColor:"rgba(34,197,94,0.15)",

fill:true,

tension:0.4,

borderWidth:3,

// only first and last dots
pointRadius:(ctx)=>{
if(ctx.dataIndex===0) return 5
if(ctx.dataIndex===ctx.dataset.data.length-1) return 5
return 0
},

pointBackgroundColor:"#22c55e"

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
font:{size:10}
}
},

y:{
beginAtZero:true,
suggestedMin:0,
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
}

if(tab === "monthly"){
document.getElementById("monthlyAnalytics").classList.remove("hidden")
document.getElementById("monthlyTab").classList.add("active")
}

if(tab === "extra"){
document.getElementById("extraAnalytics").classList.remove("hidden")
document.getElementById("extraTab").classList.add("active")
}

}
