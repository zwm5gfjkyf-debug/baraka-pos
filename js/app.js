/* =====================================================
   BARAKA POS PRO
   CORE SYSTEM
===================================================== */

/* ================= GLOBAL HELPERS ================= */

function formatMoney(num){
  return Number(num || 0)
  .toLocaleString("ru-RU")
  .replace(/,/g," ");
}

function safeGetUserId(){
  return auth.currentUser ? auth.currentUser.uid : null;
}

function getStartOfToday(){
  const d=new Date();
  d.setHours(0,0,0,0);
  return d;
}

function getStartOfWeek(){
  const d=new Date();
  const day=d.getDay()||7;

  if(day!==1){
    d.setDate(d.getDate()-(day-1));
  }

  d.setHours(0,0,0,0);
  return d;
}

function getStartOfMonth(){
  const d=new Date();
  d.setDate(1);
  d.setHours(0,0,0,0);
  return d;
}

/* =====================================================
   NOTIFICATIONS
===================================================== */

function notify(message,type="success"){

  const box=document.createElement("div");

  box.className="pos-notify";
  box.innerText=message;

  if(type==="error"){
    box.style.background="#ef4444";
  }

  document.body.appendChild(box);

  setTimeout(()=>{
    box.style.opacity="0";
  },2000);

  setTimeout(()=>{
    box.remove();
  },2500);

}

/* =====================================================
   SUCCESS OVERLAY
===================================================== */

function showSuccess(message){

  const overlay=document.getElementById("successOverlay");
  const text=document.getElementById("successText");

  if(!overlay || !text) return;

  text.innerText=message;

  overlay.classList.remove("hidden");

  setTimeout(()=>{
    overlay.classList.add("hidden");
  },1500);

}

/* =====================================================
   AUTH STATE
===================================================== */

auth.onAuthStateChanged(user=>{

  const loading=document.getElementById("loadingScreen");
  if(loading) loading.classList.add("hidden");

  if(user){

    document.getElementById("authScreen")?.classList.add("hidden");
    document.getElementById("appScreen")?.classList.remove("hidden");

    const title=document.getElementById("shopTitle");
    if(title) title.innerText=user.email;

    loadSaleProducts();
    loadDashboard();

  }else{

    document.getElementById("appScreen")?.classList.add("hidden");
    document.getElementById("authScreen")?.classList.remove("hidden");

  }

});

/* =====================================================
   AUTH FUNCTIONS
===================================================== */

async function register(){

  const shopName=document.getElementById("shopName")?.value.trim();
  const email=document.getElementById("email")?.value.trim();
  const pass=document.getElementById("password")?.value;

  if(!shopName || !email || !pass){
    notify("Barcha maydonlarni to'ldiring","error");
    return;
  }

  const cred=await auth.createUserWithEmailAndPassword(email,pass);

  await db.collection("shops")
  .doc(cred.user.uid)
  .set({
    shopName,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });

}

async function login(){

  const email=document.getElementById("email")?.value.trim();
  const pass=document.getElementById("password")?.value;

  if(!email || !pass) return;

  await auth.signInWithEmailAndPassword(email,pass);

}

function logout(){
  auth.signOut();
}

function toggleProfileMenu(){

  const menu=document.getElementById("profileMenu");
  if(menu) menu.classList.toggle("hidden");

}

/* =====================================================
   NAVIGATION
===================================================== */

function navigate(pageId){

  document.querySelectorAll(".page")
  .forEach(p=>p.classList.add("hidden"));

  const page=document.getElementById(pageId);
  if(page) page.classList.remove("hidden");

  document.querySelectorAll(".bottom-nav button")
  .forEach(btn=>btn.classList.remove("active"));

  document.querySelectorAll(".bottom-nav button")
  .forEach(btn=>{
    if(btn.getAttribute("onclick")?.includes(pageId)){
      btn.classList.add("active");
    }
  });

  if(pageId==="dashboardPage") loadDashboard();
  if(pageId==="salePage") focusSaleSearch();
  if(pageId==="stockPage") loadCurrentStock();
  if(pageId==="analyticsPage") loadAnalytics();
  if(pageId==="debtPage") loadDebtCustomers();

}

