/* =====================================================
   BARAKA POS PRO
   CORE SYSTEM
===================================================== */

let saleProducts = []
let productIndex = []
let cart = []
let debtCart = []

let productListener = null
let dashboardListener = null
let stockListener = null

/* ================= MONEY ================= */

function formatMoney(num){
  return Number(num || 0)
  .toLocaleString("ru-RU")
  .replace(/,/g," ")
}

/* ================= USER ================= */

function safeGetUserId(){
  return auth.currentUser ? auth.currentUser.uid : null
}

/* ================= DATE HELPERS ================= */

function getStartOfToday(){
  const d = new Date()
  d.setHours(0,0,0,0)
  return d
}

function getStartOfWeek(){
  const d = new Date()
  const day = d.getDay() || 7
  if(day !== 1){
    d.setDate(d.getDate()-(day-1))
  }
  d.setHours(0,0,0,0)
  return d
}

function getStartOfMonth(){
  const d = new Date()
  d.setDate(1)
  d.setHours(0,0,0,0)
  return d
}

/* ================= NOTIFY ================= */

function notify(msg,type="success"){

  const box=document.createElement("div")
  box.className="pos-notify"
  box.innerText=msg

  if(type==="error") box.style.background="#ef4444"

  document.body.appendChild(box)

  setTimeout(()=>box.remove(),2000)

}

/* ================= SUCCESS ================= */

function showSuccess(text){

  const overlay=document.getElementById("successOverlay")
  const label=document.getElementById("successText")

  if(!overlay) return

  label.innerText=text

  overlay.classList.remove("hidden")

  setTimeout(()=>{
    overlay.classList.add("hidden")
  },1500)

}

/* =====================================================
   AUTH SYSTEM
===================================================== */

auth.onAuthStateChanged(user=>{

  const loading=document.getElementById("loadingScreen")
  if(loading) loading.classList.add("hidden")

  if(user){

    document.getElementById("authScreen")?.classList.add("hidden")
    document.getElementById("appScreen")?.classList.remove("hidden")

    document.getElementById("shopTitle").innerText=user.email

    loadProducts()
    loadDashboard()

  }else{

    document.getElementById("appScreen")?.classList.add("hidden")
    document.getElementById("authScreen")?.classList.remove("hidden")

  }

})

async function register(){

  const shopName=document.getElementById("shopName").value.trim()
  const email=document.getElementById("email").value.trim()
  const pass=document.getElementById("password").value

  if(!shopName || !email || !pass){
    notify("Maydonlarni to'ldiring","error")
    return
  }

  const cred=await auth.createUserWithEmailAndPassword(email,pass)

  await db.collection("shops")
  .doc(cred.user.uid)
  .set({
    shopName,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  })

}

async function login(){

  const email=document.getElementById("email").value.trim()
  const pass=document.getElementById("password").value

  await auth.signInWithEmailAndPassword(email,pass)

}

function logout(){
  auth.signOut()
}

function toggleProfileMenu(){

  const menu=document.getElementById("profileMenu")
  if(menu) menu.classList.toggle("hidden")

}

/* =====================================================
   NAVIGATION
===================================================== */

function navigate(pageId){

  document.querySelectorAll(".page")
  .forEach(p=>p.classList.add("hidden"))

  const page=document.getElementById(pageId)
  if(page) page.classList.remove("hidden")

}

/* =====================================================
   PRODUCT LOADING
===================================================== */

function loadProducts(){

  const shopId=safeGetUserId()
  if(!shopId) return

  if(productListener) productListener()

  productListener=db.collection("shops")
  .doc(shopId)
  .collection("products")
  .onSnapshot(snapshot=>{

    saleProducts=[]
    productIndex=[]

    snapshot.forEach(doc=>{

      const p={id:doc.id,...doc.data()}

      saleProducts.push(p)

      productIndex.push({
        name:p.name.toLowerCase(),
        product:p
      })

    })

  })

}

/* =====================================================
   ULTRA FAST PRODUCT SEARCH
===================================================== */

