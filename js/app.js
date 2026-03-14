// =============================
// BARAKA POS MAIN ENGINE
// =============================
let salesCache = null
let analyticsLoaded = false
let currentShopId = null
let dashboardSalesCache = []
let dashboardListener = null
window.currentShopId = null
// =============================
// AUTH STATE
// =============================

auth.onAuthStateChanged(user => {

    const loading = document.getElementById("loadingScreen")

    if(loading) loading.classList.add("hidden")

    if(user){

        currentShopId = user.uid

        document
            .getElementById("authScreen")
            .classList.add("hidden")

        document
            .getElementById("appScreen")
            .classList.remove("hidden")

        const emailBox = document.getElementById("profileEmail")

        if(emailBox){
            emailBox.innerText = user.email
        }

loadProducts()
loadDashboard()

setTimeout(()=>{
    if(typeof loadLowStock === "function"){
        loadLowStock()
    }
},300)

syncOfflineSales()
    }
    else{

        document
            .getElementById("appScreen")
            .classList.add("hidden")

        document
            .getElementById("authScreen")
            .classList.remove("hidden")

    }

})



// =============================
// DASHBOARD
// =============================

async function loadDashboard(){

if(!currentShopId) return

const salesRef = db
.collection("shops")
.doc(currentShopId)
.collection("sales")


if(dashboardListener) dashboardListener()

dashboardListener = salesRef.onSnapshot(salesSnapshot => {
let todayRevenue = 0
let todayItems = 0
let todayProfit = 0
let todayDebt = 0

const now = new Date()

const todayStart = new Date(
now.getFullYear(),
now.getMonth(),
now.getDate()
)

const chartLabels = []
const chartValues = []

let runningTotal = 0

chartLabels.push("0")
chartValues.push(0)

dashboardSalesCache = []

salesSnapshot.forEach(doc=>{
dashboardSalesCache.push(doc.data())
})



dashboardSalesCache.forEach(sale=>{

let date

if(sale.createdAt?.seconds){
date = new Date(sale.createdAt.seconds * 1000)
}else{
date = new Date(sale.createdAt)
}

if(date >= todayStart){

// Only cash sales increase revenue
if(sale.type === "cash"){

todayRevenue += sale.total || 0
runningTotal += sale.total || 0

}

// Debt payments also increase revenue
if(sale.type === "debt_payment"){

todayRevenue += sale.total || 0
runningTotal += sale.total || 0

}
// If it IS debt, count as debt
if(sale.type === "debt"){
todayDebt += sale.total || 0
}

if(sale.type === "debt_payment"){
todayDebt -= sale.total || 0
}

const time = date.toLocaleTimeString([], {
hour:'2-digit',
minute:'2-digit'
})

chartLabels.push(time)
chartValues.push(runningTotal)

// Profit only from real product sales
// Profit only from CASH sales
if(sale.items && sale.type === "cash"){

sale.items.forEach(item=>{

const qty = item.qty || 0
const price = item.price || 0
const cost = item.cost || 0

todayItems += qty
todayProfit += (price - cost) * qty

})

}

// Profit from debt payments
if(sale.type === "debt_payment"){

todayProfit += sale.profitPart || 0

}

}

})



const rev = document.getElementById("todayRevenue")
const items = document.getElementById("todayItems")
const profit = document.getElementById("todayProfit")
const debt = document.getElementById("todayDebt")

if(rev) rev.innerText = formatMoney(todayRevenue)
if(items) items.innerText = todayItems
if(profit) profit.innerText = formatMoney(todayProfit)
if(debt) debt.innerText = formatMoney(todayDebt)

if(typeof renderTodaySalesChart === "function"){
renderTodaySalesChart({
labels: chartLabels,
values: chartValues
})
}

})



}
// ===============================
// SYNC OFFLINE SALES
// ===============================

async function syncOfflineSales(){

    if(!currentShopId) return

    const offline = JSON.parse(localStorage.getItem("offlineSales") || "[]")

    if(offline.length === 0) return

  const salesRef = db
.collection("shops")
.doc(currentShopId)
.collection("sales")
.orderBy("createdAt")
  const batch = db.batch()

offline.forEach(sale=>{
const ref = salesRef.doc()
batch.set(ref,sale)
})

await batch.commit()

    localStorage.removeItem("offlineSales")

}



// ===============================
// DELETE SHOP DATA
// ===============================

async function deleteAllShopData(){

    if(!currentShopId) return

    const confirmDelete = prompt("DELETE deb yozing")

    if(confirmDelete !== "DELETE") return

    const shopRef = db.collection("shops").doc(currentShopId)

    const collections = ["sales","debts","products"]

    for(const col of collections){

        const snapshot = await shopRef.collection(col).get()

        for(const doc of snapshot.docs){
            await doc.ref.delete()
        }

    }

    alert("Barcha ma'lumotlar o'chirildi")

}
