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

/* =====================================================
   AUTH STATE
===================================================== */

auth.onAuthStateChanged(user => {

  document.getElementById("loadingScreen").classList.add("hidden");

  if(user){

    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("appScreen").classList.remove("hidden");

    document.getElementById("shopTitle").innerText = user.email;

    loadDashboard();

  } else {

    document.getElementById("appScreen").classList.add("hidden");
    document.getElementById("authScreen").classList.remove("hidden");
  }
});

/* =====================================================
   REGISTER / LOGIN
===================================================== */

async function register(){

  const shopNameVal = document.getElementById("shopName").value.trim();
  const emailVal = document.getElementById("email").value.trim();
  const passVal = document.getElementById("password").value;

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
  await auth.signInWithEmailAndPassword(
    document.getElementById("email").value.trim(),
    document.getElementById("password").value
  );
}

function logout(){
  auth.signOut();
}

function toggleProfileMenu(){
  const menu = document.getElementById("profileMenu");
  if(menu) menu.classList.toggle("hidden");
}

/* =====================================================
   NAVIGATION (NO EVENT BUG)
===================================================== */

function navigate(pageId){

  document.querySelectorAll(".page")
    .forEach(p => p.classList.add("hidden"));

  const page = document.getElementById(pageId);
  if(page) page.classList.remove("hidden");

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
   DASHBOARD (REAL REVENUE + ITEM COUNT)
===================================================== */

function loadDashboard(){

  const shopId = auth.currentUser.uid;

  db.collection("shops")
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

      if(document.getElementById("todaySales"))
        document.getElementById("todaySales").innerText = formatMoney(todayRevenue);

      if(document.getElementById("weekSales"))
        document.getElementById("weekSales").innerText = formatMoney(weekRevenue);

      if(document.getElementById("monthSales"))
        document.getElementById("monthSales").innerText = formatMoney(monthRevenue);

      if(document.getElementById("todayCount"))
        document.getElementById("todayCount").innerText = todayCount;

      if(document.getElementById("weekCount"))
        document.getElementById("weekCount").innerText = weekCount;

      if(document.getElementById("monthCount"))
        document.getElementById("monthCount").innerText = monthCount;

    });
}
/* =====================================================
   SALE ENGINE (FULL FIXED + MULTI ITEM + EDITABLE)
===================================================== */

let saleProducts = [];
let cart = [];
let isProcessing = false;

/* --------------------------
   LOAD PRODUCTS (LIVE)
---------------------------*/
function loadSaleProducts(){

  const shopId = auth.currentUser.uid;

  db.collection("shops")
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

/* --------------------------
   SEARCH PRODUCTS
---------------------------*/
function searchProducts(keyword){

  const resultsDiv = document.getElementById("searchResults");
  resultsDiv.innerHTML = "";

  if(!keyword) return;

  saleProducts
    .filter(p =>
      p.name.toLowerCase().includes(keyword.toLowerCase())
    )
    .forEach(p=>{

      resultsDiv.innerHTML += `
        <div class="card"
             onclick="addToCart('${p.id}')">
          ${p.name} — ${formatMoney(p.sellingPrice)}
        </div>
      `;
    });
}

/* --------------------------
   ADD TO CART
---------------------------*/
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

  document.getElementById("saleSearch").value = "";
  document.getElementById("searchResults").innerHTML = "";
}

/* --------------------------
   RENDER CART
---------------------------*/
function renderCart(){

  const container = document.getElementById("cartList");
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

  document.getElementById("saleTotal").innerText =
    formatMoney(total);
}

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

/* --------------------------
   REMOVE ITEM
---------------------------*/
function removeFromCart(id){
  cart = cart.filter(i=>i.id!==id);
  renderCart();
}

/* --------------------------
   ADD ANOTHER ITEM BUTTON
---------------------------*/
function addAnotherItem(){
  document.getElementById("saleSearch").focus();
}

