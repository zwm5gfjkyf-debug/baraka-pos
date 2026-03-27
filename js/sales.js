// =======================================
// BARAKA POS – ULTRA FAST SALES ENGINE
// =======================================
// product cache (in memory)
let productCache = []
let productIndex = {}
let productIndexBarcode = {}
let productKeys = []       
let productById = {}        
let saleType = "cash"
let cart = []
let cartMap = {}
const scanSound = new Audio("https://actions.google.com/sounds/v1/cartoon/pop.ogg")
// =======================================
// LOAD PRODUCTS INTO MEMORY
// =======================================

async function loadProducts(){

if(!currentShopId) return

db
.collection("shops")
.doc(currentShopId)
.collection("products")
.onSnapshot(snapshot => {

productCache = []
productIndex = {}
productIndexBarcode = {}
productById = {}
productKeys = []
snapshot.forEach(doc => {

const data = doc.data()

if(data.deleted === true) return
const product = {
  id: doc.id,
  name: data.name || "",
  barcode: data.barcode || "",
  price: data.price || 0,
  cost: data.cost || 0,
  stock: data.stock || 0,
  image: data.image || ""   // 🔥 ADD THIS
}

productCache.push(product)
productById[product.id] = product
// INDEX BY NAME
const nameKey = (product.name || "").toLowerCase().trim()  
if(!productIndex[nameKey]){
productIndex[nameKey] = []
}

productIndex[nameKey].push(product)

// INDEX BY BARCODE
if(product.barcode){
productIndexBarcode[product.barcode] = product
}

})
productKeys = Object.keys(productIndex)
})
}
function getCurrentPage(){

const sale = document.getElementById("salePage")
const debt = document.getElementById("debtPage")
const stock = document.getElementById("stockPage")

if(sale && !sale.classList.contains("hidden")) return "sale"
if(debt && !debt.classList.contains("hidden")) return "debt"
if(stock && !stock.classList.contains("hidden")) return "stock"

return null

}
// =======================================
// ULTRA FAST SEARCH (FINAL CLEAN VERSION)
// =======================================

function searchProducts(text){

  const resultsBox = document.getElementById("searchResults")
  const emptyCart = document.getElementById("emptyCart")
  const noResults = document.getElementById("noResults")
  const totalEl = document.getElementById("saleTotal")

  // 🔥 ALWAYS CLEAR RESULTS FIRST
  if(resultsBox) resultsBox.innerHTML = ""

  // 🔥 ALWAYS HIDE TOTAL DURING SEARCH
  if(totalEl){
    totalEl.innerText = ""
    totalEl.classList.add("hidden")
  }

  // ===================================
  // 🔥 IF INPUT EMPTY
  // ===================================
  if(!text || text.trim() === ""){

    if(noResults) noResults.classList.add("hidden")

    // show empty ONLY if cart empty
    if(emptyCart && cart.length === 0){
      emptyCart.classList.remove("hidden")
    }

    return
  }

  // ===================================
  // 🔥 USER IS SEARCHING
  // ===================================
  if(emptyCart){
    emptyCart.classList.add("hidden")
  }

  const query = text.toLowerCase().trim()
  let results = []

  const keys = productKeys.slice(0, 300)

  for(let i = 0; i < keys.length; i++){
    const key = keys[i]

    if(key.includes(query)){
      results.push(...productIndex[key])
      if(results.length >= 20) break
    }
  }

  // ===================================
  // 🔥 NO RESULTS
  // ===================================
  if(results.length === 0){
    if(noResults) noResults.classList.remove("hidden")
  }else{
    if(noResults) noResults.classList.add("hidden")
  }

  // ===================================
  // 🔥 RENDER RESULTS
  // ===================================
  results.slice(0,20).forEach(p => {

    const div = document.createElement("div")

    div.innerHTML = `
      <div class="stock-row-item">

        <div class="product-img">
          ${
            p.image 
            ? `<img src="${p.image}" class="product-img-tag">`
            : `<div class="product-placeholder">📦</div>`
          }
        </div>

        <div class="stock-info">
          <div class="stock-name">${p.name}</div>
          <div class="stock-price">${formatMoney(p.price)}</div>
          <div class="stock-meta">
            ART-${p.id.slice(0,6)} / ${p.barcode || "-"}
          </div>
        </div>

        <div class="stock-right">
          <div class="stock-qty">${p.stock} dona</div>
        </div>

      </div>
    `

    div.onclick = () => {
      addToCart(p)
      clearSearch()
    }

    resultsBox.appendChild(div)
  })
}
// =======================================
// CART SYSTEM (FINAL CLEAN VERSION)
// =======================================