function searchProducts(keyword){

  const results=document.getElementById("searchResults")
  if(!results) return

  results.innerHTML=""

  if(!keyword) return

  keyword=keyword.toLowerCase()

  const matches=productIndex
  .filter(p=>p.name.includes(keyword))
  .slice(0,20)

  matches.forEach(obj=>{

    const p=obj.product

    results.innerHTML+=`
    <div class="card" onclick="addToCart('${p.id}')">
      <strong>${p.name}</strong>
      <div>${formatMoney(p.sellingPrice)} so'm</div>
    </div>
    `

  })

}

function focusSaleSearch(){

  const input=document.getElementById("saleSearch")
  if(input) input.focus()

}
/* =====================================================
   CART ENGINE (NAQD SAVDO)
===================================================== */

function addToCart(productId){

  const product = saleProducts.find(p=>p.id===productId)
  if(!product) return

  const existing = cart.find(i=>i.id===productId)

  if(existing){
    existing.quantity += 1
  }else{
    cart.push({
      id:product.id,
      name:product.name,
      price:product.sellingPrice || 0,
      cost:product.costPrice || 0,
      quantity:1
    })
  }

  renderCart()
}

/* REMOVE */

function removeFromCart(id){

  cart = cart.filter(i=>i.id!==id)

  renderCart()

}

/* CHANGE PRICE */

function changePrice(id,newPrice){

  const item = cart.find(i=>i.id===id)
  if(!item) return

  item.price = Number(newPrice) || 0

  renderCart()

}

/* CHANGE QTY */

function changeQty(id,amount){

  const item = cart.find(i=>i.id===id)
  if(!item) return

  item.quantity += amount

  if(item.quantity <= 0){
    removeFromCart(id)
    return
  }

  renderCart()

}

/* MANUAL QTY */

function changeQtyManual(id,value){

  const item = cart.find(i=>i.id===id)
  if(!item) return

  item.quantity = Number(value) || 1

  renderCart()

}

/* CLEAR */

function clearCart(){

  cart = []

  renderCart()

}

/* =====================================================
   RENDER CART
===================================================== */

function renderCart(){

  const container=document.getElementById("cartList")
  if(!container) return

  container.innerHTML=""

  let total=0

  cart.forEach(item=>{

    const itemTotal=item.price*item.quantity
    total+=itemTotal

    container.innerHTML+=`

    <div class="cart-item">

      <strong>${item.name}</strong>

      <div>
        Narx:
        <input type="number"
        value="${item.price}"
        onchange="changePrice('${item.id}',this.value)">
      </div>

      <div class="quantity-controls">

        <button class="qty-btn"
        onclick="changeQty('${item.id}',-1)">-</button>

        <input type="number"
        value="${item.quantity}"
        style="width:60px"
        onchange="changeQtyManual('${item.id}',this.value)">

        <button class="qty-btn"
        onclick="changeQty('${item.id}',1)">+</button>

      </div>

      <div>
      Jami: ${formatMoney(itemTotal)} so'm
      </div>

      <button
      style="background:var(--danger)"
      onclick="removeFromCart('${item.id}')">
      O'chirish
      </button>

    </div>

    `
  })

  const totalEl=document.getElementById("saleTotal")
  if(totalEl) totalEl.innerText=formatMoney(total)

}

/* =====================================================
   COMPLETE SALE (NAQD)
===================================================== */

async function completeSale(){

  const button=document.getElementById("completeSaleBtn")

  if(button){
    button.disabled=true
    button.innerText="Yuklanmoqda..."
  }

  if(cart.length===0){

    notify("Savatcha bo'sh","error")

    if(button){
      button.disabled=false
      button.innerText="Sotuvni yakunlash"
    }

    return
  }

  try{

    const shopId=safeGetUserId()
    if(!shopId) throw new Error("No user")

    const total=cart.reduce((s,i)=>s+i.price*i.quantity,0)

    const batch=db.batch()

    const saleRef=db.collection("shops")
    .doc(shopId)
    .collection("sales")
    .doc()

    batch.set(saleRef,{
      items:cart,
      total,
      type:"cash",
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    })

    cart.forEach(item=>{

      const productRef=db.collection("shops")
      .doc(shopId)
      .collection("products")
      .doc(item.id)

      batch.update(productRef,{
        stock:firebase.firestore.FieldValue.increment(-item.quantity)
      })

    })

    await batch.commit()

    showSuccess("Sotuv yakunlandi")

    clearCart()

  }catch(err){

    console.error(err)

    notify("Xatolik yuz berdi","error")

  }

  if(button){
    button.disabled=false
    button.innerText="Sotuvni yakunlash"
  }

}

