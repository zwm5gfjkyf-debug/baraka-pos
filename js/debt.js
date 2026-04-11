// ===============================
// BARAKA POS DEBT SYSTEM
// ===============================

let debtCart = []
let debtProcessing = false
let debtPaymentProcessing = false
let lastClick = 0
let debtAnalyticsListener = null
let debtAnalyticsState = {
  debts: [],
  search: '',
  sortDesc: true
}
let debtPaymentTarget = null


// ===============================
// SEARCH PRODUCTS FOR DEBT
// ===============================

function searchDebtProducts(text){

const results = document.getElementById("debtSearchResults")
if(!results) return

results.innerHTML = ""

if(!text) return

const query = text.toLowerCase()

const keys = productKeys
let filtered = []

for(let i=0;i<keys.length;i++){

const key = keys[i]

if(key.startsWith(query)){
filtered = filtered.concat(productIndex[key])
}

}

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

if(!product || product.stock <= 0){
showTopBanner("Zaxirada qolmadi","error")
return
}

const existing = debtCart.find(i => i.id === product.id)

if(existing){

if(existing.qty + 1 > product.stock){
showTopBanner("Zaxirada yetarli mahsulot yo'q","error")
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
if(!list) return

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

const totalEl = document.getElementById("debtTotal")
if(totalEl) totalEl.innerText = formatMoney(total)
}


// ===============================
// QTY CONTROLS
// ===============================

function increaseDebtQty(id){

const item = debtCart.find(i => i.id === id)

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


function changeDebtPrice(id,newPrice){

const item = debtCart.find(i => i.id === id)

if(!item) return

item.price = Number(newPrice || 0)

renderDebtCart()

}


// ===============================
// COMPLETE DEBT SALE
// ===============================

async function completeDebtSale(){

if(debtProcessing) return
debtProcessing = true

const btn = document.getElementById("debtCompleteBtn")

if(btn){
btn.innerText = "Berilyapti..."
btn.disabled = true
}

try{

const customer = document
.getElementById("debtCustomerName")?.value.trim() || ""

if(!customer){
showTopBanner("Mijoz ismini kiriting","error")
if(btn){
btn.innerText = "Nasiya berish"
btn.disabled = false
}
debtProcessing = false
return
}

if(debtCart.length === 0){
showTopBanner("Mahsulot tanlang","error")
if(btn){
btn.innerText = "Nasiya berish"
btn.disabled = false
}
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
createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
showTopBanner("Zaxirada yetarli mahsulot yo'q","error")
throw new Error("Not enough stock")
}

t.update(ref,{
stock: Math.max(0, stock - item.qty)
})

})

const p = productCache.find(p => p.id === item.id)
if(p){
p.stock -= item.qty
}

}

// CLEAR CART

debtCart = []

renderDebtCart()

if(typeof scanSound !== "undefined"){
scanSound.currentTime = 0
scanSound.play().catch(()=>{})
}

showTopBanner("Nasiya saqlandi","success")

if(btn){
btn.innerText = "Nasiya berish"
btn.disabled = false
}

}
finally{
debtProcessing = false
}

}




// ===============================
// DEBT ANALYTICS REAL-TIME
// ===============================

function formatDebtDate(timestamp){
  if(!timestamp) return '-'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getDebtInitials(name){
  if(!name) return 'NA'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0,2)
    .map(part => part[0].toUpperCase())
    .join('')
}

function getDebtStatus(debt){
  const now = new Date()
  const created = debt.createdAt?.toDate ? debt.createdAt.toDate() : new Date(debt.createdAt || now)
  const due = debt.dueDate?.toDate ? debt.dueDate.toDate() : new Date(debt.dueDate || now)
  const totalTime = due - created
  const elapsed = now - created
  const progress = totalTime > 0 ? Math.min(Math.max(elapsed / totalTime, 0), 1) : 1

  if(now > due) return { variant: 'overdue', progress, due, created }
  if(progress >= 0.7) return { variant: 'warning', progress, due, created }
  return { variant: 'safe', progress, due, created }
}