function addToCart(product){

  if(!product || product.stock <= 0){
    showTopBanner("Zaxirada qolmadi","error")
    return
  }

  let existing = cartMap[product.id]

  if(existing){

    if(existing.qty + 1 > product.stock){
      showTopBanner("Zaxirada yetarli mahsulot yo'q","error")
      return
    }

    existing.qty++

  }else{

    const item = {
      ...product,
      qty:1
    }

    cart.push(item)
    cartMap[product.id] = item
  }

  renderCart()
}


// =======================================
// UPDATE UI (COUNT + EMPTY ONLY)
// =======================================

function updateCartUI(){
  const countEl = document.getElementById("cartCount")
  const totalItems = cart.reduce((sum, i) => sum + i.qty, 0)
  if(countEl) countEl.innerText = totalItems
}

// =======================================
// RENDER CART (FINAL CLEAN)
// =======================================

let cartRenderScheduled = false

function renderCart(){

  if(cartRenderScheduled) return
  cartRenderScheduled = true

  requestAnimationFrame(()=>{

    cartRenderScheduled = false

    const list = document.getElementById("cartList")
    const nextBtn = document.getElementById("nextBtn")
    const totalEl = document.getElementById("saleTotal")
    const emptyCart = document.getElementById("emptyCart")
    const saleTypeBox = document.getElementById("saleTypeContainer")
    const debtInput = document.getElementById("debtCustomer")

    if(!list) return

    list.innerHTML = ""

    // ===================================
    // 🔥 EMPTY STATE (FIRST LOAD FIX)
    // ===================================
    if(cart.length === 0){
// 🔥 HIDE NEXT BUTTON
if(nextBtn){
  nextBtn.classList.add("hidden")
}
      list.classList.add("hidden")

      if(emptyCart){
        emptyCart.classList.remove("hidden")
      }

      // ❌ REMOVE TOTAL (NO MORE "0")
      if(totalEl){
        totalEl.innerText = ""
        totalEl.classList.add("hidden")
      }

      // reset sale type
      if(saleTypeBox){
        saleTypeBox.classList.add("hidden")
      }

      if(debtInput){
        debtInput.value = ""
        debtInput.classList.add("hidden")
      }

      const cash = document.getElementById("cashBtn")
      const debt = document.getElementById("debtBtn")

      if(cash) cash.classList.add("active")
      if(debt) debt.classList.remove("active")

      updateCartUI()
      // 🔥 SHOW NEXT BUTTON ONLY AFTER RENDER COMPLETE
if(nextBtn){
  nextBtn.classList.remove("hidden")
}
      return
    }

    // ===================================
    // 🔥 CART VISIBLE
    // ===================================
  
    list.classList.remove("hidden")
    if(emptyCart) emptyCart.classList.add("hidden")

    if(saleTypeBox){
      saleTypeBox.classList.remove("hidden")
    }

    // ===================================
    // 🔥 RENDER ITEMS (CLEAN)
    // ===================================
    let total = 0

    cart.forEach(item => {

      const itemTotal = item.price * item.qty
      total += itemTotal

      const div = document.createElement("div")
      div.className = "stock-row-item"

      div.innerHTML = `
        <div class="product-img">
          ${
            item.image
            ? `<img src="${item.image}" class="product-img-tag">`
            : `<div class="product-placeholder">📦</div>`
          }
        </div>

        <div class="stock-info">
          <div class="stock-name">${item.name}</div>
          <div class="stock-price">${formatMoney(item.price)}</div>
        </div>

        <div class="stock-right">
          <div class="qty-control">
            <button class="qty-btn minus" onclick="decreaseQty('${item.id}')">−</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn plus" onclick="increaseQty('${item.id}')">+</button>
          </div>
        </div>
      `

      list.appendChild(div)
    })

    // ===================================
    // 🔥 TOTAL (ONLY HERE, ONLY ONCE)
    // ===================================
    if(totalEl){
      totalEl.innerText = "Jami: " + formatMoney(total)
      totalEl.classList.remove("hidden")
    }

    updateCartUI()

  })
}
function clearSearch(){

  const input = document.getElementById("saleSearch")
  const noResults = document.getElementById("noResults")

  if(input){
    input.value = ""
  }

  document.getElementById("searchResults").innerHTML = ""

  if(noResults) noResults.classList.add("hidden")
}