/* --------------------------
   COMPLETE SALE (WITH STOCK DEDUCTION)
---------------------------*/
async function completeSale(){

  if(isProcessing) return;
  isProcessing = true;
const btn = document.getElementById("completeSaleBtn");
if(btn){
  btn.disabled = true;
  btn.innerText = "Yuklanmoqda...";
}
  if(cart.length === 0){
    alert("Savatcha bo'sh");
    isProcessing = false;
    return;
  }

  const shopId = auth.currentUser.uid;

  const total = cart.reduce(
    (sum,i)=>sum+i.price*i.quantity,0
  );

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

  /* STOCK DEDUCTION */
  cart.forEach(item=>{
    const productRef = db.collection("shops")
      .doc(shopId)
      .collection("products")
      .doc(item.id);

    batch.update(productRef,{
      stock: firebase.firestore.FieldValue.increment(
        -item.quantity
      )
    });
  });

  await batch.commit();

  cart = [];
  renderCart();

const btn = document.getElementById("completeSaleBtn");
if(btn){
  btn.disabled = false;
  btn.innerText = "Sotuvni yakunlash";
}

showSuccess("Muvaffaqiyatli sotildi");

isProcessing = false;
/* =====================================================
   NASIYA SYSTEM (MERGE SAME CUSTOMER + EDITABLE)
===================================================== */

let debtCart = [];

/* SEARCH PRODUCTS FOR DEBT */
function searchDebtProducts(keyword){

  const resultsDiv =
    document.getElementById("debtSearchResults");

  if(!resultsDiv) return;

  resultsDiv.innerHTML = "";

  if(!keyword) return;

  saleProducts
    .filter(p =>
      p.name.toLowerCase().includes(keyword.toLowerCase())
    )
    .forEach(p=>{

      resultsDiv.innerHTML += `
        <div class="card"
             onclick="addDebtToCart('${p.id}')">
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
  } else {
    debtCart.push({
      id: product.id,
      name: product.name,
      price: product.sellingPrice || 0,
      quantity: 1
    });
  }

  renderDebtCart();
}

/* RENDER DEBT CART (EDITABLE PRICE + QTY) */
function renderDebtCart(){

  const container =
    document.getElementById("debtCartList");

  if(!container) return;

  container.innerHTML = "";

  let total = 0;

  debtCart.forEach(item=>{

    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    container.innerHTML += `
      <div class="cart-item">
        <strong>${item.name}</strong><br>

        Narx:
        <input type="number"
          value="${item.price}"
          onchange="changeDebtPrice('${item.id}', this.value)">

        <div class="quantity-controls">
          <button class="qty-btn"
            onclick="changeDebtQty('${item.id}', -1)">-</button>

          <input type="number"
            value="${item.quantity}"
            style="width:60px"
            onchange="changeDebtQtyManual('${item.id}', this.value)">

          <button class="qty-btn"
            onclick="changeDebtQty('${item.id}', 1)">+</button>
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

function changeDebtQtyManual(id,value){
  const item = debtCart.find(i=>i.id===id);
  if(!item) return;

  const newQty = Number(value);

  if(newQty <= 0){
    debtCart = debtCart.filter(i=>i.id!==id);
  } else {
    item.quantity = newQty;
  }

  renderDebtCart();
}

/* COMPLETE DEBT SALE (MERGE SAME CUSTOMER) */
async function completeDebtSale(){

  const btn = document.getElementById("completeDebtBtn");

  if(btn){
    btn.disabled = true;
    btn.innerText = "Yuklanmoqda...";
  }

  const customerName =
    document.getElementById("debtCustomerName")
    ?.value.trim();

  if(!customerName || debtCart.length===0){

    if(btn){
      btn.disabled = false;
      btn.innerText = "Nasiya berish";
    }

    alert("Mijoz yoki mahsulot yo'q");
    return;
  }

  try{

    const shopId = auth.currentUser.uid;

    const total = debtCart.reduce(
      (s,i)=>s+i.price*i.quantity,0
    );

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
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });

    } else {

      const docSnap = existingSnap.docs[0];
      const debtData = docSnap.data();

      const updatedItems =
        [...debtData.items, ...debtCart];

      const newTotal = debtData.total + total;
      const newRemaining =
        debtData.remaining + total;

      batch.update(docSnap.ref,{
        items: updatedItems,
        total: newTotal,
        remaining: newRemaining,
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
        stock: firebase.firestore.FieldValue.increment(
          -item.quantity
        )
      });
    });

    await batch.commit();

    debtCart = [];
    renderDebtCart();

    showSuccess("Nasiya muvaffaqiyatli saqlandi");

  } catch(error){
    console.error(error);
    alert("Xatolik yuz berdi");
  }

  if(btn){
    btn.disabled = false;
    btn.innerText = "Nasiya berish";
  }
}
  /* STOCK DEDUCTION */
  debtCart.forEach(item=>{
    const productRef = db.collection("shops")
      .doc(shopId)
      .collection("products")
      .doc(item.id);

    batch.update(productRef,{
      stock: firebase.firestore.FieldValue.increment(
        -item.quantity
      )
    });
  });

  await batch.commit();

  debtCart = [];
  renderDebtCart();

