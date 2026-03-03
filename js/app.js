/* =========================
   GLOBAL HELPERS
========================= */

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
    d.setHours(-24 * (day - 1));
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

/* =========================
   AUTH STATE
========================= */

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

/* =========================
   NAVIGATION
========================= */

function navigate(pageId){

  document.querySelectorAll(".page")
    .forEach(p=>p.classList.add("hidden"));

  document.getElementById(pageId)
    .classList.remove("hidden");

  document.querySelectorAll(".bottom-nav button")
    .forEach(btn=>btn.classList.remove("active"));

  if(event && event.target){
    event.target.classList.add("active");
  }

  if(pageId==="dashboardPage") loadDashboard();
  if(pageId==="salePage") loadSaleProducts();
  if(pageId==="debtPage") loadDebtCustomers();
  if(pageId==="analyticsPage") loadAnalytics();
  if(pageId==="stockPage") loadCurrentStock();
}

/* =========================
   DASHBOARD
========================= */

function loadDashboard(){

  const shopId = auth.currentUser.uid;

  db.collection("shops")
    .doc(shopId)
    .collection("sales")
    .onSnapshot(snapshot=>{

      let today=0, week=0, month=0;

      const startToday = getStartOfToday();
      const startWeek = getStartOfWeek();
      const startMonth = getStartOfMonth();

      snapshot.forEach(doc=>{
        const s = doc.data();
        if(!s.createdAt) return;

        const date = s.createdAt.toDate();

        if(s.type==="cash" || s.type==="debt_payment"){
          if(date >= startToday) today += s.total;
          if(date >= startWeek) week += s.total;
          if(date >= startMonth) month += s.total;
        }
      });

      todaySales.innerText = formatMoney(today);
      weekSales.innerText = formatMoney(week);
      monthSales.innerText = formatMoney(month);
    });
}

/* =========================
   SALE ENGINE (NAQD)
========================= */

let saleProducts=[];
let cart=[];
let isProcessing=false;

function loadSaleProducts(){
  const shopId = auth.currentUser.uid;

  db.collection("shops")
    .doc(shopId)
    .collection("products")
    .onSnapshot(snapshot=>{
      saleProducts=[];
      snapshot.forEach(doc=>{
        saleProducts.push({id:doc.id,...doc.data()});
      });
    });
}

function searchProducts(keyword){
  searchResults.innerHTML="";
  if(!keyword) return;

  saleProducts
    .filter(p=>p.name.toLowerCase().includes(keyword.toLowerCase()))
    .forEach(p=>{
      searchResults.innerHTML+=`
        <div class="card" onclick="addToCart('${p.id}')">
          ${p.name} — ${formatMoney(p.sellingPrice)}
        </div>`;
    });
}

function addToCart(id){
  const product = saleProducts.find(p=>p.id===id);
  const existing = cart.find(i=>i.id===id);

  if(existing) existing.quantity++;
  else cart.push({
    id,
    name:product.name,
    price:product.sellingPrice||0,
    quantity:1
  });

  renderCart();
}

function changeQty(id, amount){
  const item = cart.find(i=>i.id===id);
  if(!item) return;

  item.quantity += amount;

  if(item.quantity <= 0){
    cart = cart.filter(i=>i.id!==id);
  }

  renderCart();
}

function changeQtyManual(id,value){
  const item = cart.find(i=>i.id===id);
  if(!item) return;
  item.quantity = Number(value);
  renderCart();
}

function changePrice(id,newPrice){
  const item = cart.find(i=>i.id===id);
  if(!item) return;
  item.price = Number(newPrice);
  renderCart();
}

function removeFromCart(id){
  cart = cart.filter(i=>i.id!==id);
  renderCart();
}

