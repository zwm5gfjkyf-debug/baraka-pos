// =======================================
// BARAKA POS – ULTRA FAST SALES ENGINE
// =======================================

// product cache (in memory)
let productCache = []
let productIndex = {}

let cart = []


// =======================================
// LOAD PRODUCTS INTO MEMORY
// =======================================

async function loadProducts(){

    if(!currentShopId) return

    const snapshot = await db
        .collection("shops")
        .doc(currentShopId)
        .collection("products")
        .get()

    productCache = []
    productIndex = {}

    snapshot.forEach(doc => {

        const data = doc.data()

        const product = {
            id: doc.id,
            name: data.name || "",
            price: data.price || 0,
            cost: data.cost || 0,
            stock: data.stock || 0
        }

        productCache.push(product)

        const key = product.name.toLowerCase()

        if(!productIndex[key]){
            productIndex[key] = []
        }

        productIndex[key].push(product)

    })

}



// =======================================
// ULTRA FAST SEARCH
// =======================================

async function searchProducts(text){

const resultsBox = document.getElementById("searchResults")
resultsBox.innerHTML = ""

if(!text) return

const query = text.toLowerCase()

const snapshot = await db
.collection("shops")
.doc(currentShopId)
.collection("products")
.orderBy("name")
.startAt(query)
.endAt(query + "\uf8ff")
.limit(20)
.get()

snapshot.forEach(doc => {

const p = doc.data()

const div = document.createElement("div")
div.className = "search-item"

div.innerHTML = `
<span>${p.name}</span>
<strong>${formatMoney(p.price)}</strong>
`

div.onclick = () => addToCart({
id: doc.id,
...p
})

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

const existing = cart.find(i => i.id === product.id)

if(existing){

if(existing.qty + 1 > product.stock){
showToast("Zaxirada yetarli mahsulot yo'q")
return
}

existing.qty++

}else{

cart.push({
...product,
qty:1
})

}

renderCart()

}



// =======================================
// RENDER CART
// =======================================

function renderCart(){

const list = document.getElementById("cartList")

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

<button class="qty-btn"
onclick="decreaseQty('${item.id}')">-</button>

<span>${item.qty}</span>

<button class="qty-btn"
onclick="increaseQty('${item.id}')">+</button>

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



// =======================================
// QUANTITY CONTROL
// =======================================

function increaseQty(id){

const item = cart.find(i => i.id === id)

const product = productCache.find(p => p.id === id)

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

const item = cart.find(i => i.id === id)

item.qty--

if(item.qty <= 0){

cart = cart.filter(i => i.id !== id)

}

renderCart()

}



// =======================================
// COMPLETE SALE
// =======================================

async function completeSale(){

if(cart.length === 0) return

const btn = document.getElementById("completeSaleBtn")
btn.disabled = true

let total = 0
cart.forEach(i => total += i.price * i.qty)

const sale = {
items: cart,
total: total,
createdAt: new Date()
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

console.warn("Sale saved offline")

}

cart = []

renderCart()

showSuccess("Sotuv yakunlandi")

loadDashboard()

btn.disabled = false

}



// =======================================
// UPDATE STOCK
// =======================================

async function updateStockAfterSale(items){

for(const item of items){

const ref = db
.collection("shops")
.doc(currentShopId)
.collection("products")
.doc(item.id)

await db.runTransaction(async t => {

const doc = await t.get(ref)

const stock = doc.data().stock || 0

if(stock < item.qty){
showToast("Zaxirada yetarli mahsulot yo'q")
throw new Error("Stock not enough")
}

t.update(ref,{
stock: stock - item.qty
})

})

}

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