function renderSelectedProduct(p){

  const resultsBox = document.getElementById("searchResults")

  const qty = cartMap[p.id]?.qty || 0

  resultsBox.innerHTML = `
    <div class="stock-row-item">

      <div class="product-img">
        ${
          p.image 
          ? `<img src="${p.image}" class="product-img-tag">`
          : `<div class="product-placeholder">📦</div>`
        }
      </div>

      <div class="stock-info">
        <div class="stock-name">${p.name}</div>
<div class="stock-price">${formatMoney(p.price)}</div>
</div>

      <div class="stock-right">

        <div class="qty-control">
          <button class="qty-btn minus" onclick="handleMinus('${p.id}')">−</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn plus" onclick="handlePlus('${p.id}')">+</button>
        </div>

      </div>

    </div>
  `
}
function handlePlus(id){
  increaseQty(id)

  const product = productById[id]
  if(product){
    renderSelectedProduct(product)
  }
}

function handleMinus(id){
  decreaseQty(id)

  const product = productById[id]
  if(product){
    renderSelectedProduct(product)
  }
}
// =======================================
// QUANTITY CONTROL
// =======================================

function increaseQty(id){

const item = cartMap[id]
if(!item) return

const product = productById[id]
if(!product){
showTopBanner("Mahsulot topilmadi","error")
return
}

if(item.qty + 1 > product.stock){
showTopBanner("Zaxirada yetarli mahsulot yo'q","error")
return
}

item.qty++

renderCart()

}


function decreaseQty(id){

const item = cartMap[id]
if(!item) return

item.qty--

if(item.qty <= 0){
cart = cart.filter(i => i.id !== id)
delete cartMap[id]
}else{
cartMap[id] = item
}

renderCart()

}



// =======================================
// COMPLETE SALE
// =======================================

async function completeSale(){

if(!currentShopId) return
if(cart.length === 0){
showTopBanner("Savat bo'sh", "error")
return
}// SAFETY: require customer name for debt
if(saleType === "debt"){

const name = document.getElementById("debtCustomer").value.trim()

if(!name){
showTopBanner("Mijoz ismini kiriting","error")
return
}

}
const btn = document.getElementById("completeSaleBtn")

// prevent double click
if(btn.disabled) return

btn.innerText = "⏳ Jarayonda..."
btn.disabled = true
let total = 0
let totalCost = 0
let totalProfit = 0
// Final stock safety check
for(const item of cart){

const product = productById[item.id]

if(!product || product.stock < item.qty){

showTopBanner("Zaxirada yetarli mahsulot yo'q","error")
btn.disabled = false
return

}

}
cart.forEach(i=>{
total += i.price * i.qty
totalCost += i.cost * i.qty
totalProfit += (i.price - i.cost) * i.qty
})

const sale = {
items: [...cart],
total: total,
totalCost: totalCost,
totalProfit: totalProfit,
type: saleType,

customer: saleType === "debt"
? document.getElementById("debtCustomer").value || "Noma'lum"
: null,

createdAt: firebase.firestore.FieldValue.serverTimestamp()
}
  
try{

const itemsToUpdate = [...cart]

// 🔥 INSTANT UI UPDATE
cart = []
cartMap = {}
renderCart()

const salesRef = db
.collection("shops")
.doc(currentShopId)
.collection("sales")

await salesRef.add(sale)

// 🔥 SHOW SUCCESS EARLY
showTopBanner("Sotuv yakunlandi", "success")

await updateStockAfterSale(itemsToUpdate)

}catch(e){

let offline = JSON.parse(localStorage.getItem("offlineSales") || "[]")

offline.push(sale)

localStorage.setItem("offlineSales", JSON.stringify(offline))

showTopBanner("Internet yo'q — offline saqlandi", "error")

}finally{

btn.disabled = false
btn.innerText = "Sotuvni yakunlash"

}
cart = []
cartMap = {}
saleType = "cash"

document.getElementById("debtCustomer").value = ""
document.getElementById("debtCustomer").classList.add("hidden")

document.getElementById("cashBtn").classList.add("active")
document.getElementById("debtBtn").classList.remove("active")

renderCart()


if(scanSound){
  scanSound.currentTime = 0
  scanSound.play().catch(()=>{})
}

loadDashboard()

}



// =======================================
// UPDATE STOCK
// =======================================

async function updateStockAfterSale(items){

const batch = db.batch()

items.forEach(item => {

const ref = db
.collection("shops")
.doc(currentShopId)
.collection("products")
.doc(item.id)

const product = productById[item.id]
if(product){

const newStock = Math.max(0,(product.stock || 0) - item.qty)
batch.update(ref,{
stock: newStock
})

product.stock = newStock

}

})

await batch.commit()

}


