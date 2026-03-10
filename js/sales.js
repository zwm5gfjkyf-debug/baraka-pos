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
const nameKey = product.name.toLowerCase()

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

if(key.startsWith(query)){

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

div.onclick = () => addToCart(p)

resultsBox.appendChild(div)

})

}
// =======================================
// CART SYSTEM
// =======================================

function addToCart(product){

if(product.stock <= 0){
showToast("Zaxirada qolmadi")
return
}

let existing = cartMap[product.id]

if(existing){

if(existing.qty + 1 > product.stock){
showToast("Zaxirada yetarli mahsulot yo'q")
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

let total = 0

cart.forEach(item => {

const itemTotal = item.price * item.qty

total += itemTotal

const div = document.createElement("div")

div.className = "cart-item"

div.innerHTML = `

<b>${item.name}</b>

<div class="quantity-controls">

<button onclick="decreaseQty('${item.id}')">-</button>

<span>${item.qty}</span>

<button onclick="increaseQty('${item.id}')">+</button>

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
showToast("Mahsulot topilmadi")
return
}

if(item.qty + 1 > product.stock){
showToast("Zaxirada yetarli mahsulot yo'q")
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
if(cart.length === 0) return

const btn = document.getElementById("completeSaleBtn")
btn.disabled = true

let total = cart.reduce((t,i)=>t + i.price*i.qty,0)

const sale = {
items: cart,
total: total,
createdAt: firebase.firestore.FieldValue.serverTimestamp()}

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

console.warn("Sale saved offline")

}

cart = []
cartMap = {}
renderCart()

showSuccess("Sotuv yakunlandi")

loadDashboard()

btn.disabled = false

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

item.price = Number(newPrice)

renderCart()

}

// ===============================
// BARCODE SCANNER SYSTEM
// ===============================

let barcodeBuffer = ""
let barcodeTimer = null

document.addEventListener("keydown", function(e){

if(!e.key) return

if(e.key.length === 1 && /[0-9a-zA-Z]/.test(e.key)){
barcodeBuffer += e.key
}

clearTimeout(barcodeTimer)

barcodeTimer = setTimeout(()=>{
barcodeBuffer = ""
},300)
if(e.key === "Enter"){

if(!barcodeBuffer || barcodeBuffer.length < 3){
barcodeBuffer = ""
return
}

handleBarcodeScan(barcodeBuffer)

barcodeBuffer = ""

}

})

function handleBarcodeScan(barcode){

if(!barcode) return

barcode = barcode.trim()

const page = getCurrentPage()
const product = productIndexBarcode[barcode]

// play sound
scanSound.play().catch(()=>{})
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

// DEBT PAGE
else if(page === "debt"){

if(product){
addToDebtCart(product)
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
const search = document.getElementById("saleSearch")
if(search) search.focus()

}
