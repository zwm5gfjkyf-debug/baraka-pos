// =============================
// BARAKA POS MAIN ENGINE
// =============================
let salesCache = null
let analyticsLoaded = false
let currentShopId = null
let dashboardSalesCache = []
let dashboardListener = null
// =============================
// AUTH STATE
// =============================

auth.onAuthStateChanged(user => {

    const loading = document.getElementById("loadingScreen")

    if(loading) loading.classList.add("hidden")

    if(user){

currentShopId = user.uid
window.currentShopId = user.uid
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
loadCurrentStock() // 🔥 ADD THIS

if(typeof loadLowStock === "function"){
    loadLowStock()
}

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


if(dashboardListener){
dashboardListener()
dashboardListener = null
}
dashboardListener = salesRef
.orderBy("createdAt","desc")
.limit(100)
.onSnapshot(salesSnapshot => {
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

salesSnapshot.forEach(doc=>{

const sale = doc.data()
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

const time = date.toLocaleTimeString('uz-UZ', {
hour:'2-digit',
minute:'2-digit',
hour12:false
})

chartLabels.push(time)
chartValues.push(runningTotal)

// Profit only from real product sales
// Profit only from CASH sales
// Count sold products (cash + debt)
if(sale.items && (sale.type === "cash" || sale.type === "debt")){

sale.items.forEach(item=>{

const qty = item.qty || 0

todayItems += qty

})

}

// Profit only from CASH sales
if(sale.items && sale.type === "cash"){

sale.items.forEach(item=>{

const qty = item.qty || 0
const price = item.price || 0
const cost = item.cost || 0

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

    try{

        const salesRef = db
        .collection("shops")
        .doc(currentShopId)
        .collection("sales")

        const batch = db.batch()

        offline.forEach(sale=>{
    const id = sale.localId || Date.now() + "_" + Math.random()
    const ref = salesRef.doc(id)

    batch.set(ref, {
        ...sale,
        synced: true
    })
})

        await batch.commit()

        localStorage.removeItem("offlineSales")

        showTopBanner("Offline savdolar yuklandi", "success")

    }catch(e){

        showTopBanner("Offline sync xato", "error")

    }

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

showTopBanner("Barcha ma'lumotlar o'chirildi", "success")
}

// =============================
// SIDEBAR CONTROL
// =============================

function openSidebar(){
  document.getElementById("sidebar").classList.add("open")
  document.getElementById("sidebarOverlay").classList.add("show")
}

function closeMenu(){
  document.getElementById("sidebar").classList.remove("open")
  document.getElementById("sidebarOverlay").classList.remove("show")
}

// used in HTML (menuClick)
function menuClick(action){
  closeMenu()
  setTimeout(action, 150)
}
// =============================
// CAMERA TOGGLE SYSTEM
// =============================

function toggleCamera(){

  const current = localStorage.getItem("camera") === "true"
  const newValue = !current

  localStorage.setItem("camera", newValue)

  updateCamera()

}
function updateCamera(){

  const enabled = localStorage.getItem("camera") === "true"

  const toggle = document.getElementById("cameraToggle")
  const cameraBtn = document.getElementById("cameraSaleButton")
  const currentPageId = document.querySelector(".page:not(.hidden)")?.id

  // toggle UI
  if(toggle){
    if(enabled){
      toggle.classList.add("active")
    }else{
      toggle.classList.remove("active")
    }
  }

  // show only in sale page
  if(cameraBtn){

    if(enabled && currentPageId === "salePage"){
      cameraBtn.style.display = "block"
    }else{
      cameraBtn.style.display = "none"

      const scanner = document.getElementById("cameraScanner")
      if(scanner){
        scanner.classList.add("hidden")

        if(typeof stopCameraScanner === "function"){
          stopCameraScanner()
        }
      }
    }

  }

}
// run on load

function startCameraScanner(){
  const enabled = localStorage.getItem("camera") === "true"

  if(!enabled){
    showTopBanner("Kamera o‘chirilgan", "error")
    return
  }

  // call REAL scanner from sales.js
  if(window.startCameraScanner){
    window.startCameraScanner()
  }
}

function navigate(pageId){

  // hide all pages
  document.querySelectorAll(".page").forEach(p=>{
    p.classList.add("hidden")
  })

  // show selected page
  const page = document.getElementById(pageId)
  if(page) page.classList.remove("hidden")

  // reset nav
  document.querySelectorAll(".bottom-nav button").forEach(btn=>{
    btn.classList.remove("active")
  })

  // match navigation
  if(pageId === "dashboardPage"){
    document.querySelector(".bottom-nav button:nth-child(1)").classList.add("active")
  }

  if(pageId === "salePage"){
    document.querySelector(".bottom-nav button:nth-child(2)").classList.add("active")
  }

  if(pageId === "stockPage"){
    document.querySelector(".bottom-nav button:nth-child(3)").classList.add("active")
  }

  // 🔥 FIX: ALL analytics-related pages
  if(
    pageId === "analyticsPage" ||
    pageId === "salesAnalyticsPage" ||
    pageId === "debtAnalyticsPage" ||
    pageId === "shopAnalyticsPage"
  ){
    document.querySelector(".bottom-nav button:nth-child(4)").classList.add("active")
  }

  updateCamera()
 const backBtn = document.getElementById("backBtn")

if(backBtn){

 if(
  pageId === "salesAnalyticsPage" ||
  pageId === "debtAnalyticsPage" ||
  pageId === "shopAnalyticsPage" ||
  pageId === "addProductPage"
){
    backBtn.classList.remove("hidden")
  }else{
    backBtn.classList.add("hidden")
  }

}
}

function goBack(){
  navigate("stockPage")
}
function formatNumberInput(input){

  let value = input.value.replace(/\s/g, '') // remove spaces

  if(value === "") return

  // allow only numbers
  value = value.replace(/\D/g, '')

  // format with spaces
  value = value.replace(/\B(?=(\d{3})+(?!\d))/g, " ")

  input.value = value
}