function renderCart(){

  const container = document.getElementById("cartList");
  container.innerHTML = "";

  let total = 0;

  cart.forEach(item => {

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

        <button style="background:red"
          onclick="removeFromCart('${item.id}')">
          O'chirish
        </button>
      </div>
    `;
  });

  document.getElementById("saleTotal").innerText = formatMoney(total);
}

function focusSaleSearch(){
  const input = document.getElementById("saleSearch");
  if(input){
    input.focus();
    input.scrollIntoView({behavior:"smooth"});
  }
}

async function completeSale(){

  if(isProcessing) return;
  isProcessing=true;

  if(cart.length===0){
    alert("Savatcha bo'sh");
    isProcessing=false;
    return;
  }

  const shopId=auth.currentUser.uid;
  const total=cart.reduce((s,i)=>s+i.price*i.quantity,0);

  const batch = db.batch();

  const saleRef = db.collection("shops")
    .doc(shopId)
    .collection("sales")
    .doc();

  batch.set(saleRef,{
    items:cart,
    total,
    type:"cash",
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
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

  cart=[];
  renderCart();
  alert("Sotuv muvaffaqiyatli");
  isProcessing=false;
}

/* =========================
   NASIYA SYSTEM (FIXED)
========================= */

let debtCart=[];

function renderDebtCart(){

  const container = document.getElementById("debtCartList");
  if(!container) return;

  container.innerHTML="";
  let total=0;

  debtCart.forEach(item=>{
    const itemTotal=item.price*item.quantity;
    total+=itemTotal;

    container.innerHTML+=`
      <div class="cart-item">
        <strong>${item.name}</strong><br>

        Narx:
        <input type="number"
          value="${item.price}"
          onchange="changeDebtPrice('${item.id}',this.value)">

        <div class="quantity-controls">
          <button onclick="changeDebtQty('${item.id}',-1)">-</button>
          <input type="number"
            value="${item.quantity}"
            onchange="changeDebtQtyManual('${item.id}',this.value)">
          <button onclick="changeDebtQty('${item.id}',1)">+</button>
        </div>

        ${formatMoney(itemTotal)} so'm
      </div>`;
  });
}

function changeDebtPrice(id,value){
  const item=debtCart.find(i=>i.id===id);
  if(!item) return;
  item.price=Number(value);
  renderDebtCart();
}

function changeDebtQty(id,amount){
  const item=debtCart.find(i=>i.id===id);
  if(!item) return;
  item.quantity+=amount;
  if(item.quantity<=0){
    debtCart=debtCart.filter(i=>i.id!==id);
  }
  renderDebtCart();
}

function changeDebtQtyManual(id,value){
  const item=debtCart.find(i=>i.id===id);
  if(!item) return;
  item.quantity=Number(value);
  renderDebtCart();
}

async function completeDebtSale(){

  const customerName =
    document.getElementById("debtCustomerName").value.trim();

  if(!customerName || debtCart.length===0){
    alert("Mijoz yoki mahsulot yo'q");
    return;
  }

  const shopId=auth.currentUser.uid;
  const total=debtCart.reduce((s,i)=>s+i.price*i.quantity,0);

  const debtsRef=db.collection("shops")
    .doc(shopId)
    .collection("debts");

  const existingSnap=await debtsRef
    .where("customer","==",customerName)
    .where("status","!=","paid")
    .get();

  if(existingSnap.empty){

    await debtsRef.add({
      customer:customerName,
      items:debtCart,
      total,
      remaining:total,
      status:"unpaid",
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });

  } else {

    const docSnap=existingSnap.docs[0];
    const old=docSnap.data();

    await debtsRef.doc(docSnap.id).update({
      items:[...old.items,...debtCart],
      total:old.total+total,
      remaining:old.remaining+total
    });
  }

  debtCart=[];
  renderDebtCart();
  alert("Nasiya saqlandi");
}

/* =========================
   STOCK SYSTEM (EDITABLE)
========================= */

function loadCurrentStock(){

  const shopId=auth.currentUser.uid;

  db.collection("shops")
    .doc(shopId)
    .collection("products")
    .onSnapshot(snapshot=>{

      const container=document.getElementById("currentStockList");
      if(!container) return;
      container.innerHTML="";

      snapshot.forEach(doc=>{
        const p=doc.data();

        container.innerHTML+=`
          <div class="card">
            <strong>${p.name}</strong><br>

            Ombor:
            <input type="number"
              value="${p.stock}"
              onchange="updateStock('${doc.id}',this.value)"><br>

            Kelgan narx:
            <input type="number"
              value="${p.costPrice}"
              onchange="updateCost('${doc.id}',this.value)"><br>

            Sotish narx:
            <input type="number"
              value="${p.sellingPrice}"
              onchange="updateSelling('${doc.id}',this.value)"><br>

            <button style="background:red"
              onclick="deleteProduct('${doc.id}')">
              O'chirish
            </button>
          </div>`;
      });

    });
}

async function updateStock(id,value){
  const shopId=auth.currentUser.uid;
  await db.collection("shops")
    .doc(shopId)
    .collection("products")
    .doc(id)
    .update({stock:Number(value)});
}

async function updateCost(id,value){
  const shopId=auth.currentUser.uid;
  await db.collection("shops")
    .doc(shopId)
    .collection("products")
    .doc(id)
    .update({costPrice:Number(value)});
}

async function updateSelling(id,value){
  const shopId=auth.currentUser.uid;
  await db.collection("shops")
    .doc(shopId)
    .collection("products")
    .doc(id)
    .update({sellingPrice:Number(value)});
}

async function deleteProduct(id){
  const shopId=auth.currentUser.uid;
  await db.collection("shops")
    .doc(shopId)
    .collection("products")
    .doc(id)
    .delete();
}
