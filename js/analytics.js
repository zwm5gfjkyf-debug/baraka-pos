
// ===============================
// BARAKA POS ANALYTICS SYSTEM
// ===============================

let weeklyChart = null;

async function loadWeeklyAnalytics(){

if(!currentShopId) return

const salesRef = db
.collection("shops")
.doc(currentShopId)
.collection("sales")

const snapshot = await salesRef.get()

let weekRevenue = 0
let weekItems = 0
let weekProfit = 0

const now = new Date()

const weekStart = new Date(now)
weekStart.setDate(now.getDate() - now.getDay())

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

weekRevenue += sale.total

const day = date.getDay()

chartTotals[day] += sale.total

if(sale.items){

sale.items.forEach(item=>{

const qty = item.qty || 0
const price = item.price || 0
const cost = item.cost || 0

weekItems += qty
weekProfit += (price-cost)*qty

})

}

}

})

document.getElementById("weekRevenue").innerText = formatMoney(weekRevenue)
document.getElementById("weekItems").innerText = weekItems
document.getElementById("weekProfit").innerText = formatMoney(weekProfit)

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

const salesRef = db
.collection("shops")
.doc(currentShopId)
.collection("sales")

const snapshot = await salesRef.get()

let monthRevenue = 0
let monthItems = 0
let monthProfit = 0

const months = ["Yan","Fev","Mar","Apr","May","Iyun","Iyul","Avg","Sen","Okt","Noy","Dek"]

const chartTotals = new Array(12).fill(0)

snapshot.forEach(doc=>{

const sale = doc.data()

let date

if(sale.createdAt?.seconds){
date = new Date(sale.createdAt.seconds*1000)
}else{
date = new Date(sale.createdAt)
}

const month = date.getMonth()

chartTotals[month] += sale.total || 0

const now = new Date()

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
if(sale.items){

sale.items.forEach(item=>{

const qty = item.qty || 0
const price = item.price || 0
const cost = item.cost || 0

monthItems += qty
monthProfit += (price-cost)*qty

})

}

})

document.getElementById("monthRevenue").innerText = formatMoney(monthRevenue)
document.getElementById("monthItems").innerText = monthItems
document.getElementById("monthProfit").innerText = formatMoney(monthProfit)

renderMonthlyChart(months, chartTotals)

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

// ===============================
// LOAD ANALYTICS
// ===============================
async function loadDebtAnalytics(){

const container = document.querySelector("#debtAnalyticsPage #debtAnalyticsList")

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

snapshot.forEach(doc => {

const d = doc.data()

let totalItems = 0

d.items.forEach(i=>{
totalItems += i.qty
})

const div = document.createElement("div")

div.className = "dashboard-card glass"

div.innerHTML = `
<h3>${d.customer}</h3>
<p>Mahsulotlar soni: ${totalItems}</p>
<p>Jami nasiya: ${formatMoney(d.total)}</p>
<p>Qolgan qarz: ${formatMoney(d.remaining)}</p>
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