/* =====================================================
   DEBT CART
===================================================== */

function addDebtToCart(productId){

  const product=saleProducts.find(p=>p.id===productId)
  if(!product) return

  const existing=debtCart.find(i=>i.id===productId)

  if(existing){
    existing.quantity+=1
  }else{
    debtCart.push({
      id:product.id,
      name:product.name,
      price:product.sellingPrice||0,
      quantity:1
    })
  }

  renderDebtCart()

}

/* =====================================================
   RENDER DEBT CART
===================================================== */

function renderDebtCart(){

  const container=document.getElementById("debtCartList")
  if(!container) return

  container.innerHTML=""

  debtCart.forEach(item=>{

    const total=item.price*item.quantity

    container.innerHTML+=`

    <div class="cart-item">

      <strong>${item.name}</strong>

      <div>
        Narx:
        <input type="number"
        value="${item.price}"
        onchange="changeDebtPrice('${item.id}',this.value)">
      </div>

      <div>

        <button onclick="changeDebtQty('${item.id}',-1)">-</button>

        ${item.quantity}

        <button onclick="changeDebtQty('${item.id}',1)">+</button>

      </div>

      <div>Jami: ${formatMoney(total)}</div>

    </div>

    `
  })

}

function changeDebtPrice(id,value){

  const item=debtCart.find(i=>i.id===id)
  if(!item) return

  item.price=Number(value)

  renderDebtCart()

}

function changeDebtQty(id,amount){

  const item=debtCart.find(i=>i.id===id)
  if(!item) return

  item.quantity+=amount

  if(item.quantity<=0){
    debtCart=debtCart.filter(i=>i.id!==id)
  }

  renderDebtCart()

}

/* =====================================================
   COMPLETE DEBT SALE
===================================================== */

async function completeDebtSale(){

  const button=document.getElementById("completeDebtBtn")

  if(button){
    button.disabled=true
    button.innerText="Yuklanmoqda..."
  }

  const customer=document.getElementById("debtCustomerName").value.trim()

  if(!customer || debtCart.length===0){

    notify("Mijoz yoki mahsulot yo'q","error")

    if(button){
      button.disabled=false
      button.innerText="Nasiya berish"
    }

    return
  }

  try{

    const shopId=safeGetUserId()
    if(!shopId) throw new Error("No user")

    const total=debtCart.reduce((s,i)=>s+i.price*i.quantity,0)

    const batch=db.batch()

    const debtRef=db.collection("shops")
    .doc(shopId)
    .collection("debts")
    .doc()

    batch.set(debtRef,{
      customer,
      items:debtCart,
      total,
      remaining:total,
      status:"unpaid",
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    })

    debtCart.forEach(item=>{

      const productRef=db.collection("shops")
      .doc(shopId)
      .collection("products")
      .doc(item.id)

      batch.update(productRef,{
        stock:firebase.firestore.FieldValue.increment(-item.quantity)
      })

    })

    await batch.commit()

    showSuccess("Nasiya saqlandi")

    debtCart=[]
    renderDebtCart()

  }catch(err){

    console.error(err)

    notify("Xatolik yuz berdi","error")

  }

  if(button){
    button.disabled=false
    button.innerText="Nasiya berish"
  }

}

/* =====================================================
   DEBT SEARCH
===================================================== */

function searchDebtProducts(keyword){

  const results=document.getElementById("debtSearchResults")
  if(!results) return

  results.innerHTML=""

  if(!keyword) return

  keyword=keyword.toLowerCase()

  const matches=productIndex
  .filter(p=>p.name.includes(keyword))
  .slice(0,20)

  matches.forEach(obj=>{

    const p=obj.product

    results.innerHTML+=`
    <div class="card" onclick="addDebtToCart('${p.id}')">
      <strong>${p.name}</strong>
      <div>${formatMoney(p.sellingPrice)} so'm</div>
    </div>
    `

  })

}
/* =====================================================
   LOAD DEBT CUSTOMERS
===================================================== */

