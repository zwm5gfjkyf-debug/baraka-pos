/* =====================================================
   BARAKA POS PRO - CORE
===================================================== */

let saleProducts = []
let productIndex = new Map()
let cart = []
let debtCart = []

let productListener = null
let stockListener = null
let dashboardListener = null

/* ================= MONEY FORMAT ================= */

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

/* =====================================================
   NOTIFICATION
===================================================== */

function notify(msg,type="success"){

  const box=document.createElement("div")
  box.className="pos-notify"
  box.innerText=msg

  if(type==="error") box.style.background="#ef4444"

  document.body.appendChild(box)

  setTimeout(()=>{
    box.remove()
  },2000)

}

/* =====================================================
   AUTH STATE
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

/* =====================================================
   NAVIGATION
===================================================== */

function navigate(page){

  document.querySelectorAll(".page")
  .forEach(p=>p.classList.add("hidden"))

  const target=document.getElementById(page)
  if(target) target.classList.remove("hidden")

}

/* =====================================================
   LOAD PRODUCTS + ULTRA FAST SEARCH INDEX
===================================================== */

function loadProducts(){

  const shopId=safeGetUserId()
  if(!shopId) return

  if(productListener) productListener()

  productListener = db.collection("shops")
  .doc(shopId)
  .collection("products")
  .onSnapshot(snapshot=>{

    saleProducts=[]
    productIndex.clear()

    snapshot.forEach(doc=>{

      const p={id:doc.id,...doc.data()}
      saleProducts.push(p)

      const key=p.name.toLowerCase()

      if(!productIndex.has(key)){
        productIndex.set(key,[])
      }

      productIndex.get(key).push(p)

    })

  })

}

/* =====================================================
   ULTRA FAST PRODUCT SEARCH (10k items)
===================================================== */

function searchProducts(keyword){

  const results=document.getElementById("searchResults")
  if(!results) return

  results.innerHTML=""

  if(!keyword) return

  keyword=keyword.toLowerCase()

  const matches=saleProducts.filter(p=>
    p.name.toLowerCase().includes(keyword)
  )

  matches.slice(0,20).forEach(p=>{

    results.innerHTML+=`
    <div class="card" onclick="addToCart('${p.id}')">
      <strong>${p.name}</strong>
      <div>${formatMoney(p.sellingPrice)} so'm</div>
    </div>
    `

  })

}
/* =====================================================
   CART SYSTEM
===================================================== */

function addToCart(id){

  const product=saleProducts.find(p=>p.id===id)
  if(!product) return

  const existing=cart.find(i=>i.id===id)

  if(existing){

    existing.quantity++

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

/* ================= REMOVE ================= */

function removeFromCart(id){

  cart=cart.filter(i=>i.id!==id)
  renderCart()

}

/* ================= PRICE ================= */

function changePrice(id,val){

  const item=cart.find(i=>i.id===id)
  if(!item) return

  item.price=Number(val)||0
  renderCart()

}

/* ================= QTY ================= */

function changeQty(id,amount){

  const item=cart.find(i=>i.id===id)
  if(!item) return

  item.quantity+=amount

  if(item.quantity<=0){
    removeFromCart(id)
    return
  }

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

        <button onclick="changeQty('${item.id}',-1)">-</button>

        <span>${item.quantity}</span>

        <button onclick="changeQty('${item.id}',1)">+</button>

      </div>

      <div>
        Jami: ${formatMoney(itemTotal)}
      </div>

      <button onclick="removeFromCart('${item.id}')">
        O'chirish
      </button>

    </div>
    `

  })

  const totalEl=document.getElementById("saleTotal")
  if(totalEl) totalEl.innerText=formatMoney(total)

}

/* =====================================================
   COMPLETE SALE
===================================================== */

async function completeSale(){

  if(cart.length===0){
    notify("Savatcha bo'sh","error")
    return
  }

  const shopId=safeGetUserId()
  if(!shopId) return

  const total=cart.reduce((s,i)=>s+i.price*i.quantity,0)

  const batch=db.batch()

  const saleRef=db.collection("shops")
  .doc(shopId)
  .collection("sales")
  .doc()

  batch.set(saleRef,{
    items:cart,
    total:total,
    type:"cash",
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  })

  cart.forEach(item=>{

    const ref=db.collection("shops")
    .doc(shopId)
    .collection("products")
    .doc(item.id)

    batch.update(ref,{
      stock:firebase.firestore.FieldValue.increment(-item.quantity)
    })

  })

  await batch.commit()

  cart=[]
  renderCart()

  notify("Savdo yakunlandi")

}
/* =====================================================
   NASIYA SYSTEM
===================================================== */

function addDebtToCart(id){

  const product=saleProducts.find(p=>p.id===id)
  if(!product) return

  const existing=debtCart.find(i=>i.id===id)

  if(existing){

    existing.quantity++

  }else{

    debtCart.push({
      id:product.id,
      name:product.name,
      price:product.sellingPrice || 0,
      quantity:1
    })

  }

}

/* COMPLETE DEBT */

async function completeDebtSale(){

  const shopId=safeGetUserId()
  if(!shopId) return

  const customer=document
  .getElementById("debtCustomerName")?.value.trim()

  if(!customer){
    notify("Mijoz nomi kerak","error")
    return
  }

  const total=debtCart.reduce((s,i)=>s+i.price*i.quantity,0)

  await db.collection("shops")
  .doc(shopId)
  .collection("debts")
  .add({
    customer,
    items:debtCart,
    total,
    remaining:total,
    status:"unpaid",
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  })

  debtCart=[]
  notify("Nasiya saqlandi")

}

/* =====================================================
   STOCK SYSTEM
===================================================== */

function addStock(){

  const shopId=safeGetUserId()
  if(!shopId) return

  const name=document.getElementById("stockName")?.value
  const qty=Number(document.getElementById("stockQty")?.value)
  const sell=Number(document.getElementById("stockSellingPrice")?.value)

  db.collection("shops")
  .doc(shopId)
  .collection("products")
  .add({
    name,
    stock:qty,
    sellingPrice:sell,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  })

}

/* =====================================================
   DASHBOARD
===================================================== */

function loadDashboard(){

  const shopId=safeGetUserId()
  if(!shopId) return

  if(dashboardListener) dashboardListener()

  dashboardListener = db.collection("shops")
  .doc(shopId)
  .collection("sales")
  .onSnapshot(snapshot=>{

    let today=0

    const startToday=getStartOfToday()

    snapshot.forEach(doc=>{

      const s=doc.data()
      if(!s.createdAt) return

      const date=s.createdAt.toDate()

      if(date>=startToday){
        today+=s.total||0
      }

    })

    const el=document.getElementById("todaySales")
    if(el) el.innerText=formatMoney(today)

  })

}
