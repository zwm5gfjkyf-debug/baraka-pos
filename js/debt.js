// ===============================
// BARAKA POS DEBT SYSTEM
// ===============================

let debtCart = []
let debtProcessing = false
let debtPaymentProcessing = false
let lastClick = 0


// ===============================
// SEARCH PRODUCTS FOR DEBT
// ===============================

function searchDebtProducts(text){

const results = document.getElementById("debtSearchResults")
if(!results) return

results.innerHTML = ""

if(!text) return

const query = text.toLowerCase()

const filtered = productCache.filter(p =>
p.name.toLowerCase().startsWith(query)
)

filtered.slice(0,10).forEach(product => {

const div = document.createElement("div")

div.className = "search-item"

div.innerHTML = `
<b>${product.name}</b>
<span>${formatMoney(product.price)} so'm</span>
`

div.addEventListener("click", function(e){

e.preventDefault()
e.stopPropagation()

addDebtToCart(product)

results.innerHTML = ""

})

results.appendChild(div)

})

}


// ===============================
// ADD PRODUCT TO DEBT CART
// ===============================

function addDebtToCart(product){

const now = Date.now()

if(now - lastClick < 300) return

lastClick = now

if(product.stock <= 0){
showToast("Zaxirada qolmadi")
return
}

const existing = debtCart.find(i => i.id === product.id)

if(existing){

if(existing.qty + 1 > product.stock){
showToast("Zaxirada yetarli mahsulot yo'q")
return
}

existing.qty++

}else{

debtCart.push({
...product,
qty:1
})

}

renderDebtCart()

}


// ===============================
// RENDER DEBT CART
// ===============================

function renderDebtCart(){

const list = document.getElementById("debtCartList")

list.innerHTML = ""

let total = 0

debtCart.forEach(item => {

const itemTotal = item.price * item.qty

total += itemTotal

const div = document.createElement("div")

div.className = "cart-item"

div.innerHTML = `

<b>${item.name}</b>

<div class="quantity-controls">

<button onclick="decreaseDebtQty('${item.id}')">-</button>

<span>${item.qty}</span>

<button onclick="increaseDebtQty('${item.id}')">+</button>

</div>

<input
type="number"
value="${item.price}"
class="price-input"
onchange="changeDebtPrice('${item.id}', this.value)"
>

<strong>${formatMoney(itemTotal)} so'm</strong>

`

list.appendChild(div)

})

document.getElementById("debtTotal").innerText = formatMoney(total)

}

// ===============================
// QTY CONTROLS
// ===============================

function increaseDebtQty(id){

const item = debtCart.find(i => i.id === id)

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

renderDebtCart()

}

function decreaseDebtQty(id){

const item = debtCart.find(i => i.id === id)

if(!item) return

item.qty--
 
if(item.qty <= 0){
debtCart = debtCart.filter(i => i.id !== id)
}

renderDebtCart()

}



const item = debtCart.find(i => i.id === id)

if(!item) return

item.price = Number(newPrice)

renderDebtCart()

}
// ===============================
// COMPLETE DEBT SALE
// ===============================