let debtListener = null

function loadDebtCustomers(){

  const shopId = safeGetUserId()
  if(!shopId) return

  if(debtListener) debtListener()

  debtListener = db.collection("shops")
  .doc(shopId)
  .collection("debts")
  .onSnapshot(snapshot=>{

    const container = document.getElementById("debtCustomersList")
    if(!container) return

    container.innerHTML = ""

    snapshot.forEach(doc=>{

      const d = doc.data()

      if(d.remaining <= 0){
        doc.ref.delete()
        return
      }

      container.innerHTML += `
        <div class="card">

          <strong>${d.customer}</strong><br>

          Jami: ${formatMoney(d.total)}<br>

          Qolgan: ${formatMoney(d.remaining)}<br>

          <input
          type="number"
          placeholder="To'lov"
          id="pay_${doc.id}">

          <button onclick="payDebt('${doc.id}')">
          To'lash
          </button>

        </div>
      `
    })
  })
}

/* =====================================================
   PAY DEBT
===================================================== */

async function payDebt(debtId){

  const shopId = safeGetUserId()
  if(!shopId) return

  const input = document.getElementById("pay_"+debtId)
  const amount = Number(input?.value)

  if(!amount || amount <= 0){
    notify("To'lov miqdorini kiriting","error")
    return
  }

  const debtRef = db.collection("shops")
  .doc(shopId)
  .collection("debts")
  .doc(debtId)

  const snap = await debtRef.get()

  const debt = snap.data()

  if(!debt) return

  if(amount > debt.remaining){
    notify("Qoldiqdan ko'p to'lash mumkin emas","error")
    return
  }

  const newRemaining = debt.remaining - amount

  await debtRef.update({
    remaining:newRemaining,
    status:newRemaining===0 ? "paid":"partial"
  })

  await db.collection("shops")
  .doc(shopId)
  .collection("sales")
  .add({
    type:"debt_payment",
    total:amount,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  })

  showSuccess("To'lov qabul qilindi")

}

/* =====================================================
   STOCK SYSTEM
===================================================== */

function addStock(){

  const shopId = safeGetUserId()
  if(!shopId) return

  const name = document.getElementById("stockName").value.trim()
  const qty = Number(document.getElementById("stockQty").value)
  const cost = Number(document.getElementById("stockCost").value)
  const sell = Number(document.getElementById("stockSellingPrice").value)

  if(!name){
    notify("Mahsulot nomini kiriting","error")
    return
  }

  db.collection("shops")
  .doc(shopId)
  .collection("products")
  .add({
    name,
    stock:qty || 0,
    costPrice:cost || 0,
    sellingPrice:sell || 0,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  })

  showSuccess("Mahsulot qo'shildi")

}

/* =====================================================
   LOAD STOCK
===================================================== */

function loadCurrentStock(){

  const shopId = safeGetUserId()
  if(!shopId) return

  if(stockListener) stockListener()

  stockListener = db.collection("shops")
  .doc(shopId)
  .collection("products")
  .onSnapshot(snapshot=>{

    const container = document.getElementById("currentStockList")
    if(!container) return

    container.innerHTML = ""

    snapshot.forEach(doc=>{

      const p = doc.data()

      container.innerHTML += `
        <div class="card">

          <input
          type="text"
          value="${p.name}"
          onchange="editStock('${doc.id}','name',this.value)">

          Ombor:
          <input
          type="number"
          value="${p.stock || 0}"
          onchange="editStock('${doc.id}','stock',this.value)">

          Kelgan narx:
          <input
          type="number"
          value="${p.costPrice || 0}"
          onchange="editStock('${doc.id}','costPrice',this.value)">

          Sotish narxi:
          <input
          type="number"
          value="${p.sellingPrice || 0}"
          onchange="editStock('${doc.id}','sellingPrice',this.value)">

          <button
          style="background:red"
          onclick="deleteStock('${doc.id}')">
          O'chirish
          </button>

        </div>
      `
    })
  })
}

/* =====================================================
   EDIT STOCK
===================================================== */