function getDebtBadgeText(debt){
  const now = new Date()
  const status = getDebtStatus(debt)
  const due = status.due
  const created = status.created

  if(status.variant === 'overdue'){
    const daysOverdue = Math.max(1, Math.ceil((now - due) / (1000 * 60 * 60 * 24)))
    return `${daysOverdue} kun muddati o'tgan`
  }

  if(status.variant === 'warning'){
    const daysLeft = Math.max(1, Math.ceil((due - now) / (1000 * 60 * 60 * 24)))
    return `${daysLeft} kun qoldi`
  }

  const daysSince = Math.max(1, Math.ceil((now - created) / (1000 * 60 * 60 * 24)))
  return `Yangi • ${daysSince} kun oldin`
}

function setDebtSearch(value){
  debtAnalyticsState.search = (value || '').trim().toLowerCase()
  renderDebtAnalytics()
}

function clearDebtSearchInput(){
  const input = document.getElementById('debtAnalyticsSearch')
  if(input) input.value = ''
  setDebtSearch('')
}

function toggleDebtSort(){
  debtAnalyticsState.sortDesc = !debtAnalyticsState.sortDesc
  const button = document.getElementById('debtSortButton')
  if(button){
    button.innerText = debtAnalyticsState.sortDesc ? 'Ko‘p qarz ↓' : 'Kam qarz ↑'
  }
  renderDebtAnalytics()
}

function renderDebtAnalytics(){
  const list = document.getElementById('debtAnalyticsList')
  const emptyState = document.getElementById('debtEmptyState')
  const totalBox = document.getElementById('debtAnalyticsTotal')
  const clientsBox = document.getElementById('debtAnalyticsClients')
  const overdueBox = document.getElementById('debtOverdueCount')
  const monthBox = document.getElementById('debtMonthCount')
  const maxBox = document.getElementById('debtMaxAmount')

  if(!list || !totalBox || !clientsBox || !overdueBox || !monthBox || !maxBox) return

  const now = new Date()
  const allDebts = debtAnalyticsState.debts
  const totalDebt = allDebts.reduce((sum, debt) => sum + (debt.remaining || 0), 0)
  const uniqueClients = new Set(allDebts.map(d => d.customer?.trim() || 'Noma\'lum')).size
  const overdueCount = allDebts.filter(debt => getDebtStatus(debt).variant === 'overdue').length
  const monthCount = allDebts.filter(debt => {
    const created = debt.createdAt?.toDate ? debt.createdAt.toDate() : new Date(debt.createdAt || now)
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
  }).length
  const maxDebt = allDebts.reduce((max, debt) => Math.max(max, debt.remaining || 0), 0)

  totalBox.innerText = formatMoney(totalDebt)
  clientsBox.innerText = uniqueClients.toLocaleString('uz-UZ')
  overdueBox.innerText = overdueCount.toLocaleString('uz-UZ')
  monthBox.innerText = monthCount.toLocaleString('uz-UZ')
  maxBox.innerText = formatMoney(maxDebt)

  const search = debtAnalyticsState.search
  const filtered = allDebts.filter(debt => {
    const name = (debt.customer || '').toLowerCase()
    const phone = (debt.phone || '').toLowerCase()
    return name.includes(search) || phone.includes(search)
  })

  filtered.sort((a, b) => {
    const aValue = a.remaining || 0
    const bValue = b.remaining || 0
    return debtAnalyticsState.sortDesc ? bValue - aValue : aValue - bValue
  })

  if(filtered.length === 0){
    list.innerHTML = ''
    emptyState.classList.remove('hidden')
    return
  }

  emptyState.classList.add('hidden')

  list.innerHTML = filtered.map(debt => {
    const initials = getDebtInitials(debt.customer)
    const status = getDebtStatus(debt)
    const badge = getDebtBadgeText(debt)
    const progress = Math.round(status.progress * 100)
    const createdLabel = formatDebtDate(debt.createdAt)
    const remaining = formatMoney(debt.remaining || 0)

    return `
      <div class="debt-customer-card">
        <div class="debt-card-row">
          <div class="debt-avatar debt-avatar-${status.variant}">${initials}</div>
          <div class="debt-card-meta">
            <div class="debt-name">${debt.customer || 'Noma\'lum mijoz'}</div>
            <div class="debt-subtitle">Oxirgi nasiya: ${createdLabel}</div>
          </div>
          <div class="debt-amount-block">
            <div class="debt-amount-value">${remaining}</div>
            <div class="debt-amount-label">so'm qarz</div>
          </div>
        </div>
        <div class="debt-progress-track">
          <div class="debt-progress-fill debt-progress-${status.variant}" style="width:${progress}%;"></div>
        </div>
        <div class="debt-card-footer">
          <span class="debt-badge debt-badge-${status.variant}">${badge}</span>
          <button class="debt-pay-button" onclick="openDebtPaymentModal('${debt.id}')">To‘lov qabul qilish →</button>
        </div>
      </div>
    `
  }).join('')
}