async function completeDebtSale(){

if(debtProcessing) return
debtProcessing = true

const btn = document.getElementById("debtCompleteBtn")
btn.innerText = "Berilyapti..."
btn.disabled = true

try{

const customer = document
.getElementById("debtCustomerName")
.value
.trim()

if(!customer){
showToast("Mijoz ismini kiriting")
btn.innerText = "Nasiya berish"
btn.disabled = false
debtProcessing = false
return
}

if(debtCart.length === 0){
showToast("Mahsulot tanlang")
btn.innerText = "Nasiya berish"
btn.disabled = false
debtProcessing = false
return
}

let total = 0
let profit = 0

debtCart.forEach(i => {

total += i.price * i.qty
profit += (i.price - i.cost) * i.qty

})

const debtsRef = db
.collection("shops")
.doc(currentShopId)
.collection("debts")
await db
.collection("shops")
.doc(currentShopId)
.collection("sales")
.add({
items: debtCart,
total: total,
type: "debt",
createdAt: new Date()
})
const existing = await debtsRef
.where("customer","==",customer)
.where("status","in",["unpaid","partial"])
.get()

if(existing.empty){

await debtsRef.add({
customer: customer,
items: debtCart,
total: total,
remaining: total,
profit: profit,
status: "unpaid",
createdAt: new Date()
})

}else{

const doc = existing.docs[0]
const data = doc.data()

await doc.ref.update({
items: [...data.items, ...debtCart],
total: data.total + total,
remaining: data.remaining + total,
profit: (data.profit || 0) + profit
})

}


// ===============================
// UPDATE STOCK
// ===============================

for(const item of debtCart){

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
throw new Error("Not enough stock")
}

t.update(ref,{
stock: Math.max(0, stock - item.qty)
})
const p = productCache.find(p => p.id === item.id)

if(p){
p.stock -= item.qty
}

}


// CLEAR CART

debtCart = []

renderDebtCart()

showSuccess("Nasiya saqlandi")

btn.innerText = "Nasiya berish"
btn.disabled = false

}

finally{

debtProcessing = false

}

}


// ===============================
// LOAD DEBT CUSTOMERS
// ===============================

async function loadDebtCustomers(){

const container = document.getElementById("debtCustomersList")
if(!container) return
db
.collection("shops")
.doc(currentShopId)
.collection("debts")
.onSnapshot(snapshot=>{
container.innerHTML = ""
const customers = {}

snapshot.forEach(doc=>{

const d = doc.data()

// ignore fully paid debts
if(d.remaining <= 0) return

if(!customers[d.customer]){
customers[d.customer] = {
remaining:0,
docId:doc.id
}
}

customers[d.customer].remaining += d.remaining

})

Object.entries(customers).forEach(([name,data])=>{

const div = document.createElement("div")

div.className = "debt-item"

div.innerHTML = `
<strong>${name}</strong>
<p>Qolgan: ${formatMoney(data.remaining)}</p>

<input id="pay_${data.docId}" placeholder="To'lov">

<button onclick="payDebt('${data.docId}', this)">
To'lash
</button>
`

container.appendChild(div)

})
})
}
// ===============================
// PAY DEBT
// ===============================

async function payDebt(id, btn){

if(debtPaymentProcessing) return
debtPaymentProcessing = true

btn.innerText = "To'lanmoqda..."
btn.disabled = true

try{

const input = document.getElementById("pay_"+id)
const amount = Number(input.value)

if(!amount || isNaN(amount)){
showToast("To'lov summasini kiriting")
return
}

const ref = db
.collection("shops")
.doc(currentShopId)
.collection("debts")
.doc(id)

const doc = await ref.get()

if(!doc.exists){
showToast("Qarz topilmadi")
return
}

const data = doc.data()

if(amount > data.remaining){
showToast("To'lov qarzdan katta bo'lishi mumkin emas")
return
}

const profitRatio = data.total ? data.profit / data.total : 0
const profitPart = amount * profitRatio

const newRemaining = data.remaining - amount

if(newRemaining <= 0){

await ref.update({
remaining: 0,
status: "paid"
})

}else{

await ref.update({
remaining: newRemaining,
status: "partial"
})

}

const salesRef = db
.collection("shops")
.doc(currentShopId)
.collection("sales")

await salesRef.add({
items: [{
name:"Debt payment",
price:amount,
cost:amount - profitPart,
qty:1
}],
total: amount,
createdAt: new Date(),
type: "debt_payment"
})

showSuccess("To'lov qabul qilindi")

input.value = ""


}
catch(e){

console.error(e)
showToast("Xatolik yuz berdi")

}
finally{

btn.innerText = "To'lash"
btn.disabled = false
debtPaymentProcessing = false

}

}