if(btn){
  btn.disabled = false;
  btn.innerText = "Nasiya berish";
}

showSuccess("Nasiya muvaffaqiyatli saqlandi");
}

/* LOAD DEBT CUSTOMERS */
function loadDebtCustomers(){

  const shopId = auth.currentUser.uid;

  db.collection("shops")
    .doc(shopId)
    .collection("debts")
    .onSnapshot(snapshot=>{

      const container =
        document.getElementById("debtCustomersList");

      if(!container) return;

      container.innerHTML = "";

      snapshot.forEach(doc=>{

        const d = doc.data();

        container.innerHTML += `
          <div class="card">
            <strong>${d.customer}</strong><br>
            Jami: ${formatMoney(d.total)}<br>
            Qolgan: ${formatMoney(d.remaining)}<br>

            <input type="number"
              placeholder="To'lov"
              id="pay_${doc.id}">
            <button
              onclick="payDebt('${doc.id}')">
              To'lash
            </button>
          </div>
        `;
      });
    });
}

/* PAY DEBT */
async function payDebt(debtId){

  const shopId = auth.currentUser.uid;

  const input =
    document.getElementById("pay_"+debtId);

  const amount = Number(input.value);

  if(amount<=0) return;

  const debtRef = db.collection("shops")
    .doc(shopId)
    .collection("debts")
    .doc(debtId);

  const docSnap = await debtRef.get();
  const debt = docSnap.data();

  if(amount > debt.remaining){
    alert("Qoldiqdan ko'p to'lash mumkin emas");
    return;
  }

  const newRemaining =
    debt.remaining - amount;

  await debtRef.update({
    remaining: newRemaining,
    status:
      newRemaining===0 ? "paid" : "partial"
  });

  await db.collection("shops")
    .doc(shopId)
    .collection("sales")
    .add({
      type:"debt_payment",
      total: amount,
      createdAt:
        firebase.firestore.FieldValue.serverTimestamp()
    });

  alert("To'lov qabul qilindi");
}

/* =====================================================
   STOCK SYSTEM (EDITABLE + DELETE)
===================================================== */

function loadCurrentStock(){

  const shopId = auth.currentUser.uid;

  db.collection("shops")
    .doc(shopId)
    .collection("products")
    .onSnapshot(snapshot=>{

      const container =
        document.getElementById("currentStockList");

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

  const shopId = auth.currentUser.uid;

  await db.collection("shops")
    .doc(shopId)
    .collection("products")
    .doc(id)
    .update({
      [field]:
        field==="name" ? value : Number(value)
    });
}

async function deleteStock(id){

  const shopId = auth.currentUser.uid;

  await db.collection("shops")
    .doc(shopId)
    .collection("products")
    .doc(id)
    .delete();
}
function showSuccess(message){

  const overlay = document.getElementById("successOverlay");
  const text = document.getElementById("successText");

  if(!overlay || !text) return;

  text.innerText = message;

  overlay.classList.remove("hidden");

  setTimeout(()=>{
    overlay.classList.add("hidden");
  },1800);
}
