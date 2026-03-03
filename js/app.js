/* =====================================================
   GLOBAL HELPERS
===================================================== */

function formatMoney(num){
  return Number(num || 0)
    .toLocaleString("ru-RU")
    .replace(/,/g, " ");
}

function getStartOfToday(){
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}

function getStartOfWeek(){
  const d = new Date();
  const day = d.getDay() || 7;
  if(day !== 1){
    d.setDate(d.getDate() - (day - 1));
  }
  d.setHours(0,0,0,0);
  return d;
}

function getStartOfMonth(){
  const d = new Date();
  d.setDate(1);
  d.setHours(0,0,0,0);
  return d;
}

function safeGetUserId(){
  return auth.currentUser ? auth.currentUser.uid : null;
}

/* =====================================================
   AUTH STATE
===================================================== */

auth.onAuthStateChanged(user => {

  const loading = document.getElementById("loadingScreen");
  if(loading) loading.classList.add("hidden");

  if(user){

    const authScreen = document.getElementById("authScreen");
    const appScreen  = document.getElementById("appScreen");

    if(authScreen) authScreen.classList.add("hidden");
    if(appScreen) appScreen.classList.remove("hidden");

    const shopTitle = document.getElementById("shopTitle");
    if(shopTitle) shopTitle.innerText = user.email;

    loadDashboard();

  } else {

    const appScreen  = document.getElementById("appScreen");
    const authScreen = document.getElementById("authScreen");

    if(appScreen) appScreen.classList.add("hidden");
    if(authScreen) authScreen.classList.remove("hidden");
  }
});

/* =====================================================
   REGISTER / LOGIN
===================================================== */