async function editStock(id,field,value){

  const shopId = safeGetUserId()
  if(!shopId) return

  await db.collection("shops")
  .doc(shopId)
  .collection("products")
  .doc(id)
  .update({
    [field]: field==="name" ? value : Number(value)
  })

}

/* =====================================================
   DELETE STOCK
===================================================== */

async function deleteStock(id){

  const shopId = safeGetUserId()
  if(!shopId) return

  await db.collection("shops")
  .doc(shopId)
  .collection("products")
  .doc(id)
  .delete()

  showSuccess("Mahsulot o'chirildi")

}

/* =====================================================
   DASHBOARD
===================================================== */

function loadDashboard(){

  const shopId = safeGetUserId()
  if(!shopId) return

  if(dashboardListener) dashboardListener()

  dashboardListener = db.collection("shops")
  .doc(shopId)
  .collection("sales")
  .onSnapshot(snapshot=>{

    let todayRevenue=0
    let weekRevenue=0
    let monthRevenue=0

    let todayCount=0
    let weekCount=0
    let monthCount=0

    const startToday=getStartOfToday()
    const startWeek=getStartOfWeek()
    const startMonth=getStartOfMonth()

    snapshot.forEach(doc=>{

      const s=doc.data()
      if(!s.createdAt) return

      const date=s.createdAt.toDate()

      const itemsCount=s.items
      ? s.items.reduce((sum,i)=>sum+i.quantity,0)
      : 0

      if(date>=startToday){
        todayRevenue+=s.total || 0
        todayCount+=itemsCount
      }

      if(date>=startWeek){
        weekRevenue+=s.total || 0
        weekCount+=itemsCount
      }

      if(date>=startMonth){
        monthRevenue+=s.total || 0
        monthCount+=itemsCount
      }

    })

    document.getElementById("todaySales").innerText=formatMoney(todayRevenue)
    document.getElementById("weekSales").innerText=formatMoney(weekRevenue)
    document.getElementById("monthSales").innerText=formatMoney(monthRevenue)

    document.getElementById("todayCount").innerText=todayCount
    document.getElementById("weekCount").innerText=weekCount
    document.getElementById("monthCount").innerText=monthCount

  })
}

/* =====================================================
   ANALYTICS
===================================================== */

let weeklyChart=null
let monthlyChart=null

function loadAnalytics(){

  const shopId=safeGetUserId()
  if(!shopId) return

  db.collection("shops")
  .doc(shopId)
  .collection("sales")
  .get()
  .then(snapshot=>{

    const weeklyData=[0,0,0,0,0,0,0]
    const monthlyData=new Array(31).fill(0)

    const startWeek=getStartOfWeek()
    const startMonth=getStartOfMonth()

    snapshot.forEach(doc=>{

      const s=doc.data()
      if(!s.createdAt) return

      const date=s.createdAt.toDate()

      if(date>=startWeek){
        const dayIndex=(date.getDay()+6)%7
        weeklyData[dayIndex]+=s.total || 0
      }

      if(date>=startMonth){
        const day=date.getDate()-1
        monthlyData[day]+=s.total || 0
      }

    })

    renderWeeklyChart(weeklyData)
    renderMonthlyChart(monthlyData)

  })
}

/* =====================================================
   WEEKLY CHART
===================================================== */

function renderWeeklyChart(data){

  const ctx=document.getElementById("weeklyChart")
  if(!ctx) return

  if(weeklyChart) weeklyChart.destroy()

  weeklyChart=new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Dush","Sesh","Chor","Pay","Jum","Shan","Yak"],
      datasets:[{
        data:data,
        backgroundColor:"rgba(16,185,129,0.7)"
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false}}
    }
  })
}

/* =====================================================
   MONTHLY CHART
===================================================== */

function renderMonthlyChart(data){

  const ctx=document.getElementById("monthlyChart")
  if(!ctx) return

  if(monthlyChart) monthlyChart.destroy()

  monthlyChart=new Chart(ctx,{
    type:"line",
    data:{
      labels:data.map((_,i)=>i+1),
      datasets:[{
        data:data,
        borderColor:"#3b82f6",
        backgroundColor:"rgba(59,130,246,0.2)",
        fill:true,
        tension:0.3
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false}}
    }
  })
}
