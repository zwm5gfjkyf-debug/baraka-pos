// =============================
// BARAKA POS MAIN ENGINE
// =============================
let salesCache = null
let analyticsLoaded = false
let currentShopId = null
window.currentShopId = null
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

const now = new Date()
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

const rev = document.getElementById("todayRevenue")
const items = document.getElementById("todayItems")
const profit = document.getElementById("todayProfit")
const debt = document.getElementById("todayDebt")
const changeEl = document.getElementById("todayRevenueChange")
const profitStatus = document.getElementById("profitStatusText")
const debtStatus = document.getElementById("debtStatusText")
const listEl = document.getElementById("recentSalesList")

if(rev) rev.innerText = formatMoney(0)
if(items) items.innerText = 0
if(profit) profit.innerText = formatMoney(0)
if(debt) debt.innerText = formatMoney(0)
if(changeEl){
  changeEl.innerText = "0% kechagidan"
  changeEl.style.color = "#64748b"
}
if(profitStatus){
  profitStatus.innerText = "Yaxshi ko‘rsatkich"
  profitStatus.style.color = "#16a34a"
}
if(debtStatus){
  debtStatus.innerText = "Qarzdorlik yo‘q"
  debtStatus.style.color = "#16a34a"
}
if(listEl) listEl.innerHTML = ""

const currentTimeLabel = now.toLocaleTimeString('uz-UZ', { hour:'2-digit', minute:'2-digit', hour12:false })
if(typeof renderTodaySalesChart === "function"){
  renderTodaySalesChart({
    labels:["00:00", currentTimeLabel],
    values:[0,0]
  })
}