/* =====================================================
   PRODUCT SYSTEM
===================================================== */

let saleProducts=[];
let productListener=null;

function loadSaleProducts(){

  const shopId=safeGetUserId();
  if(!shopId) return;

  if(productListener) productListener();

  productListener=db.collection("shops")
  .doc(shopId)
  .collection("products")
  .onSnapshot(snapshot=>{

    saleProducts=[];

    snapshot.forEach(doc=>{
      saleProducts.push({
        id:doc.id,
        ...doc.data()
      });
    });

  });

}

/* =====================================================
   PRODUCT SEARCH
===================================================== */

function searchProducts(keyword){

  const results=document.getElementById("searchResults");
  if(!results) return;

  results.innerHTML="";

  if(!keyword) return;

  keyword=keyword.toLowerCase();

  const filtered=saleProducts.filter(p=>
    p.name?.toLowerCase().includes(keyword)
  );

  filtered.slice(0,20).forEach(p=>{

    results.innerHTML+=`
      <div class="card"
      onclick="addToCart('${p.id}')">

        <strong>${p.name}</strong>
        <div>${formatMoney(p.sellingPrice)} so'm</div>

      </div>
    `;

  });

}

function focusSaleSearch(){
  const input=document.getElementById("saleSearch");
  if(input) input.focus();
}
/* =====================================================
   POS CART ENGINE
===================================================== */

let cart = [];
let saleMode = "cash"; // cash or debt

function setSaleMode(mode){
  saleMode = mode;
}

/* ================= ADD PRODUCT ================= */

function addToCart(productId){

  const product = saleProducts.find(p=>p.id===productId);
  if(!product) return;

  const existing = cart.find(i=>i.id===productId);

  if(existing){

    existing.quantity += 1;

  }else{

    cart.push({
      id:product.id,
      name:product.name,
      price:product.sellingPrice || 0,
      cost:product.costPrice || 0,
      quantity:1
    });

  }

  renderCart();
}

/* ================= REMOVE PRODUCT ================= */

function removeFromCart(id){

  cart = cart.filter(i=>i.id!==id);

  renderCart();
}

/* ================= CHANGE PRICE ================= */

function changePrice(id,newPrice){

  const item = cart.find(i=>i.id===id);
  if(!item) return;

  item.price = Number(newPrice) || 0;

  renderCart();
}

/* ================= CHANGE QTY BUTTON ================= */

function changeQty(id,amount){

  const item = cart.find(i=>i.id===id);
  if(!item) return;

  item.quantity += amount;

  if(item.quantity <= 0){
    removeFromCart(id);
    return;
  }

  renderCart();
}

/* ================= MANUAL QTY INPUT ================= */

function changeQtyManual(id,value){

  const item = cart.find(i=>i.id===id);
  if(!item) return;

  const qty = Number(value) || 1;

  item.quantity = qty;

  renderCart();
}

/* ================= CLEAR CART ================= */

function clearCart(){

  cart = [];
  renderCart();

}

/* =====================================================
   RENDER CART
===================================================== */

function renderCart(){

  const container = document.getElementById("cartList");
  if(!container) return;

  container.innerHTML = "";

  let total = 0;

  cart.forEach(item=>{

    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    container.innerHTML += `
      <div class="cart-item">

        <strong>${item.name}</strong>

        <div style="margin-top:6px">

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

        <div style="margin-top:6px">
        Jami: ${formatMoney(itemTotal)} so'm
        </div>

        <button
        style="background:var(--danger);margin-top:8px"
        onclick="removeFromCart('${item.id}')">
        O'chirish
        </button>

      </div>
    `;

  });

  const totalEl = document.getElementById("saleTotal");
  if(totalEl) totalEl.innerText = formatMoney(total);

}