// =======================================
// CHANGE PRICE
// =======================================

function changePrice(id,newPrice){

const item = cart.find(i => i.id === id)

if(!item) return

const price = Number(newPrice || 0)
if(isNaN(price) || price < 0) return

item.price = price

renderCart()

}

// ===============================
// 🔥 NEW FAST BARCODE SYSTEM
// ===============================

let scanInput = null

function initScannerInput(){
scanInput = document.getElementById("hiddenScannerInput")
if(!scanInput) return

  scanInput.addEventListener("input", onScanInput)
}

let scanTimeout = null

function onScanInput(e){

  const value = e.target.value.trim()

  // reset timer
  clearTimeout(scanTimeout)

  // wait small time → detect scanner
  scanTimeout = setTimeout(()=>{

    if(value.length >= 6){
      handleBarcodeScan(value)
    }

    e.target.value = ""

  }, 50) // ⚡ VERY FAST
}


// ===============================
// HANDLE BARCODE (SHARED)
// ===============================

function handleBarcodeScan(barcode){

  if(!barcode) return

  barcode = barcode.trim()

  const product = productIndexBarcode[barcode]

  // 🔊 sound
  if(scanSound){
    scanSound.currentTime = 0
    scanSound.play().catch(()=>{})
  }

  const page = getCurrentPage()

  // SALE
  if(page === "sale"){

    if(product){
      addToCart(product)
    }else{
      showConfirm("Mahsulot topilmadi. Yangi mahsulot qo'shilsinmi?", () => {
        openAddProductModal()
        document.getElementById("stockBarcode").value = barcode
      })
    }

  }

  // STOCK
  if(page === "stock"){

    if(product){
      openEditModal(product.id)
    }else{
      openAddProductModal()
      document.getElementById("stockBarcode").value = barcode
    }

  }

  // cleanup UI
  const results = document.getElementById("searchResults")
  if(results) results.innerHTML = ""
}
function setSaleType(type){

saleType = type

const cash = document.getElementById("cashBtn")
const debt = document.getElementById("debtBtn")
const input = document.getElementById("debtCustomer")

cash.classList.remove("active")
debt.classList.remove("active")

if(type === "cash"){
cash.classList.add("active")
input.classList.add("hidden")
}

if(type === "debt"){
debt.classList.add("active")
input.classList.remove("hidden")
input.focus()
}

}
// ===============================
// CAMERA BARCODE SCANNER (PRO VERSION)
// ===============================

let lastCameraScan = 0
let isScannerRunning = false

function startRealCameraScanner(){
  const container = document.getElementById("cameraScanner")
  if(container) container.classList.remove("hidden")

  // prevent double start
  if(isScannerRunning) return
  isScannerRunning = true

  // clean old listeners
  if(window.Quagga && Quagga.offDetected){
    Quagga.offDetected()
  }

  Quagga.init({
    inputStream:{
      type:"LiveStream",
      target:document.querySelector('#scannerViewport'),
      constraints:{
        facingMode:"environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    },
    decoder:{
readers:["ean_reader","code_128_reader","upc_reader","ean_8_reader"]
  },
    locate: true // better detection
  }, function(err){

    if(err){
      console.error("Camera error:", err)
      isScannerRunning = false
      return
    }

   Quagga.start()
isScannerRunning = true
  })

 Quagga.onDetected(function(data){

  // ✅ FIRST check (VERY IMPORTANT)
  if(!data || !data.codeResult || !data.codeResult.code){
    return
  }

  const code = data.codeResult.code
  const now = Date.now()

  // prevent duplicate scans
  if(now - lastCameraScan < 500) return
  lastCameraScan = now

  handleBarcodeScan(code)

})

}


// ===============================
// STOP CAMERA
// ===============================

function stopCameraScanner(){

  const container = document.getElementById("cameraScanner")

  if(container){
    container.classList.add("hidden")
  }

 if(window.Quagga && isScannerRunning){
  try{
    Quagga.stop()
    Quagga.offDetected()
  }catch(e){
    console.warn("Quagga stop error:", e)
  }
}

  isScannerRunning = false
}
document.addEventListener("DOMContentLoaded", () => {
  initScannerInput()
})
function clearCart(){

  if(cart.length === 0) return

  showConfirm("Savatchani tozalaysizmi?", () => {

    cart = []
    cartMap = {}

    renderCart()

    document.getElementById("searchResults").innerHTML = ""

    const input = document.getElementById("saleSearch")
    if(input) input.value = ""

  })
}