dashboardListener = salesRef
.where("createdAt", ">=", todayStart)
.orderBy("createdAt")
.onSnapshot((salesSnapshot) => {

let todayRevenue = 0
let todayItems = 0
let todayProfit = 0
let todayDebt = 0

// Buckets for chart (30 min intervals)
const bucketSize = 30 * 60 * 1000 // 30 min
const buckets = []
const startTime = todayStart.getTime()
const endTime = now.getTime()
for(let time = startTime; time <= endTime; time += bucketSize){
buckets.push({ time, total: 0 })
}

const recentSales = []

salesSnapshot.forEach(doc => {
const sale = doc.data()
let date = sale.createdAt?.seconds ? new Date(sale.createdAt.seconds * 1000) : new Date(sale.createdAt)

if(date >= todayStart){

// Revenue from cash/card/debt_payment
if(sale.type === "cash" || sale.type === "card" || sale.type === "debt_payment"){
todayRevenue += sale.total || 0
// Add to bucket
const saleTime = date.getTime()
const bucketIndex = Math.floor((saleTime - startTime) / bucketSize)
if(bucketIndex < buckets.length){
buckets[bucketIndex].total += sale.total || 0
}
}

// Debt tracking
if(sale.type === "debt"){
todayDebt += sale.total || 0
}
if(sale.type === "debt_payment"){
todayDebt -= sale.total || 0
}

// Items sold (cash + debt)
if(sale.items && (sale.type === "cash" || sale.type === "debt")){
sale.items.forEach(item => {
todayItems += item.qty || 0
})
}

// Profit from cash/card + debt payments
if(sale.items && (sale.type === "cash" || sale.type === "card")){
sale.items.forEach(item => {
const qty = item.qty || 0
const price = item.price || 0
const cost = item.cost || 0
todayProfit += (price - cost) * qty
})
}
if(sale.type === "debt_payment"){
todayProfit += sale.profitPart || 0
}

// Collect for recent sales
recentSales.push({
id: doc.id,
...sale,
date
})
}
})

const changeEl = document.getElementById("todayRevenueChange")
if(changeEl){
  changeEl.innerText = "0% kechagidan"
  changeEl.style.color = "#64748b"
}

const currentTime = new Date()
const yesterdayStart = new Date(todayStart)
yesterdayStart.setDate(yesterdayStart.getDate() - 1)
const yesterdayEnd = new Date(yesterdayStart)
yesterdayEnd.setHours(currentTime.getHours(), currentTime.getMinutes(), currentTime.getSeconds(), currentTime.getMilliseconds())

salesRef
.where("createdAt", ">=", yesterdayStart)
.where("createdAt", "<=", yesterdayEnd)
.get()
.then(yesterdaySnapshot => {
  let yesterdayRevenue = 0
  yesterdaySnapshot.forEach(doc => {
    const sale = doc.data()
    if(sale.type === "cash" || sale.type === "card" || sale.type === "debt_payment"){
      yesterdayRevenue += sale.total || 0
    }
  })

  const difference = todayRevenue - yesterdayRevenue
  let percent = 0
  if(yesterdayRevenue > 0){
    percent = (difference / yesterdayRevenue) * 100
  }

  if(changeEl){
    if(difference > 0){
      changeEl.innerText = `↑ +${percent.toFixed(1)}% kechagidan`
      changeEl.style.color = "#16a34a"
    } else if(difference < 0){
      changeEl.innerText = `↓ ${Math.abs(percent).toFixed(1)}% kechagidan`
      changeEl.style.color = "#dc2626"
    } else {
      changeEl.innerText = "0% kechagidan"
      changeEl.style.color = "#64748b"
    }
  }
})
.catch(e => {
  console.error("Yesterday query error:", e)
})

// Update UI
const rev = document.getElementById("todayRevenue")
const items = document.getElementById("todayItems")
const profit = document.getElementById("todayProfit")
const debt = document.getElementById("todayDebt")

rev.innerText = formatMoney(todayRevenue)
if(items) items.innerText = todayItems
if(profit) profit.innerText = formatMoney(todayProfit)
if(debt) debt.innerText = formatMoney(todayDebt)

// Profit status
const profitStatus = document.getElementById("profitStatusText")
if(profitStatus){
if(todayProfit > 0){
profitStatus.innerText = "Yaxshi ko‘rsatkich"
profitStatus.style.color = "#16a34a"
} else {
profitStatus.innerText = "Foyda yo‘q"
profitStatus.style.color = "#dc2626"
}
}

// Debt status
const debtStatus = document.getElementById("debtStatusText")
if(debtStatus){
if(todayDebt > 0){
debtStatus.innerText = "Qarzdorlik bor"
debtStatus.style.color = "#ea580c"
} else {
debtStatus.innerText = "Qarzdorlik yo‘q"
debtStatus.style.color = "#16a34a"
}
}

// Chart data
const chartLabels = buckets.map(b => {
const d = new Date(b.time)
return d.toLocaleTimeString('uz-UZ', { hour:'2-digit', minute:'2-digit', hour12:false })
})
const chartValues = []
let cumulative = 0
buckets.forEach(b => {
cumulative += b.total
chartValues.push(cumulative)
})

if(typeof renderTodaySalesChart === "function"){
renderTodaySalesChart({
labels: chartLabels,
values: chartValues
})
}

// Recent sales
recentSales.sort((a,b) => b.createdAt.seconds - a.createdAt.seconds)
const top7 = recentSales.slice(0,7)

const listEl = document.getElementById("recentSalesList")
if(listEl){
listEl.innerHTML = ""
top7.forEach(sale => {
const item = document.createElement("div")
item.className = "recent-sale-item"
item.innerHTML = `
<div class="sale-icon">🛒</div>
<div class="sale-info">
<div class="sale-title">Sotuv #${sale.id.slice(-6)}</div>
<div class="sale-meta">${sale.date.toLocaleTimeString('uz-UZ', { hour:'2-digit', minute:'2-digit' })} • ${sale.items ? sale.items.length : 0} ta mahsulot</div>
</div>
<div class="sale-amount">${formatMoney(sale.total)}</div>
`
listEl.appendChild(item)
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
const cameraBtn = document.getElementById("cameraSection")
const currentPageId =
  !document.getElementById("stockPage").classList.contains("hidden")
    ? "stockPage"
    : null
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

if(enabled && currentPageId === "stockPage"){
cameraBtn.style.display = "block"

    }else{
      cameraBtn.style.display = "none"

      const scanner = document.getElementById("cameraScanner")
      const btn = document.getElementById("cameraToggleBtn")

      if(scanner){
        scanner.classList.add("hidden")
      }

      if(btn){
btn.innerText = "🔍 Tezkor qidiruv"      }

      if(typeof stopCameraScanner === "function"){
        stopCameraScanner()
      }

      cameraOpen = false
        const cameraSection = document.getElementById("cameraSection")
if(cameraSection){
  cameraSection.style.display = "none"
}
    }

  }

}
// run on load



function formatNumberInput(input){

  let value = input.value.replace(/\s/g, '') // remove spaces

  if(value === "") return

  // allow only numbers
  value = value.replace(/\D/g, '')

  // format with spaces
  value = value.replace(/\B(?=(\d{3})+(?!\d))/g, " ")

  input.value = value
}
let cameraOpen = false

function toggleCameraScanner(){

  const scanner = document.getElementById("cameraScanner")
  const btn = document.getElementById("cameraToggleBtn")

  if(!scanner || !btn) return

  cameraOpen = !cameraOpen

  if(cameraOpen){

    // SHOW CAMERA ABOVE BUTTON
    scanner.classList.remove("hidden")

    // CHANGE BUTTON TEXT
    btn.innerText = "❌ Kamerani yopish"

    if(typeof startRealCameraScanner === "function"){
      startRealCameraScanner()
    }

  }else{

    // HIDE CAMERA
    scanner.classList.add("hidden")

    // RESET BUTTON TEXT
btn.innerText = "🔍 Tezkor qidiruv"
    if(typeof stopCameraScanner === "function"){
      stopCameraScanner()
    }
  }
}

window.usdRate = 0
async function loadUsdRate(){
  try{
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD")
    const data = await res.json()
window.usdRate = data.rates.UZS
  }catch(e){
    console.log("USD rate error", e)
window.usdRate = 12500
  }
}


document.addEventListener("DOMContentLoaded", () => {
  updateCamera()
  selectCurrency("UZS")
})
let currentCurrency = "UZS"

function selectCurrency(type){
  currentCurrency = type

  const uzsBtn = document.getElementById("btnUZS")
  const usdBtn = document.getElementById("btnUSD")

  if(type === "UZS"){
    uzsBtn.style.background = "#2563eb"
    uzsBtn.style.color = "#fff"

    usdBtn.style.background = "transparent"
    usdBtn.style.color = "#111"
  }else{
    usdBtn.style.background = "#2563eb"
    usdBtn.style.color = "#fff"

    uzsBtn.style.background = "transparent"
    uzsBtn.style.color = "#111"
  }

  handleCostInput()
}

function handleCostInput(){
  const val = Number(document.getElementById("stockCost").value || 0)
  const preview = document.getElementById("currencyPreview")

  if(!preview) return

  if(currentCurrency === "USD" && val > 0){

    const rate = window.usdRate || 12500
    const uzs = Math.round(val * rate)

    preview.innerText = `= ${uzs.toLocaleString("ru-RU")} UZS`

  }else{
    preview.innerText = ""
  }

  updateProfitPreview()
}
window.addEventListener("load", () => {
  document.getElementById("appScreen").classList.add("loaded")
})
window.addEventListener("load", () => {

  setTimeout(() => {

    const loading = document.getElementById("loadingScreen")
    if(loading) loading.style.display = "none"

    const auth = document.getElementById("authScreen")
    if(auth) auth.classList.remove("hidden")

  }, 800)

})
function loadRecentSales() {
  const list = document.getElementById("recentSalesList")
  if (!list) return

  const user = firebase.auth().currentUser
  if (!user) return

  db.collection("shops")
    .doc(user.uid)
    .collection("sales")
    .orderBy("createdAt", "desc")
    .limit(5)
.get().then(snapshot => {
      list.innerHTML = ""

      if (snapshot.empty) {
        list.innerHTML = `
          <div style="
            text-align:center;
            color:#94a3b8;
            padding:20px;
          ">
            Hozircha sotuvlar yo‘q
          </div>
        `
        return
      }

      let colors = ["#eaf7ec", "#eaf2fb", "#fdf6e3"] // soft colors

      let index = 0

      snapshot.forEach(doc => {
        const sale = doc.data()
        const id = doc.id.slice(-4)

        const time = sale.createdAt?.toDate()
        const formattedTime = time
          ? time.toLocaleTimeString("uz-UZ", { hour: '2-digit', minute: '2-digit' })
          : "--:--"

        let itemsCount = 0
        if (sale.items) {
          sale.items.forEach(item => {
            itemsCount += item.qty || 0
          })
        }

        const total = sale.total || 0

        const bg = colors[index % colors.length]
        index++

        list.innerHTML += `
          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            padding:14px;
            border-radius:18px;
            background:white;
            box-shadow:0 4px 12px rgba(0,0,0,0.04);
          ">

            <div style="display:flex; align-items:center; gap:12px;">

              <!-- ICON -->
              <div style="
                width:46px;
                height:46px;
                border-radius:14px;
                background:${bg};
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:20px;
              ">
                🛒
              </div>

              <!-- TEXT -->
              <div>
                <div style="
                  font-weight:600;
                  font-size:15px;
                ">
                  Sotuv #${id}
                </div>

                <div style="
                  font-size:12px;
                  color:#94a3b8;
                  margin-top:2px;
                ">
                  ${formattedTime} · ${itemsCount} ta mahsulot
                </div>
              </div>

            </div>

            <!-- PRICE -->
            <div style="
              font-weight:700;
              color:#2563eb;
              font-size:16px;
            ">
              ${formatMoney(total)}
            </div>

          </div>
        `
      })

    })
}