/* =====================================================
   COMPLETE SALE ENGINE
===================================================== */

async function completeSale(){

  const button = document.getElementById("completeSaleBtn");

  if(button){
    button.disabled = true;
    button.innerText = "Yuklanmoqda...";
  }

  if(cart.length === 0){

    notify("Savatcha bo'sh","error");

    if(button){
      button.disabled=false;
      button.innerText="Sotuvni yakunlash";
    }

    return;
  }

  try{

    const shopId = safeGetUserId();
    if(!shopId) throw new Error("User not found");

    const total = cart.reduce((s,i)=>s+i.price*i.quantity,0);

    const saleData = {
      items:cart,
      total:total,
      type:saleMode,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    };

    /* ================= CASH SALE ================= */

    if(saleMode === "cash"){

      const batch = db.batch();

      const saleRef = db.collection("shops")
      .doc(shopId)
      .collection("sales")
      .doc();

      batch.set(saleRef,saleData);

      cart.forEach(item=>{

        const productRef = db.collection("shops")
        .doc(shopId)
        .collection("products")
        .doc(item.id);

        batch.update(productRef,{
          stock:firebase.firestore.FieldValue.increment(-item.quantity)
        });

      });

      await batch.commit();

      generateReceipt(cart,total);

      showSuccess("Sotuv yakunlandi");

    }

    /* ================= DEBT SALE ================= */

    if(saleMode === "debt"){

      const customerName =
      document.getElementById("debtCustomerName")?.value.trim();

      if(!customerName){
        notify("Mijoz ismini kiriting","error");
        return;
      }

      const batch = db.batch();

      const debtRef = db.collection("shops")
      .doc(shopId)
      .collection("debts")
      .doc();

      batch.set(debtRef,{
        customer:customerName,
        items:cart,
        total:total,
        remaining:total,
        status:"unpaid",
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });

      cart.forEach(item=>{

        const productRef = db.collection("shops")
        .doc(shopId)
        .collection("products")
        .doc(item.id);

        batch.update(productRef,{
          stock:firebase.firestore.FieldValue.increment(-item.quantity)
        });

      });

      await batch.commit();

      showSuccess("Nasiya berildi");

    }

    clearCart();

  }catch(error){

    console.error(error);

    notify("Xatolik yuz berdi","error");

  }

  if(button){
    button.disabled=false;
    button.innerText="Sotuvni yakunlash";
  }

}

/* =====================================================
   RECEIPT GENERATOR
===================================================== */

function generateReceipt(items,total){

  const modal = document.createElement("div");

  modal.className = "receipt-modal";

  let itemsHTML = "";

  items.forEach(i=>{

    itemsHTML += `
      <div class="receipt-row">
        <span>${i.name} x${i.quantity}</span>
        <span>${formatMoney(i.price*i.quantity)}</span>
      </div>
    `;

  });

  modal.innerHTML = `

  <div class="receipt-box">

    <h2>Baraka POS</h2>

    <div style="margin-top:10px">
      ${itemsHTML}
    </div>

    <hr>

    <div class="receipt-row">
      <strong>Total</strong>
      <strong>${formatMoney(total)} so'm</strong>
    </div>

    <div style="margin-top:12px;font-size:12px;color:#888">
      ${new Date().toLocaleString()}
    </div>

    <button onclick="window.print()">Print</button>

    <button onclick="this.closest('.receipt-modal').remove()">
      Close
    </button>

  </div>

  `;

  document.body.appendChild(modal);

}
/* =====================================================
   STOCK MANAGEMENT SYSTEM
===================================================== */

let stockListener = null;

