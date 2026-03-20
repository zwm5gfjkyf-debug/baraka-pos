// =======================================
// BARAKA POS – ULTRA FAST SALES ENGINE
// =======================================

// product cache (in memory)
// product cache (in memory)
let productCache = []
let productIndex = {}
let productIndexBarcode = {}
let productKeys = []        // search optimization
let productById = {}        // cart optimization
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

const product = {
id: doc.id,
name: data.name || "",
barcode: data.barcode || "",
price: data.price || 0,
cost: data.cost || 0,
stock: data.stock || 0
}

productCache.push(product)
productById[product.id] = product
// INDEX BY NAME
const nameKey = (product.name || "").toLowerCase()
  
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
// ULTRA FAST SEARCH
// =======================================

function searchProducts(text){

const resultsBox = document.getElementById("searchResults")
resultsBox.innerHTML = ""

if(!text) return

const query = text.toLowerCase()

let results = []   // ✅ THIS WAS MISSING

const keys = productKeys
for(let i=0;i<keys.length;i++){

const key = keys[i]

if(key.includes(query)){
results.push(...productIndex[key])
if(results.length >= 20) break

}

}

results.slice(0,20).forEach(p => {

const div = document.createElement("div")
div.className = "search-item"

div.innerHTML = `
<span>${p.name}</span>
<strong>${formatMoney(p.price)}</strong>
`

div.onclick = () => {
addToCart(p)
clearSearch()

const input = document.getElementById("saleSearch")
if(input) input.focus()
}
resultsBox.appendChild(div)

})

}
// =======================================
// CART SYSTEM
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
// RENDER CART
// =======================================

function renderCart(){

const list = document.getElementById("cartList")
if(!list) return
list.innerHTML = ""
const saleTypeBox = document.getElementById("saleTypeContainer")
const debtInput = document.getElementById("debtCustomer")

if(!saleTypeBox) return

if(cart.length > 0){

saleTypeBox.classList.remove("hidden")
}else{

saleTypeBox.classList.add("hidden")

// reset everything when cart empty
saleType = "cash"

if(debtInput){
debtInput.value = ""
debtInput.classList.add("hidden")
}

const cash = document.getElementById("cashBtn")
const debt = document.getElementById("debtBtn")

if(cash) cash.classList.add("active")
if(debt) debt.classList.remove("active")

}
let total = 0

cart.forEach(item => {

const itemTotal = item.price * item.qty

total += itemTotal

const div = document.createElement("div")

div.className = "cart-item"

div.innerHTML = `

<div class="cart-row">

<span class="cart-name">${item.name}</span>

<div class="quantity-controls">

<button class="qty-btn" onclick="decreaseQty('${item.id}')">-</button>

<span class="qty-number">${item.qty}</span>

<button class="qty-btn" onclick="increaseQty('${item.id}')">+</button>

</div>

</div>

<input
type="number"
value="${item.price}"
class="price-input"
onchange="changePrice('${item.id}', this.value)"
>

<strong>${formatMoney(itemTotal)} so'm</strong>

`
list.appendChild(div)

})

document.getElementById("saleTotal").innerText = formatMoney(total)

}

function clearSearch(){

const input = document.getElementById("saleSearch")

if(input){
input.value = ""
}

document.getElementById("searchResults").innerHTML = ""

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

const salesRef = db
.collection("shops")
.doc(currentShopId)
.collection("sales")

await salesRef.add(sale)

await updateStockAfterSale(cart)

}
catch(e){

let offline = JSON.parse(localStorage.getItem("offlineSales") || "[]")

offline.push(sale)

localStorage.setItem("offlineSales", JSON.stringify(offline))

showTopBanner("Internet yo'q — offline saqlandi", "error")

}
finally{
btn.disabled = false
}

cart = []
cartMap = {}
saleType = "cash"

document.getElementById("debtCustomer").value = ""
document.getElementById("debtCustomer").classList.add("hidden")

document.getElementById("cashBtn").classList.add("active")
document.getElementById("debtBtn").classList.remove("active")

renderCart()

showTopBanner("Sotuv yakunlandi","success")

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
// BARCODE SCANNER SYSTEM
// ===============================

let barcodeBuffer = ""
let barcodeTimer = null

document.addEventListener("keydown", function(e){
if(document.activeElement && 
["INPUT","TEXTAREA"].includes(document.activeElement.tagName)){
return
}
if(!e.key) return

if(e.key.length === 1 && /[0-9]/.test(e.key)){
barcodeBuffer += e.key
}

clearTimeout(barcodeTimer)

barcodeTimer = setTimeout(()=>{
barcodeBuffer = ""
},200)
if(e.key === "Enter"){

if(barcodeBuffer.length < 3){
barcodeBuffer = ""
return
}

// prevent double scan
if(window.scanLock) return
window.scanLock = true

handleBarcodeScan(barcodeBuffer)

setTimeout(()=>{
window.scanLock = false
},400)
barcodeBuffer = ""

}

})

function handleBarcodeScan(barcode){
if(Object.keys(productIndexBarcode).length === 0) return
if(!barcode) return

barcode = barcode.trim()

const page = getCurrentPage()
const product = productIndexBarcode[barcode]

// play sound
if(scanSound){
scanSound.pause()
scanSound.currentTime = 0
scanSound.play().catch(()=>{})
}
  // SALE PAGE
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


// STOCK PAGE
else if(page === "stock"){

if(product){
openEditModal(product.id)
}else{
openAddProductModal()
document.getElementById("stockBarcode").value = barcode
}

}

// keep scanner ready
// keep scanner ready for next item
const search = document.getElementById("saleSearch")

if(search){
search.value = ""
}
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
// CAMERA BARCODE SCANNER
// ===============================

function startCameraScanner(){

const container = document.getElementById("cameraScanner")
if(container) container.classList.remove("hidden")

Quagga.offDetected()

Quagga.init({inputStream:{
type:"LiveStream",
target:document.querySelector('#scannerViewport'),
constraints:{
facingMode:"environment"
}
},
decoder:{
readers:["ean_reader","code_128_reader","upc_reader"]
}
},function(err){
if(err){
console.error(err)
return
}
Quagga.start()
})

Quagga.onDetected(function(data){

const code = data.codeResult.code

stopCameraScanner()

handleBarcodeScan(code)

})

}

function stopCameraScanner(){

const container = document.getElementById("cameraScanner")

if(container){
container.classList.add("hidden")
}

if(window.Quagga){
Quagga.stop()
}

}
