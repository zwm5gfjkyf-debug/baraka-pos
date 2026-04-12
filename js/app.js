// =============================
// BARAKA POS MAIN ENGINE
// =============================
let salesCache = null
let analyticsLoaded = false
let currentShopId = null
window.currentShopId = null
let dashboardSalesCache = []
let dashboardListener = null

// Dashboard listeners and data
let todaySalesListener = null
let yesterdaySalesListener = null
let nasiyaListener = null
let todaySalesData = []
let yesterdaySalesData = []
let nasiyaData = []
let timeUpdateInterval = null
let revenueChart = null
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

  // Unsubscribe previous listeners
  if(todaySalesListener) todaySalesListener()
  if(yesterdaySalesListener) yesterdaySalesListener()
  if(nasiyaListener) nasiyaListener()
  if(timeUpdateInterval) clearInterval(timeUpdateInterval)

  // Initialize data
  todaySalesData = []
  yesterdaySalesData = []
  nasiyaData = []

  // Show loading, hide others
  document.getElementById('loadingState').style.display = 'block'
  document.getElementById('statsGrid').style.display = 'none'
  document.getElementById('chartCard').style.display = 'none'
  document.getElementById('recentSection').style.display = 'none'
  document.getElementById('errorState').style.display = 'none'

  // Set up time updates
  updateTimeAndDate()
  timeUpdateInterval = setInterval(updateTimeAndDate, 60000) // Update every minute

  // Set up listeners
  setupTodaySalesListener()
  setupYesterdaySalesListener()
  setupNasiyaListener()

  // Initial render
  renderDashboard()
}

function updateTimeAndDate(){
  const now = new Date()
  const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateStr = formatDate()

  const timeEl = document.getElementById('currentTime')
  const dateEl = document.getElementById('currentDate')

  if(timeEl) timeEl.textContent = timeStr
  if(dateEl) dateEl.textContent = dateStr
}

function setupTodaySalesListener(){
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  todaySalesListener = db
    .collection('shops')
    .doc(currentShopId)
    .collection('sales')
    .where('createdAt', '>=', todayStart)
    .where('createdAt', '<', tomorrowStart)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      todaySalesData = []
      snapshot.forEach(doc => {
        const data = doc.data()
        data.id = doc.id
        todaySalesData.push(data)
      })
      renderDashboard()
    }, error => {
      console.error('Today sales listener error:', error)
      showErrorState()
    })
}

function setupYesterdaySalesListener(){
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  yesterdaySalesListener = db
    .collection('shops')
    .doc(currentShopId)
    .collection('sales')
    .where('createdAt', '>=', yesterdayStart)
    .where('createdAt', '<', todayStart)
    .onSnapshot(snapshot => {
      yesterdaySalesData = []
      snapshot.forEach(doc => {
        yesterdaySalesData.push(doc.data())
      })
      renderDashboard()
    }, error => {
      console.error('Yesterday sales listener error:', error)
    })
}

function setupNasiyaListener(){
  nasiyaListener = db
    .collection('shops')
    .doc(currentShopId)
    .collection('nasiya')
    .where('status', '==', 'active')
    .onSnapshot(snapshot => {
      nasiyaData = []
      snapshot.forEach(doc => {
        nasiyaData.push(doc.data())
      })
      renderDashboard()
    }, error => {
      console.error('Nasiya listener error:', error)
      showErrorState()
    })
}

function renderDashboard(){
  // Calculations
  const todayRevenue = calculateTodayRevenue()
  const yesterdayRevenue = calculateYesterdayRevenue()
  const revenueChange = calculateRevenueChange(todayRevenue, yesterdayRevenue)
  const todayProfit = calculateTodayProfit()
  const productsSold = calculateProductsSold()
  const nasiyaTotal = calculateNasiyaTotal()

  // Update stats cards
  updateStatsCards(todayRevenue, revenueChange, todayProfit, productsSold, nasiyaTotal)

  // Update chart
  updateRevenueChart(todayRevenue)

  // Update recent sales
  updateRecentSales()

  // Hide loading, show content
  document.getElementById('loadingState').style.display = 'none'
  document.getElementById('statsGrid').style.display = 'block'
  document.getElementById('chartCard').style.display = 'block'
  document.getElementById('recentSection').style.display = 'block'
}

function calculateTodayRevenue(){
  return todaySalesData.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0)
}

function calculateYesterdayRevenue(){
  return yesterdaySalesData.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0)
}

function calculateRevenueChange(today, yesterday){
  if(today === 0 && yesterday === 0) return 0
  if(yesterday === 0 && today > 0) return 100
  return Math.round(((today - yesterday) / yesterday) * 100)
}

function calculateTodayProfit(){
  return todaySalesData.reduce((sum, sale) => sum + (Number(sale.profit) || 0), 0)
}

function calculateProductsSold(){
  return todaySalesData.reduce((sum, sale) => sum + (Number(sale.itemsCount) || 0), 0)
}

function calculateNasiyaTotal(){
  return nasiyaData.reduce((sum, debt) => {
    const amount = Number(debt.amount) || 0
    const paid = Number(debt.paidAmount) || 0
    return sum + Math.max(0, amount - paid)
  }, 0)
}