function addStock(){

  const shopId = safeGetUserId();
  if(!shopId) return;

  const name = document.getElementById("stockName")?.value.trim();
  const qty  = Number(document.getElementById("stockQty")?.value);
  const cost = Number(document.getElementById("stockCost")?.value);
  const sell = Number(document.getElementById("stockSellingPrice")?.value);

  if(!name){
    notify("Mahsulot nomi kerak","error");
    return;
  }

  db.collection("shops")
  .doc(shopId)
  .collection("products")
  .add({
    name:name,
    stock:qty || 0,
    costPrice:cost || 0,
    sellingPrice:sell || 0,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });

  notify("Mahsulot qo'shildi");

}

/* LOAD STOCK */

function loadCurrentStock(){

  const shopId = safeGetUserId();
  if(!shopId) return;

  if(stockListener) stockListener();

  stockListener = db.collection("shops")
  .doc(shopId)
  .collection("products")
  .onSnapshot(snapshot=>{

    const container = document.getElementById("currentStockList");
    if(!container) return;

    container.innerHTML = "";

    snapshot.forEach(doc=>{

      const p = doc.data();

      container.innerHTML += `
        <div class="card">

          <strong>${p.name}</strong>

          <div style="margin-top:6px">
            Ombor: ${p.stock || 0}
          </div>

          <div>
            Sotish narxi: ${formatMoney(p.sellingPrice)} so'm
          </div>

        </div>
      `;

    });

  });

}

/* =====================================================
   DEBT CUSTOMER SYSTEM
===================================================== */

function loadDebtCustomers(){

  const shopId = safeGetUserId();
  if(!shopId) return;

  db.collection("shops")
  .doc(shopId)
  .collection("debts")
  .onSnapshot(snapshot=>{

    const container = document.getElementById("debtCustomersList");
    if(!container) return;

    container.innerHTML = "";

    snapshot.forEach(doc=>{

      const d = doc.data();

      container.innerHTML += `
        <div class="card">

          <strong>${d.customer}</strong>

          <div>
            Jami: ${formatMoney(d.total)} so'm
          </div>

          <div>
            Qolgan: ${formatMoney(d.remaining)} so'm
          </div>

          <input
          type="number"
          id="pay_${doc.id}"
          placeholder="To'lov">

          <button onclick="payDebt('${doc.id}')">
          To'lash
          </button>

        </div>
      `;

    });

  });

}

/* PAY DEBT */

async function payDebt(debtId){

  const shopId = safeGetUserId();
  if(!shopId) return;

  const input = document.getElementById("pay_"+debtId);

  const amount = Number(input?.value);

  if(!amount || amount <= 0){
    notify("To'lov summasi noto'g'ri","error");
    return;
  }

  const debtRef = db.collection("shops")
  .doc(shopId)
  .collection("debts")
  .doc(debtId);

  const docSnap = await debtRef.get();
  const debt = docSnap.data();

  if(!debt) return;

  if(amount > debt.remaining){
    notify("Qoldiqdan ko'p to'lash mumkin emas","error");
    return;
  }

  const newRemaining = debt.remaining - amount;

  await debtRef.update({
    remaining:newRemaining,
    status:newRemaining === 0 ? "paid" : "partial"
  });

  await db.collection("shops")
  .doc(shopId)
  .collection("sales")
  .add({
    type:"debt_payment",
    total:amount,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });

  showSuccess("To'lov qabul qilindi");

}

/* =====================================================
   DASHBOARD SYSTEM
===================================================== */

