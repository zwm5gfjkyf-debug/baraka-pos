// =============================
// BARAKA POS MAIN ENGINE
// =============================
let salesCache = null
let analyticsLoaded = false
let currentShopId = null
window.currentShopId = null

let sidebarListeners = {
  shop: null,
  sales: null,
  products: null,
  nasiya: null
}
let sidebarLoaded = {
  shop: false,
  sales: false,
  products: false,
  nasiya: false
}
let sidebarData = {
  shopName: 'Do\'kon',
  ownerEmail: 'No email',
  revenue: 0,
  salesCount: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  activeNasiyaCount: 0,
  loading: true
}
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

if(typeof loadSidebarData === "function"){
    loadSidebarData()
}

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

// Asosiy (dashboard) — js/home-asosiy.js




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

function sidebarNavigate(pageId){
  closeMenu()
  setTimeout(() => {
    if(typeof navigate === 'function'){
      const page = document.getElementById(pageId)
      if(page){
        navigate(pageId)
      } else {
        if(typeof showTopBanner === 'function'){
          showTopBanner('Sahifa mavjud emas', 'error')
        }
      }
    }
  }, 150)
}

function cleanupSidebarListeners(){
  Object.values(sidebarListeners).forEach(unsubscribe => {
    if(typeof unsubscribe === 'function'){
      unsubscribe()
    }
  })
  sidebarListeners = {
    shop: null,
    sales: null,
    products: null,
    nasiya: null
  }
  sidebarLoaded = {
    shop: false,
    sales: false,
    products: false,
    nasiya: false
  }
}

function formatPlainNumber(value){
  const amount = Number(value)
  if(!amount || isNaN(amount)) return '0'
  return Math.round(amount).toLocaleString('uz-UZ').replace(/,/g, ' ')
}

function formatSalesCount(value){
  const count = Number(value)
  if(!count || isNaN(count)) return '0 ta'
  return `${count.toLocaleString('uz-UZ').replace(/,/g, ' ')} ta`
}

function loadSidebarData(){
  if(!currentShopId) return

  cleanupSidebarListeners()
  sidebarData.loading = true
  renderSidebar()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  sidebarListeners.shop = db
    .collection('shops')
    .doc(currentShopId)
    .onSnapshot(doc => {
      const data = doc.data() || {}
      const shopName = data.name || data.shopName || data.title || 'Do\'kon'
      const ownerEmail = data.ownerEmail || data.email || 'No email'
      sidebarData.shopName = `${shopName} Do'koni`
      sidebarData.ownerEmail = ownerEmail
      sidebarLoaded.shop = true
      sidebarData.loading = Object.values(sidebarLoaded).some(v => v === false)
      renderSidebar()
    }, error => {
      console.error('Sidebar shop listener error:', error)
    })

  sidebarListeners.sales = db
    .collection('shops')
    .doc(currentShopId)
    .collection('sales')
    .where('createdAt', '>=', todayStart)
    .where('createdAt', '<', tomorrowStart)
    .onSnapshot(snapshot => {
      let revenue = 0
      snapshot.forEach(doc => {
        const sale = doc.data() || {}
        revenue += Number(sale.total || sale.amount || 0) || 0
      })
      sidebarData.revenue = revenue
      sidebarData.salesCount = snapshot.size
      sidebarLoaded.sales = true
      sidebarData.loading = Object.values(sidebarLoaded).some(v => v === false)
      renderSidebar()
    }, error => {
      console.error('Sidebar sales listener error:', error)
    })

  sidebarListeners.products = db
    .collection('shops')
    .doc(currentShopId)
    .collection('products')
    .where('status', '==', 'active')
    .onSnapshot(snapshot => {
      let outCount = 0
      let lowCount = 0
      snapshot.forEach(doc => {
        const product = doc.data() || {}
        const quantity = Number(product.quantity) || 0
        if(quantity === 0) outCount += 1
        if(quantity > 0 && quantity <= 5) lowCount += 1
      })
      sidebarData.outOfStockCount = outCount
      sidebarData.lowStockCount = lowCount
      sidebarLoaded.products = true
      sidebarData.loading = Object.values(sidebarLoaded).some(v => v === false)
      renderSidebar()
    }, error => {
      console.error('Sidebar products listener error:', error)
    })

  sidebarListeners.nasiya = db
    .collection('shops')
    .doc(currentShopId)
    .collection('nasiya')
    .where('status', '==', 'active')
    .onSnapshot(snapshot => {
      sidebarData.activeNasiyaCount = snapshot.size
      sidebarLoaded.nasiya = true
      sidebarData.loading = Object.values(sidebarLoaded).some(v => v === false)
      renderSidebar()
    }, error => {
      console.error('Sidebar nasiya listener error:', error)
    })
}

function renderSidebar(){
  const shopNameEl = document.getElementById('sidebarShopName')
  const shopEmailEl = document.getElementById('sidebarShopEmail')
  const revenueEl = document.getElementById('sidebarRevenue')
  const salesCountEl = document.getElementById('sidebarSalesCount')
  const zaxiraBadge = document.getElementById('sidebarZaxiraBadge')
  const zaxiraChevron = document.getElementById('sidebarZaxiraChevron')
  const nasiyaBadge = document.getElementById('sidebarNasiyaBadge')
  const nasiyaChevron = document.getElementById('sidebarNasiyaChevron')
  const shopEditBtn = document.getElementById('sidebarEditBtn')

  if(shopNameEl) shopNameEl.textContent = sidebarData.shopName || 'Do\'kon'
  if(shopEmailEl) shopEmailEl.textContent = sidebarData.ownerEmail || 'No email'

  if(revenueEl){
    revenueEl.textContent = sidebarData.loading ? '' : formatPlainNumber(sidebarData.revenue)
    revenueEl.classList.toggle('skeleton', sidebarData.loading)
  }

  if(salesCountEl){
    salesCountEl.textContent = sidebarData.loading ? '' : formatSalesCount(sidebarData.salesCount)
    salesCountEl.classList.toggle('skeleton', sidebarData.loading)
  }

  const zaxiraCount = sidebarData.lowStockCount + sidebarData.outOfStockCount
  if(zaxiraBadge && zaxiraChevron){
    if(sidebarData.loading || zaxiraCount === 0){
      zaxiraBadge.style.display = 'none'
      zaxiraChevron.style.display = 'block'
    } else {
      zaxiraBadge.style.display = 'flex'
      zaxiraChevron.style.display = 'none'
      zaxiraBadge.innerHTML = `<div class="badge-number">${formatPlainNumber(zaxiraCount)}</div><div class="badge-label">kam</div>`
    }
  }

  if(nasiyaBadge && nasiyaChevron){
    if(sidebarData.loading || sidebarData.activeNasiyaCount === 0){
      nasiyaBadge.style.display = 'none'
      nasiyaChevron.style.display = 'block'
    } else {
      nasiyaBadge.style.display = 'flex'
      nasiyaChevron.style.display = 'none'
      nasiyaBadge.innerHTML = `<div class="badge-number">${formatPlainNumber(sidebarData.activeNasiyaCount)}</div><div class="badge-label">qarz</div>`
    }
  }

  if(shopEditBtn){
    shopEditBtn.disabled = sidebarData.loading
  }

  const versionDateEl = document.getElementById('sidebarVersionDate')
  if(versionDateEl){
    const now = new Date()
    const months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr']
    versionDateEl.textContent = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`
  }
}

function updateSidebarActive(pageId){
  document.querySelectorAll('.sidebar-item').forEach(item => {
    const route = item.dataset.route
    item.classList.toggle('active', route === pageId)
  })
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