function openDebtPaymentModal(id){
  const debt = debtAnalyticsState.debts.find(item => item.id === id)
  if(!debt) return

  debtPaymentTarget = id
  const customer = document.getElementById('paymentModalCustomer')
  const remaining = document.getElementById('paymentModalRemaining')
  const amountInput = document.getElementById('paymentAmountInput')
  const modal = document.getElementById('debtPaymentModal')

  if(customer) customer.innerText = `Mijoz: ${debt.customer || 'Noma\'lum'}`
  if(remaining) remaining.innerText = `Qolgan qarz: ${formatMoney(debt.remaining || 0)}`
  if(amountInput) amountInput.value = ''
  if(modal) modal.classList.remove('hidden')
}

function closeDebtPaymentModal(){
  const modal = document.getElementById('debtPaymentModal')
  if(modal) modal.classList.add('hidden')
  debtPaymentTarget = null
}

async function submitDebtPayment(){
  if(!debtPaymentTarget || debtPaymentProcessing) return
  const amountInput = document.getElementById('paymentAmountInput')
  const amount = Number(amountInput?.value || 0)

  if(!amount || isNaN(amount) || amount <= 0){
    showTopBanner('To‘lov summasini kiriting', 'error')
    return
  }

  debtPaymentProcessing = true
  try{
    const ref = db.collection('shops').doc(currentShopId).collection('debts').doc(debtPaymentTarget)
    const doc = await ref.get()
    if(!doc.exists){
      showTopBanner('Qarz topilmadi', 'error')
      return
    }

    const data = doc.data()
    const remaining = data.remaining || 0
    if(amount > remaining){
      showTopBanner('To‘lov qarzdan katta bo‘lishi mumkin emas', 'error')
      return
    }

    const profitRatio = data.total ? ((data.profit || 0) / data.total) : 0
    const profitPart = amount * profitRatio
    const newRemaining = remaining - amount

    await ref.update({
      remaining: newRemaining,
      status: newRemaining <= 0 ? 'paid' : 'partial'
    })

    await db.collection('shops').doc(currentShopId).collection('sales').add({
      items: [{ name: 'Debt payment', price: amount, cost: amount - profitPart, qty: 1 }],
      total: amount,
      type: 'debt_payment',
      customer: data.customer || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })

    closeDebtPaymentModal()
    showTopBanner('To‘lov qabul qilindi', 'success')
  }
  catch(error){
    console.error(error)
    showTopBanner('Xatolik yuz berdi', 'error')
  }
  finally{
    debtPaymentProcessing = false
  }
}

function openNewDebtModal(){
  const modal = document.getElementById('debtNewModal')
  if(modal){
    modal.classList.remove('hidden')
  }
}

function closeNewDebtModal(){
  const modal = document.getElementById('debtNewModal')
  if(modal){
    modal.classList.add('hidden')
  }
}