function loadDashboard(){

  const shopId = safeGetUserId();
  if(!shopId) return;

  db.collection("shops")
  .doc(shopId)
  .collection("sales")
  .onSnapshot(snapshot=>{

    let todayRevenue = 0;
    let weekRevenue = 0;
    let monthRevenue = 0;

    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;

    const startToday = getStartOfToday();
    const startWeek = getStartOfWeek();
    const startMonth = getStartOfMonth();

    snapshot.forEach(doc=>{

      const s = doc.data();
      if(!s.createdAt) return;

      const date = s.createdAt.toDate();

      const itemsCount = s.items
      ? s.items.reduce((sum,i)=>sum+i.quantity,0)
      : 0;

      if(date >= startToday){
        todayRevenue += s.total || 0;
        todayCount += itemsCount;
      }

      if(date >= startWeek){
        weekRevenue += s.total || 0;
        weekCount += itemsCount;
      }

      if(date >= startMonth){
        monthRevenue += s.total || 0;
        monthCount += itemsCount;
      }

    });

    const t1=document.getElementById("todaySales");
    const t2=document.getElementById("weekSales");
    const t3=document.getElementById("monthSales");

    if(t1) t1.innerText=formatMoney(todayRevenue);
    if(t2) t2.innerText=formatMoney(weekRevenue);
    if(t3) t3.innerText=formatMoney(monthRevenue);

    const c1=document.getElementById("todayCount");
    const c2=document.getElementById("weekCount");
    const c3=document.getElementById("monthCount");

    if(c1) c1.innerText=todayCount;
    if(c2) c2.innerText=weekCount;
    if(c3) c3.innerText=monthCount;

  });

}

/* =====================================================
   ANALYTICS SYSTEM
===================================================== */

let weeklyChart = null;
let monthlyChart = null;

function loadAnalytics(){

  const shopId = safeGetUserId();
  if(!shopId) return;

  db.collection("shops")
  .doc(shopId)
  .collection("sales")
  .get()
  .then(snapshot=>{

    const weeklyData=[0,0,0,0,0,0,0];
    const monthlyData=new Array(31).fill(0);

    const startWeek=getStartOfWeek();
    const startMonth=getStartOfMonth();

    snapshot.forEach(doc=>{

      const s=doc.data();
      if(!s.createdAt) return;

      const date=s.createdAt.toDate();

      if(date>=startWeek){
        const dayIndex=(date.getDay()+6)%7;
        weeklyData[dayIndex]+=s.total || 0;
      }

      if(date>=startMonth){
        const day=date.getDate()-1;
        monthlyData[day]+=s.total || 0;
      }

    });

    renderWeeklyChart(weeklyData);
    renderMonthlyChart(monthlyData);

  });

}

/* WEEKLY CHART */

function renderWeeklyChart(data){

  const ctx=document.getElementById("weeklyChart");
  if(!ctx) return;

  if(weeklyChart) weeklyChart.destroy();

  weeklyChart=new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Dush","Sesh","Chor","Pay","Jum","Shan","Yak"],
      datasets:[{
        label:"Haftalik tushum",
        data:data,
        backgroundColor:"rgba(16,185,129,0.7)"
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false}}
    }
  });

}

/* MONTHLY CHART */

function renderMonthlyChart(data){

  const ctx=document.getElementById("monthlyChart");
  if(!ctx) return;

  if(monthlyChart) monthlyChart.destroy();

  monthlyChart=new Chart(ctx,{
    type:"line",
    data:{
      labels:data.map((_,i)=>i+1),
      datasets:[{
        label:"Oylik tushum",
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
  });

}

/* =====================================================
   SALES WATCHER
===================================================== */

function watchSales(){

  const shopId = safeGetUserId();
  if(!shopId) return;

  db.collection("shops")
  .doc(shopId)
  .collection("sales")
  .orderBy("createdAt","desc")
  .limit(1)
  .onSnapshot(snapshot=>{

    snapshot.forEach(doc=>{

      const sale = doc.data();

      notify("New sale: "+formatMoney(sale.total)+" so'm");

    });

  });

}

/* =====================================================
   ANIMATED NUMBERS
===================================================== */

function animateNumber(element,value){

  let start=0;
  const duration=800;

  const step=value/(duration/16);

  function frame(){

    start+=step;

    if(start>=value){
      element.innerText=formatMoney(value);
      return;
    }

    element.innerText=formatMoney(Math.floor(start));

    requestAnimationFrame(frame);

  }

  frame();

}
