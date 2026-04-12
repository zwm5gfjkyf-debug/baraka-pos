// =======================================
// BARAKA POS – ULTRA FAST SALES ENGINE
// =======================================
// product cache (in memory)
let selectedPaymentType = null
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
  price: data.sellPrice || 0,
  cost: data.buyPrice || 0,
  stock: data.quantity || 0,
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
const debt = document.getElementById("debtCustomerPage")
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
 if(totalEl && cart.length === 0){
  totalEl.innerText = ""
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
         <div class="stock-qty" style="
  ${p.stock <= 0 ? 'color:#ef4444;font-weight:600;' : ''}
">
  ${
    p.stock <= 0
      ? "Qolmadi"
      : `${p.stock} dona`
  }
</div>
        </div>

      </div>
    `

   div.onclick = () => {

  if(p.stock <= 0){
    showTopBanner("Mahsulot qolmagan", "error")
    return
  }

  addToCart(p)
  clearSearch()
}

    resultsBox.appendChild(div)
  })
}

function updateSaleButtons(){

  const actions = document.getElementById("saleActions")
  const nextBtn = document.getElementById("nextBtn")

  if(!actions || !nextBtn) return

  if(cart.length === 0){

    nextBtn.classList.add("hidden")

    actions.classList.remove("split")
    actions.classList.add("center")

  }else{

    nextBtn.classList.remove("hidden")

    actions.classList.remove("center")
    actions.classList.add("split")

  }
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

if(!list){
  console.log("cartList not found")
  return
}
    list.innerHTML = ""

    // ===================================
    // 🔥 EMPTY STATE (FIRST LOAD FIX)
    // ===================================
    if(cart.length === 0){
// 🔥 HIDE NEXT BUTTON

      list.classList.add("hidden")

      if(emptyCart){
        emptyCart.classList.remove("hidden")
      }

      // ❌ REMOVE TOTAL (NO MORE "0")
      if(totalEl){
        totalEl.innerText = ""
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
updateSaleButtons()
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

// 🔥 APPLY DISCOUNT (CORRECT PLACE)
if(discountValue > 0){

  if(discountType === "percent"){
    total = total - (total * discountValue / 100)
  }else{
    total = total - discountValue
  }

  if(total < 0) total = 0
}

// ===================================
// 🔥 TOTAL (ONLY HERE, ONLY ONCE)
// ===================================
if(totalEl){
totalEl.innerText = "Jami: " + formatMoney(total).replace(" so'm", "")
  totalEl.style.display = "block"

}

updateCartUI()
updateSaleButtons()
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
// 🔥 VALIDATE DEBT CUSTOMER (NEW SYSTEM)
if(selectedPaymentType === "debt"){

  if(!window.debtCustomerName){
    showTopBanner("Mijoz ismini kiriting","error")
    return
  }

}
const btn = document.getElementById("nextBtn")
  if(!btn) return

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

// 🔥 APPLY DISCOUNT BEFORE SAVING
if(discountValue > 0){

  if(discountType === "percent"){
    total = total - (total * discountValue / 100)
  }else{
    total = total - discountValue
  }

  if(total < 0) total = 0
}

const sale = {
items: [...cart],
total: total,
totalCost: totalCost,
totalProfit: totalProfit,
type: selectedPaymentType,
customer: selectedPaymentType === "debt"
  ? window.debtCustomerName || "Noma'lum"
  : null,

phone: selectedPaymentType === "debt"
  ? window.debtCustomerPhone || ""
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

// 🔥 SHOW SUCCESS IMMEDIATELY
openSuccessPage()

// 🔥 SAVE IN BACKGROUND (NO WAIT)
salesRef.add(sale).catch(e => {
  console.error("Sale save error:", e)
})

updateStockAfterSale(itemsToUpdate).catch(e => {
  console.error("Stock update error:", e)
})

}catch(e){

let offline = JSON.parse(localStorage.getItem("offlineSales") || "[]")

offline.push(sale)

localStorage.setItem("offlineSales", JSON.stringify(offline))

showTopBanner("Internet yo'q — offline saqlandi", "error")

}finally{

btn.disabled = false
btn.innerText = "Sotuvni yakunlash"

}
// 🔥 RESET PAYMENT STATE (PUT HERE)
selectedPaymentType = null
window.debtCustomerName = null
window.debtCustomerPhone = null

cartMap = {}
saleType = "cash"
discountValue = 0
discountType = "percent"
// safe cleanup (no crash)
const debtInput = document.getElementById("debtCustomer")
if(debtInput){
  debtInput.value = ""
  debtInput.classList.add("hidden")
}

const cashBtn = document.getElementById("cashBtn")
const debtBtn = document.getElementById("debtBtn")

if(cashBtn) cashBtn.classList.add("active")
if(debtBtn) debtBtn.classList.remove("active")
renderCart()


if(scanSound){
  scanSound.currentTime = 0
  scanSound.play().catch(()=>{})
}

loadDashboard()
loadRecentSales()
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
quantity: newStock
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
      updateSaleButtons()
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
let discountType = "percent"
let discountValue = 0

function openDiscountModal(){

  const modal = document.getElementById("discountModal")
  const input = document.getElementById("discountInput")
  const actions = document.getElementById("saleActions")
  const nav = document.querySelector(".bottom-nav")

  modal.classList.remove("hidden")

  // 🔥 HIDE UI BEHIND
  if(actions) actions.style.display = "none"
  if(nav) nav.style.display = "none"

  // 🔥 LOCK BACKGROUND
  document.body.style.overflow = "hidden"

  setDiscountType("percent")
window.isFromDiscountFlow = true
  setTimeout(()=>{
    if(input) input.focus()
  }, 100)
}

function closeDiscountModal(){

  const modal = document.getElementById("discountModal")
  const actions = document.getElementById("saleActions")
  const nav = document.querySelector(".bottom-nav")

  modal.classList.add("hidden")

  // 🔥 RESTORE UI
  if(actions) actions.style.display = ""
  if(nav) nav.style.display = ""

  // 🔥 UNLOCK SCROLL
  document.body.style.overflow = ""
}

function setDiscountType(type){

  discountType = type

  const input = document.getElementById("discountInput")
  const quick = document.getElementById("discountQuick")

  const btnP = document.getElementById("btnPercent")
  const btnU = document.getElementById("btnUZS")

  // clear active
  btnP.classList.remove("active")
  btnU.classList.remove("active")

  quick.innerHTML = ""

  if(type === "percent"){
    btnP.classList.add("active")
    input.placeholder = "Chegirma foizini kiriting..."

    ;[15,30,50,75].forEach(v=>{
      const b = document.createElement("button")
      b.innerText = v + "%"
      b.onclick = () => {
        input.value = v
        updateDiscountPreview()
      }
      quick.appendChild(b)
    })

  }else{
    btnU.classList.add("active")
    input.placeholder = "Summani kiriting..."

    ;[10000,20000,30000].forEach(v=>{
      const b = document.createElement("button")
      b.innerText = v.toLocaleString()
      b.onclick = () => {
        input.value = v
        updateDiscountPreview()
      }
      quick.appendChild(b)
    })
  }

  updateDiscountPreview()

  // 🔥 KEYBOARD FIX (THIS IS THE MAIN THING)
  setTimeout(() => {
    if(input){
      input.focus()

      const val = input.value
      input.value = ""
      input.value = val
    }
  }, 50)
}
function updateDiscountPreview(){

  const input = document.getElementById("discountInput")
  const preview = document.getElementById("discountPreview")

  if(!input || !preview) return

  let val = Number(input.value || 0)

  // 🔥 calculate original total
  let total = 0
  cart.forEach(i=>{
    total += i.price * i.qty
  })

  let final = total

  if(val > 0){
    if(discountType === "percent"){
      final = total - (total * val / 100)
    }else{
      final = total - val
    }
  }

  if(final < 0) final = 0

preview.innerText = "Jami: " + formatMoney(final).replace(" so'm", "")
}
function applyDiscount(){

  const input = document.getElementById("discountInput")
  const val = Number(input.value)

  if(isNaN(val) || val < 0){
    return
  }

  // limit %
  if(discountType === "percent" && val > 100){
    showTopBanner("100% dan katta bo'lishi mumkin emas", "error")
    return
  }

  discountValue = val

  closeDiscountModal()

  // 🔥 OPEN PAYMENT PAGE INSTEAD OF JUST RENDER
  openPaymentPage()
}
function openPaymentPage(){

  const salePage = document.getElementById("salePage")
  const paymentPage = document.getElementById("paymentPage")
  const actions = document.getElementById("saleActions")
  const nav = document.querySelector(".bottom-nav")

  // ✅ HIDE SALE UI
  if(salePage) salePage.classList.add("hidden")
  if(actions) actions.style.display = "none"
  if(nav) nav.style.display = "none"

  // ✅ SHOW PAYMENT PAGE FULL
  if(paymentPage){
    paymentPage.classList.remove("hidden")
    paymentPage.style.display = "block"
  }

  // 🔥 TRANSACTION ID
  let lastId = Number(localStorage.getItem("lastTransactionId") || 0)
  lastId++
  localStorage.setItem("lastTransactionId", lastId)

  const idStr = String(lastId).padStart(6, "0")
  const idEl = document.getElementById("paymentTransactionId")
  if(idEl) idEl.innerText = "#" + idStr

  // 🔥 CALCULATE TOTAL
  let total = 0
  cart.forEach(i=>{
    total += i.price * i.qty
  })

  let final = total

  if(discountValue > 0){
    if(discountType === "percent"){
      final = total - (total * discountValue / 100)
    }else{
      final = total - discountValue
    }
  }

  if(final < 0) final = 0

  const oldEl = document.getElementById("paymentOldPrice")
  const finalEl = document.getElementById("paymentFinalPrice")

  if(discountValue > 0){
    if(oldEl){
      oldEl.style.display = "block"
      oldEl.innerText = formatMoney(total)
    }
  }else{
    if(oldEl) oldEl.style.display = "none"
  }

  if(finalEl){
    finalEl.innerText = formatMoney(final)
  }
}
function closePaymentPage(){

  const salePage = document.getElementById("salePage")
  const paymentPage = document.getElementById("paymentPage")
  const actions = document.getElementById("saleActions")
  const nav = document.querySelector(".bottom-nav")

  if(paymentPage) paymentPage.classList.add("hidden")

  if(salePage) salePage.classList.remove("hidden")
  if(actions) actions.style.display = ""
  if(nav) nav.style.display = ""
}
function selectPayment(type){

  selectedPaymentType = type

  const cash = document.getElementById("payCash")
  const card = document.getElementById("payCard")
  const debt = document.getElementById("payDebt")

  // reset all
  ;[cash, card, debt].forEach(btn=>{
    if(btn) btn.classList.remove("active")
  })

  // activate selected
  if(type === "cash" && cash) cash.classList.add("active")
  if(type === "card" && card) card.classList.add("active")
  if(type === "debt" && debt) debt.classList.add("active")
}
function handlePaymentSave(){

  if(!selectedPaymentType){
    showTopBanner("To'lov turini tanlang", "error")
    return
  }

  // 🔥 NASIYA FLOW
  if(selectedPaymentType === "debt"){
    openDebtPage()
    return
  }

  // 🔥 CASH / CARD → COMPLETE SALE
  completeSale()
}
function openDebtPage(){

  const paymentPage = document.getElementById("paymentPage")
  const debtPage = document.getElementById("debtCustomerPage")

  if(paymentPage) paymentPage.classList.add("hidden")
  if(debtPage) debtPage.classList.remove("hidden")
}
function closeDebtPage(){

  const debtPage = document.getElementById("debtCustomerPage")
  const paymentPage = document.getElementById("paymentPage")

  if(debtPage) debtPage.classList.add("hidden")
  if(paymentPage) paymentPage.classList.remove("hidden")
}

function saveDebtSale(){

  const name = (document.getElementById("debtName")?.value || "").trim()
  const phone = (document.getElementById("debtPhone")?.value || "").trim()

  if(!name){
    showTopBanner("Mijoz ismini kiriting", "error")
    return
  }

  // save into global (for completeSale)
  window.debtCustomerName = name
  window.debtCustomerPhone = phone

  completeSale()
}
function openSuccessPage(){

  const payment = document.getElementById("paymentPage")
  const debt = document.getElementById("debtCustomerPage")
  const success = document.getElementById("successPage")
  const nav = document.querySelector(".bottom-nav")
  const actions = document.getElementById("saleActions")

  if(payment) payment.classList.add("hidden")
  if(debt) debt.classList.add("hidden")

  // 🔥 hide UI behind
  if(nav) nav.style.display = "none"
  if(actions) actions.style.display = "none"

  if(success) success.classList.remove("hidden")
}
function finishSaleFlow(){

  const success = document.getElementById("successPage")
  const sale = document.getElementById("salePage")
  const nav = document.querySelector(".bottom-nav")
  const actions = document.getElementById("saleActions")

  // ✅ SHOW SALE PAGE
  if(success) success.classList.add("hidden")
  if(sale) sale.classList.remove("hidden")

  // ✅ RESTORE NAVIGATION
  if(nav) nav.style.display = ""

  // ✅ RESTORE SALE ACTIONS (scanner + button)
  if(actions) actions.style.display = ""

  // 🔥 RESET DATA
  cart = []
  cartMap = {}
  discountValue = 0
  discountType = "percent"

  renderCart()
}
// =======================================
// 🔥 DASHBOARD ENGINE (REAL DATA)
// =======================================

function getDateRange(dayOffset = 0){
  const now = new Date()
  now.setHours(0,0,0,0)
  now.setDate(now.getDate() + dayOffset)

  const start = new Date(now)
  const end = new Date(now)
  end.setHours(23,59,59,999)

  return { start, end }
}

async function loadDashboard(){

  if(!currentShopId) return

  const todayRange = getDateRange(0)
  const yesterdayRange = getDateRange(-1)

  const salesRef = db
    .collection("shops")
    .doc(currentShopId)
    .collection("sales")

  try{

    // 🔥 GET TODAY SALES
    const todaySnap = await salesRef
      .where("createdAt", ">=", todayRange.start)
      .where("createdAt", "<=", todayRange.end)
      .get()

    // 🔥 GET YESTERDAY SALES
    const yesterdaySnap = await salesRef
      .where("createdAt", ">=", yesterdayRange.start)
      .where("createdAt", "<=", yesterdayRange.end)
      .get()

    let todayRevenue = 0
    let todayProfit = 0
    let todayItems = 0
    let todayDebt = 0

    todaySnap.forEach(doc=>{
      const s = doc.data()

      todayRevenue += s.total || 0
      todayProfit += s.totalProfit || 0

      if(s.items){
        s.items.forEach(i=>{
          todayItems += i.qty || 0
        })
      }

      if(s.type === "debt"){
        todayDebt += s.total || 0
      }
    })

    let yesterdayRevenue = 0

    yesterdaySnap.forEach(doc=>{
      const s = doc.data()
      yesterdayRevenue += s.total || 0
    })

    // ===================================
    // 🔥 UPDATE UI
    // ===================================

    const revEl = document.getElementById("todayRevenue")
    const profitEl = document.getElementById("todayProfit")
    const itemsEl = document.getElementById("todayItems")
    const debtEl = document.getElementById("todayDebt")

    if(revEl) revEl.innerText = formatMoney(todayRevenue)
    if(profitEl) profitEl.innerText = formatMoney(todayProfit)
    if(itemsEl) itemsEl.innerText = todayItems
    if(debtEl) debtEl.innerText = formatMoney(todayDebt)

    // ===================================
    // 🔥 PERCENT CHANGE
    // ===================================

    const changeEl = document.getElementById("todayRevenueChange")

    let percent = 0

    if(yesterdayRevenue > 0){
      percent = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
    }

    percent = Math.round(percent)

    if(changeEl){

      if(percent >= 0){
        changeEl.innerText = `↑ +${percent}% kechagidan`
        changeEl.style.color = "#16a34a"
      }else{
        changeEl.innerText = `↓ ${percent}% kechagidan`
        changeEl.style.color = "#ef4444"
      }

    }

    // ===================================
    // 🔥 PROFIT STATUS TEXT
    // ===================================

    const profitText = document.getElementById("profitStatusText")

    if(profitText){
      if(todayProfit > 0){
        profitText.innerText = "Yaxshi ko‘rsatkich"
        profitText.style.color = "#16a34a"
      }else{
        profitText.innerText = "Yomon ko‘rsatkich"
        profitText.style.color = "#ef4444"
      }
    }

    // ===================================
    // 🔥 DEBT STATUS
    // ===================================

    const debtText = document.getElementById("debtStatusText")

    if(debtText){
      if(todayDebt > 0){
        debtText.innerText = "Qarz mavjud"
      }else{
        debtText.innerText = "Qarzdorlik yo‘q"
      }
    }

  }catch(e){
    console.error("Dashboard error:", e)
  }
}