async function submitNewDebt(){
  if(debtProcessing) return
  const nameInput = document.getElementById('newDebtCustomer')
  const phoneInput = document.getElementById('newDebtPhone')
  const amountInput = document.getElementById('newDebtAmount')
  const dueInput = document.getElementById('newDebtDueDate')

  const customer = nameInput?.value.trim() || ''
  const phone = phoneInput?.value.trim() || ''
  const amount = Number(amountInput?.value || 0)
  const dueDateValue = dueInput?.value || ''

  if(!customer){
    showTopBanner('Mijoz nomini kiriting', 'error')
    return
  }
  if(!amount || isNaN(amount) || amount <= 0){
    showTopBanner('To‘lov summasini kiriting', 'error')
    return
  }
  if(!dueDateValue){
    showTopBanner('Muddati uchun sanani tanlang', 'error')
    return
  }

  const now = new Date()
  const dueDate = new Date(dueDateValue)
  dueDate.setHours(23,59,59,999)

  if(dueDate <= now){
    showTopBanner('Muddati bugundan keyin bo‘lishi kerak', 'error')
    return
  }

  debtProcessing = true
  try{
    const debtsRef = db.collection('shops').doc(currentShopId).collection('debts')
    const existing = await debtsRef
      .where('customer', '==', customer)
      .where('status', 'in', ['unpaid', 'partial'])
      .get()

    if(existing.empty){
      await debtsRef.add({
        customer,
        phone,
        total: amount,
        remaining: amount,
        profit: 0,
        status: 'unpaid',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        dueDate: firebase.firestore.Timestamp.fromDate(dueDate)
      })
    } else {
      const doc = existing.docs[0]
      const data = doc.data()
      await doc.ref.update({
        total: (data.total || 0) + amount,
        remaining: (data.remaining || 0) + amount,
        dueDate: firebase.firestore.Timestamp.fromDate(dueDate),
        phone,
        status: 'partial'
      })
    }

    await db.collection('shops').doc(currentShopId).collection('sales').add({
      items: [{ name: 'Debt sale', price: amount, cost: 0, qty: 1 }],
      total: amount,
      type: 'debt',
      customer,
      phone,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })

    nameInput.value = ''
    phoneInput.value = ''
    amountInput.value = ''
    dueInput.value = ''
    closeNewDebtModal()
    showTopBanner('Yangi nasiya saqlandi', 'success')
  }
  catch(error){
    console.error(error)
    showTopBanner('Xatolik yuz berdi', 'error')
  }
  finally{
    debtProcessing = false
  }
}

async function loadDebtCustomers(){
  const list = document.getElementById('debtAnalyticsList')
  const emptyState = document.getElementById('debtEmptyState')
  const dateBox = document.getElementById('debtAnalyticsDate')
  if(!list || !currentShopId) return

  if(dateBox){
    const now = new Date()
    dateBox.innerText = now.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  if(emptyState) emptyState.classList.add('hidden')
  if(debtAnalyticsState.debts.length > 0){
    renderDebtAnalytics()
  } else {
    list.innerHTML = '<div class="debt-loading">Yuklanmoqda...</div>'
  }

  if(typeof debtAnalyticsListener === 'function'){
    debtAnalyticsListener()
  }

  debtAnalyticsListener = db.collection('shops').doc(currentShopId).collection('debts')
    .where('remaining', '>', 0)
    .onSnapshot(snapshot => {
      const debts = []
      snapshot.forEach(doc => {
        const data = doc.data()
        if(data.remaining <= 0) return
        debts.push({ id: doc.id, ...data })
      })

      debtAnalyticsState.debts = debts
      renderDebtAnalytics()
    }, error => {
      console.error('Debt analytics listener failed:', error)
      if(list) list.innerHTML = '<div class="debt-error">Ma'lumot olinmadi. Internetni tekshiring.</div>'
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
showTopBanner("To'lov summasini kiriting","error")
return
}

const ref = db
.collection("shops")
.doc(currentShopId)
.collection("debts")
.doc(id)

const doc = await ref.get()

if(!doc.exists){
showTopBanner("Qarz topilmadi","error")
return
}

const data = doc.data()

if(amount > data.remaining){
showTopBanner("To'lov qarzdan katta bo'lishi mumkin emas","error")
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
createdAt: firebase.firestore.FieldValue.serverTimestamp(),
type: "debt_payment"
})

if(typeof scanSound !== "undefined"){
scanSound.currentTime = 0
scanSound.play().catch(()=>{})
}

showTopBanner("To'lov qabul qilindi","success")

input.value = ""

}
catch(e){
console.error(e)
showTopBanner("Xatolik yuz berdi","error")
}
finally{

btn.innerText = "To'lash"
btn.disabled = false
debtPaymentProcessing = false

}

}


// ===============================
// CLEAR SEARCH
// ===============================

function clearDebtSearch(){

const input = document.getElementById("debtSearch")

if(input){
input.value = ""
}

const results = document.getElementById("debtSearchResults")

if(results){
results.innerHTML = ""
}

}
