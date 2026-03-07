
// ===============================
// BARAKA POS ANALYTICS SYSTEM
// ===============================

let weeklyChart = null;
let monthlyChart = null;


// ===============================
// LOAD ANALYTICS
// ===============================

async function loadAnalytics(){

    const salesRef = db
        .collection("shops")
        .doc(currentShopId)
        .collection("sales");

    const snapshot = await salesRef.get();

    let totalRevenue = 0;
    let totalSales = 0;
    let totalProfit = 0;

    const weeklyData = [0,0,0,0,0,0,0];
    const monthlyData = new Array(31).fill(0);

    const productStats = {};

    const startWeek = getStartOfWeek();
    const startMonth = getStartOfMonth();

    snapshot.forEach(doc => {

        const sale = doc.data();

        if(!sale.createdAt) return;

        const date = new Date(sale.createdAt.seconds * 1000);

        totalRevenue += sale.total || 0;

        totalSales++;

        if(sale.items){

           sale.items.forEach(item => {

    const profit =
        ((item.price || 0) - (item.cost || 0)) * (item.qty || 0);

    totalProfit += profit;

    if(!productStats[item.name]){
        productStats[item.name] = 0;
    }

    productStats[item.name] += item.qty;

});
        }

        if(date >= startWeek){

            const day = (date.getDay()+6)%7;

           weeklyData[day] += sale.total || 0;
        }

        if(date >= startMonth){

            const d = date.getDate() - 1;

           monthlyData[d] += sale.total || 0;

        }

    });

    renderAnalyticsCards(totalRevenue,totalProfit,totalSales);

    renderWeeklyChart(weeklyData);

    renderMonthlyChart(monthlyData);

    renderTopProducts(productStats);

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

function renderWeeklyChart(data){

    const ctx = document.getElementById("weeklyChart");

    if(weeklyChart) weeklyChart.destroy();

    weeklyChart = new Chart(ctx,{

        type:"bar",

        data:{
            labels:["Dush","Sesh","Chor","Pay","Jum","Shan","Yak"],
            datasets:[{
                data:data,
                backgroundColor:"rgba(16,185,129,0.7)",
                borderRadius:8
            }]
        },

        options:{
            responsive:true,
            plugins:{
                legend:{display:false}
            }
        }

    });

}



// ===============================
// MONTHLY CHART
// ===============================

function renderMonthlyChart(data){

    const ctx = document.getElementById("monthlyChart");

    if(monthlyChart) monthlyChart.destroy();

    monthlyChart = new Chart(ctx,{

        type:"line",

        data:{
            labels:data.map((_,i)=>i+1),
            datasets:[{
                data:data,
                borderColor:"#10b981",
                backgroundColor:"rgba(16,185,129,0.2)",
                fill:true,
                tension:0.4
            }]
        },

        options:{
            responsive:true,
            plugins:{
                legend:{display:false}
            }
        }

    });

}



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

async function loadDashboard(){

    if(!currentShopId) return

    const salesRef = db
        .collection("shops")
        .doc(currentShopId)
        .collection("sales")

    const snapshot = await salesRef.get()

    let today = 0
    let week = 0
    let month = 0

    const now = new Date()

    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startWeek = new Date(now)
    startWeek.setDate(now.getDate() - now.getDay())

    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    snapshot.forEach(doc => {

        const sale = doc.data()

        if(!sale.createdAt) return

        const date = sale.createdAt.toDate
            ? sale.createdAt.toDate()
            : new Date(sale.createdAt)

        if(date >= startDay){
            today += sale.total || 0
        }

        if(date >= startWeek){
            week += sale.total || 0
        }

        if(date >= startMonth){
            month += sale.total || 0
        }

    })

    document.getElementById("todayRevenue").innerText = formatMoney(today)
    document.getElementById("weekRevenue").innerText = formatMoney(week)
    document.getElementById("monthRevenue").innerText = formatMoney(month)

}
let todayChart = null

function renderTodaySalesChart(data){

const ctx = document.getElementById("todaySalesChart")

if(!ctx) return

new Chart(ctx,{
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

pointRadius:0,

pointHoverRadius:0

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