function updateStatsCards(todayRevenue, revenueChange, todayProfit, productsSold, nasiyaTotal){
  // Today revenue
  const revenueNumberEl = document.getElementById('todayRevenueNumber')
  if(revenueNumberEl){
    revenueNumberEl.textContent = Math.round(todayRevenue).toLocaleString('uz-UZ').replace(/,/g, ' ')
  }

  const changeEl = document.getElementById('revenueChange')
  if(changeEl){
    const percentStr = formatPercent(revenueChange)
    const arrow = revenueChange >= 0 ? '↑' : '↓'
    changeEl.textContent = `${arrow} ${percentStr}`
  }

  // Today profit
  const profitEl = document.getElementById('todayProfit')
  if(profitEl){
    profitEl.textContent = formatMoney(todayProfit)
    profitEl.style.color = todayProfit > 0 ? '#43A047' : '#FB8C00'
  }

  const profitStatusEl = document.getElementById('profitStatus')
  if(profitStatusEl){
    if(todayProfit > 0){
      profitStatusEl.textContent = '↑ Yaxshi ko\'rsatkich'
      profitStatusEl.style.color = '#43A047'
    } else {
      profitStatusEl.textContent = 'Hozircha sotuv yo\'q'
      profitStatusEl.style.color = '#888'
    }
  }

  // Products sold
  const productsEl = document.getElementById('productsSold')
  if(productsEl){
    productsEl.textContent = productsSold.toString()
  }

  // Nasiya
  const nasiyaEl = document.getElementById('nasiyaTotal')
  if(nasiyaEl){
    nasiyaEl.textContent = formatMoney(nasiyaTotal)
    nasiyaEl.style.color = '#FB8C00' // Always orange
  }

  const nasiyaStatusEl = document.getElementById('nasiyaStatus')
  if(nasiyaStatusEl){
    if(nasiyaTotal > 0){
      nasiyaStatusEl.textContent = 'Faol qarzdorlik'
      nasiyaStatusEl.style.color = '#FB8C00'
    } else {
      nasiyaStatusEl.textContent = 'Qarzdorlik yo\'q'
      nasiyaStatusEl.style.color = '#888'
    }
  }
}

function updateRevenueChart(todayRevenue){
  const canvas = document.getElementById('revenueChart')
  if(!canvas) return

  const ctx = canvas.getContext('2d')
  if(revenueChart) revenueChart.destroy()

  const now = new Date()
  const labels = ["09:00", "11:00", "13:00", "15:00", "Hozir"]
  const labelHours = [9, 11, 13, 15, now.getHours()]
  const values = labelHours.map(hour => {
    const targetTime = hour === now.getHours() ? now : new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour)
    return calculateCumulativeRevenueUpTo(targetTime)
  })

  revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        borderColor: '#2E7D32',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: (ctx) => ctx.dataIndex === 0 || ctx.dataIndex === values.length - 1 ? 6 : 0,
        pointBackgroundColor: (ctx) => ctx.dataIndex === 0 ? '#43A047' : ctx.dataIndex === values.length - 1 ? '#2E7D32' : 'transparent',
        pointBorderColor: (ctx) => ctx.dataIndex === 0 ? '#43A047' : ctx.dataIndex === values.length - 1 ? '#2E7D32' : 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: { display: false },
        y: { display: false }
      },
      elements: {
        point: { hoverRadius: 0 }
      }
    }
  })
}

function calculateCumulativeRevenueUpTo(targetTime){
  return todaySalesData
    .filter(sale => {
      const saleTime = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt)
      return saleTime <= targetTime
    })
    .reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0)
}

function updateRecentSales(){
  const container = document.getElementById('recentSalesContainer')
  if(!container) return

  container.innerHTML = ''

  if(todaySalesData.length === 0){
    // Empty state
    const emptyDiv = document.createElement('div')
    emptyDiv.style.textAlign = 'center'
    emptyDiv.style.padding = '40px 20px'
    emptyDiv.innerHTML = `
      <div style="font-size:48px; color:#ccc; margin-bottom:16px;">🛒</div>
      <div style="font-size:16px; font-weight:700; color:#666; margin-bottom:8px;">Bugun hali sotuv yo'q</div>
      <div style="font-size:14px; color:#999;">Sotuv qo'shish uchun + tugmasini bosing</div>
    `
    container.appendChild(emptyDiv)
    return
  }

  const recent = todaySalesData.slice(0, 3)

  recent.forEach((sale, index) => {
    const saleDiv = document.createElement('div')
    saleDiv.style.display = 'flex'
    saleDiv.style.alignItems = 'center'
    saleDiv.style.gap = '14px'
    saleDiv.style.padding = '12px 16px'
    saleDiv.style.borderRadius = '14px'
    saleDiv.style.border = '0.5px solid #E8EAF0'
    saleDiv.style.marginBottom = '8px'
    saleDiv.style.background = 'white'

    const iconBg = ['#E8F5E9', '#E3F2FD', '#FFF8E1'][index % 3]
    const iconColor = ['#2E7D32', '#1976D2', '#F57C00'][index % 3]

    const saleNumber = sale.saleNumber || '—'
    const timeStr = formatTime(sale.createdAt)
    const itemCount = sale.itemsCount || 0

    saleDiv.innerHTML = `
      <div style="width:46px; height:46px; border-radius:12px; background:${iconBg}; display:flex; align-items:center; justify-content:center; font-size:20px;">🛒</div>
      <div style="flex:1;">
        <div style="font-size:15px; font-weight:700; color:#1a1a2e;">Sotuv #${saleNumber}</div>
        <div style="font-size:12px; color:#aaa; margin-top:2px;">${timeStr} · ${itemCount} ta mahsulot</div>
      </div>
      <div style="font-size:16px; font-weight:700; color:#1976D2;">${formatMoney(sale.amount)}</div>
    `

    container.appendChild(saleDiv)
  })
}

function showErrorState(){
  document.getElementById('loadingState').style.display = 'none'
  document.getElementById('errorState').style.display = 'block'
}

function retryLoad(){
  loadDashboard()
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