async function register(){

  const shopNameVal = document.getElementById("shopName")?.value.trim();
  const emailVal = document.getElementById("email")?.value.trim();
  const passVal = document.getElementById("password")?.value;

  if(!shopNameVal || !emailVal || !passVal){
    alert("Barcha maydonlarni to'ldiring");
    return;
  }

  const cred = await auth.createUserWithEmailAndPassword(emailVal, passVal);

  await db.collection("shops")
    .doc(cred.user.uid)
    .set({
      shopName: shopNameVal,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function login(){
  const email = document.getElementById("email")?.value.trim();
  const pass  = document.getElementById("password")?.value;

  if(!email || !pass) return;

  await auth.signInWithEmailAndPassword(email, pass);
}

function logout(){
  auth.signOut();
}

function toggleProfileMenu(){
  const menu = document.getElementById("profileMenu");
  if(menu) menu.classList.toggle("hidden");
}

/* =====================================================
   NAVIGATION (STABLE + SAFE)
===================================================== */

function navigate(pageId){

  const pages = document.querySelectorAll(".page");
  pages.forEach(p => p.classList.add("hidden"));

  const page = document.getElementById(pageId);
  if(!page) return;

  page.classList.remove("hidden");

  document.querySelectorAll(".bottom-nav button")
    .forEach(btn => btn.classList.remove("active"));

  const navButtons = document.querySelectorAll(".bottom-nav button");

  navButtons.forEach(btn=>{
    if(btn.getAttribute("onclick")?.includes(pageId)){
      btn.classList.add("active");
    }
  });

  if(pageId==="dashboardPage") loadDashboard();
  if(pageId==="salePage") loadSaleProducts();
  if(pageId==="debtPage") loadDebtCustomers();
  if(pageId==="analyticsPage") loadAnalytics();
  if(pageId==="stockPage") loadCurrentStock();
}

/* =====================================================
   DASHBOARD (REAL REVENUE + SAFE LISTENER)
===================================================== */

let dashboardUnsubscribe = null;

function loadDashboard(){

  const shopId = safeGetUserId();
  if(!shopId) return;

  if(dashboardUnsubscribe) dashboardUnsubscribe();

  dashboardUnsubscribe = db.collection("shops")
    .doc(shopId)
    .collection("sales")
    .onSnapshot(snapshot=>{

      let todayRevenue=0, weekRevenue=0, monthRevenue=0;
      let todayCount=0, weekCount=0, monthCount=0;

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

      document.getElementById("todaySales").innerText = formatMoney(todayRevenue);
      document.getElementById("weekSales").innerText = formatMoney(weekRevenue);
      document.getElementById("monthSales").innerText = formatMoney(monthRevenue);

      document.getElementById("todayCount").innerText = todayCount;
      document.getElementById("weekCount").innerText = weekCount;
      document.getElementById("monthCount").innerText = monthCount;

    });
}
/* =====================================================
   SALE ENGINE (FULL STABLE VERSION)
===================================================== */

let saleProducts = [];
let cart = [];
let saleUnsubscribe = null;

/* LOAD PRODUCTS */
function loadSaleProducts(){

  const shopId = safeGetUserId();
  if(!shopId) return;

  if(saleUnsubscribe) saleUnsubscribe();

  saleUnsubscribe = db.collection("shops")
    .doc(shopId)
    .collection("products")
    .onSnapshot(snapshot=>{

      saleProducts = [];

      snapshot.forEach(doc=>{
        saleProducts.push({
          id: doc.id,
          ...doc.data()
        });
      });
    });
}

/* SEARCH */
function searchProducts(keyword){

  const resultsDiv = document.getElementById("searchResults");
  if(!resultsDiv) return;

  resultsDiv.innerHTML = "";
  if(!keyword) return;

  saleProducts
    .filter(p => p.name?.toLowerCase().includes(keyword.toLowerCase()))
    .forEach(p=>{
      resultsDiv.innerHTML += `
        <div class="card" onclick="addToCart('${p.id}')">
          ${p.name} — ${formatMoney(p.sellingPrice)}
        </div>
      `;
    });
}

/* ADD TO CART */
function addToCart(id){

  const product = saleProducts.find(p=>p.id===id);
  if(!product) return;

  const existing = cart.find(i=>i.id===id);

  if(existing){
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.sellingPrice || 0,
      quantity: 1
    });
  }

  renderCart();

  const input = document.getElementById("saleSearch");
  if(input) input.value = "";

  const results = document.getElementById("searchResults");
  if(results) results.innerHTML = "";
}

function focusSaleSearch(){
  const input = document.getElementById("saleSearch");
  if(input) input.focus();
}

/* RENDER CART */
function renderCart(){
/* --------------------------
   CHANGE PRICE
---------------------------*/
function changePrice(id,newPrice){

  const item = cart.find(i=>i.id===id);
  if(!item) return;

  item.price = Number(newPrice);
  renderCart();
}

/* --------------------------
   CHANGE QTY (+ -)
---------------------------*/
function changeQty(id,amount){

  const item = cart.find(i=>i.id===id);
  if(!item) return;

  item.quantity += amount;

  if(item.quantity <= 0){
    cart = cart.filter(i=>i.id!==id);
  }

  renderCart();
}

/* --------------------------
   MANUAL QTY
---------------------------*/
function changeQtyManual(id,value){

  const item = cart.find(i=>i.id===id);
  if(!item) return;

  const newQty = Number(value);

  if(newQty <= 0){
    cart = cart.filter(i=>i.id!==id);
  } else {
    item.quantity = newQty;
  }

  renderCart();
}
  const container = document.getElementById("cartList");
  if(!container) return;

  container.innerHTML = "";

  let total = 0;

  cart.forEach(item=>{

    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    container.innerHTML += `
      <div class="cart-item">
        <strong>${item.name}</strong><br>

        Narx:
        <input type="number"
          value="${item.price}"
          onchange="changePrice('${item.id}', this.value)">

        <div class="quantity-controls">
          <button class="qty-btn"
            onclick="changeQty('${item.id}', -1)">-</button>

          <input type="number"
            value="${item.quantity}"
            style="width:60px"
            onchange="changeQtyManual('${item.id}', this.value)">

          <button class="qty-btn"
            onclick="changeQty('${item.id}', 1)">+</button>
        </div>

        <div>Jami: ${formatMoney(itemTotal)} so'm</div>

        <button style="background:var(--danger)"
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
   COMPLETE SALE (DOUBLE CLICK SAFE + CLEAN)
===================================================== */

async function completeSale(){

  const button = document.getElementById("completeSaleBtn");
  if(button){
    button.disabled = true;
    button.innerText = "Yuklanmoqda...";
  }

  if(cart.length === 0){
    if(button){
      button.disabled = false;
      button.innerText = "Sotuvni yakunlash";
    }
    alert("Savatcha bo'sh");
    return;
  }

  try{

    const shopId = safeGetUserId();
    if(!shopId) throw new Error("No user");

    const total = cart.reduce((s,i)=>s+i.price*i.quantity,0);

    const batch = db.batch();

    const saleRef = db.collection("shops")
      .doc(shopId)
      .collection("sales")
      .doc();

    batch.set(saleRef,{
      items: cart,
      total,
      type: "cash",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    cart.forEach(item=>{
      const productRef = db.collection("shops")
        .doc(shopId)
        .collection("products")
        .doc(item.id);

      batch.update(productRef,{
        stock: firebase.firestore.FieldValue.increment(-item.quantity)
      });
    });

    await batch.commit();

    cart = [];
    renderCart();

    showSuccess("Muvaffaqiyatli sotildi");

  }catch(error){
    console.error(error);
    alert("Xatolik yuz berdi");
  }

  if(button){
    button.disabled = false;
    button.innerText = "Sotuvni yakunlash";
  }
}

/* =====================================================
   NASIYA SYSTEM (FULL STABLE + AUTO DELETE)
===================================================== */

let debtCart = [];
let debtUnsubscribe = null;

/* SEARCH PRODUCTS */
function searchDebtProducts(keyword){

  const resultsDiv = document.getElementById("debtSearchResults");
  if(!resultsDiv) return;

  resultsDiv.innerHTML = "";
  if(!keyword) return;

  saleProducts
    .filter(p=>p.name?.toLowerCase().includes(keyword.toLowerCase()))
    .forEach(p=>{
      resultsDiv.innerHTML += `
        <div class="card" onclick="addDebtToCart('${p.id}')">
          ${p.name} — ${formatMoney(p.sellingPrice)}
        </div>
      `;
    });
}

/* ADD TO DEBT CART */
function addDebtToCart(id){

  const product = saleProducts.find(p=>p.id===id);
  if(!product) return;

  const existing = debtCart.find(i=>i.id===id);

  if(existing){
    existing.quantity += 1;
  }else{
    debtCart.push({
      id: product.id,
      name: product.name,
      price: product.sellingPrice || 0,
      quantity: 1
    });
  }

  renderDebtCart();
}

/* RENDER DEBT CART */
function renderDebtCart(){

  const container = document.getElementById("debtCartList");
  if(!container) return;

  container.innerHTML = "";

  debtCart.forEach(item=>{
    const itemTotal = item.price * item.quantity;

    container.innerHTML += `
      <div class="cart-item">
        <strong>${item.name}</strong><br>

        Narx:
        <input type="number"
          value="${item.price}"
          onchange="changeDebtPrice('${item.id}', this.value)">

        <div>
          <button onclick="changeDebtQty('${item.id}', -1)">-</button>
          ${item.quantity}
          <button onclick="changeDebtQty('${item.id}', 1)">+</button>
        </div>

        <div>Jami: ${formatMoney(itemTotal)} so'm</div>
      </div>
    `;
  });
}

/* EDIT PRICE */
function changeDebtPrice(id,newPrice){
  const item = debtCart.find(i=>i.id===id);
  if(!item) return;
  item.price = Number(newPrice);
  renderDebtCart();
}

/* EDIT QTY */
function changeDebtQty(id,amount){
  const item = debtCart.find(i=>i.id===id);
  if(!item) return;

  item.quantity += amount;

  if(item.quantity <= 0){
    debtCart = debtCart.filter(i=>i.id!==id);
  }

  renderDebtCart();
}

/* COMPLETE DEBT SALE */
async function completeDebtSale(){

  const button = document.getElementById("completeDebtBtn");
  if(button){
    button.disabled = true;
    button.innerText = "Yuklanmoqda...";
  }

  const customerName =
    document.getElementById("debtCustomerName")?.value.trim();

  if(!customerName || debtCart.length === 0){
    if(button){
      button.disabled = false;
      button.innerText = "Nasiya berish";
    }
    alert("Mijoz yoki mahsulot yo'q");
    return;
  }

  try{

    const shopId = safeGetUserId();
    if(!shopId) throw new Error("No user");

    const total = debtCart.reduce((s,i)=>s+i.price*i.quantity,0);

    const debtsRef = db.collection("shops")
      .doc(shopId)
      .collection("debts");

    const existingSnap = await debtsRef
      .where("customer","==",customerName)
      .where("status","in",["unpaid","partial"])
      .get();

    const batch = db.batch();

    if(existingSnap.empty){

      const newDebtRef = debtsRef.doc();

      batch.set(newDebtRef,{
        customer: customerName,
        items: debtCart,
        total,
        remaining: total,
        status: "unpaid",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    }else{

      const docSnap = existingSnap.docs[0];
      const debtData = docSnap.data();

      batch.update(docSnap.ref,{
        items: [...debtData.items, ...debtCart],
        total: debtData.total + total,
        remaining: debtData.remaining + total,
        status: "unpaid"
      });
    }

    /* STOCK DEDUCTION */
    debtCart.forEach(item=>{
      const productRef = db.collection("shops")
        .doc(shopId)
        .collection("products")
        .doc(item.id);

      batch.update(productRef,{
        stock: firebase.firestore.FieldValue.increment(-item.quantity)
      });
    });

    await batch.commit();

    debtCart = [];
    renderDebtCart();

    showSuccess("Nasiya muvaffaqiyatli saqlandi");

  }catch(error){
    console.error(error);
    alert("Xatolik yuz berdi");
  }

  if(button){
    button.disabled = false;
    button.innerText = "Nasiya berish";
  }
}

/* LOAD DEBT CUSTOMERS */
function loadDebtCustomers(){

  const shopId = safeGetUserId();
  if(!shopId) return;

  if(debtUnsubscribe) debtUnsubscribe();

  debtUnsubscribe = db.collection("shops")
    .doc(shopId)
    .collection("debts")
    .onSnapshot(snapshot=>{

      const container = document.getElementById("debtCustomersList");
      if(!container) return;

      container.innerHTML = "";

      snapshot.forEach(doc=>{
        const d = doc.data();

        /* AUTO DELETE WHEN FULLY PAID */
        if(d.remaining <= 0){
          doc.ref.delete();
          return;
        }

        container.innerHTML += `
          <div class="card">
            <strong>${d.customer}</strong><br>
            Jami: ${formatMoney(d.total)}<br>
            Qolgan: ${formatMoney(d.remaining)}<br>

            <input type="number"
              placeholder="To'lov"
              id="pay_${doc.id}">
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

  if(!amount || amount<=0) return;

  const debtRef = db.collection("shops")
    .doc(shopId)
    .collection("debts")
    .doc(debtId);

  const docSnap = await debtRef.get();
  const debt = docSnap.data();
  if(!debt) return;

  if(amount > debt.remaining){
    alert("Qoldiqdan ko'p to'lash mumkin emas");
    return;
  }

  const newRemaining = debt.remaining - amount;

  await debtRef.update({
    remaining: newRemaining,
    status: newRemaining===0 ? "paid" : "partial"
  });

  await db.collection("shops")
    .doc(shopId)
    .collection("sales")
    .add({
      type:"debt_payment",
      total: amount,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  showSuccess("To'lov qabul qilindi");
}
/* =====================================================
   STOCK SYSTEM (FULL SAFE + ADD FUNCTION)
===================================================== */

let stockUnsubscribe = null;

function addStock(){

  const shopId = safeGetUserId();
  if(!shopId) return;

  const name = document.getElementById("stockName")?.value.trim();
  const qty  = Number(document.getElementById("stockQty")?.value);
  const cost = Number(document.getElementById("stockCost")?.value);
  const sell = Number(document.getElementById("stockSellingPrice")?.value);

  if(!name || !qty || !sell){
    alert("Ma'lumotlarni to'ldiring");
    return;
  }

  db.collection("shops")
    .doc(shopId)
    .collection("products")
    .add({
      name: name,
      stock: qty,
      costPrice: cost || 0,
      sellingPrice: sell,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  document.getElementById("stockName").value = "";
  document.getElementById("stockQty").value = "";
  document.getElementById("stockCost").value = "";
  document.getElementById("stockSellingPrice").value = "";

  showSuccess("Mahsulot qo'shildi");
}

function loadCurrentStock(){

  const shopId = safeGetUserId();
  if(!shopId) return;

  if(stockUnsubscribe) stockUnsubscribe();

  stockUnsubscribe = db.collection("shops")
    .doc(shopId)
    .collection("products")
    .onSnapshot(snapshot=>{

      const container = document.getElementById("currentStockList");
      if(!container) return;

      container.innerHTML="";

      snapshot.forEach(doc=>{
        const p = doc.data();

        container.innerHTML += `
          <div class="card">
            <input type="text"
              value="${p.name}"
              onchange="editStock('${doc.id}','name',this.value)">

            Ombor:
            <input type="number"
              value="${p.stock||0}"
              onchange="editStock('${doc.id}','stock',this.value)">

            Kelgan narx:
            <input type="number"
              value="${p.costPrice||0}"
              onchange="editStock('${doc.id}','costPrice',this.value)">

            Sotish narx:
            <input type="number"
              value="${p.sellingPrice||0}"
              onchange="editStock('${doc.id}','sellingPrice',this.value)">

            <button style="background:red"
              onclick="deleteStock('${doc.id}')">
              O'chirish
            </button>
          </div>
        `;
      });
    });
}

async function editStock(id,field,value){

  const shopId = safeGetUserId();
  if(!shopId) return;

  await db.collection("shops")
    .doc(shopId)
    .collection("products")
    .doc(id)
    .update({
      [field]: field==="name" ? value : Number(value)
    });
}

async function deleteStock(id){

  const shopId = safeGetUserId();
  if(!shopId) return;

  await db.collection("shops")
    .doc(shopId)
    .collection("products")
    .doc(id)
    .delete();

  showSuccess("Mahsulot o'chirildi");
}

/* =====================================================
   ANALYTICS SYSTEM (FULL CHART VERSION)
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

      const weeklyData = [0,0,0,0,0,0,0];
      const monthlyData = new Array(31).fill(0);

      const startWeek = getStartOfWeek();
      const startMonth = getStartOfMonth();

      snapshot.forEach(doc=>{
        const s = doc.data();
        if(!s.createdAt) return;

        const date = s.createdAt.toDate();

        if(date >= startWeek){
          const dayIndex = (date.getDay()+6)%7;
          weeklyData[dayIndex] += s.total || 0;
        }

        if(date >= startMonth){
          const day = date.getDate()-1;
          monthlyData[day] += s.total || 0;
        }
      });

      renderWeeklyChart(weeklyData);
      renderMonthlyChart(monthlyData);
    });
}

function renderWeeklyChart(data){

  const ctx = document.getElementById("weeklyChart");
  if(!ctx) return;

  if(weeklyChart){
    weeklyChart.destroy();
  }

  weeklyChart = new Chart(ctx,{
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
      plugins:{
        legend:{display:false}
      }
    }
  });
}

function renderMonthlyChart(data){

  const ctx = document.getElementById("monthlyChart");
  if(!ctx) return;

  if(monthlyChart){
    monthlyChart.destroy();
  }

  monthlyChart = new Chart(ctx,{
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
      plugins:{
        legend:{display:false}
      }
    }
  });
}

/* =====================================================
   SUCCESS OVERLAY SYSTEM
===================================================== */

function showSuccess(message){

  const overlay = document.getElementById("successOverlay");
  const text = document.getElementById("successText");

  if(!overlay || !text) return;

  text.innerText = message;
  overlay.classList.remove("hidden");

  setTimeout(()=>{
    overlay.classList.add("hidden");
  },1500);
}
