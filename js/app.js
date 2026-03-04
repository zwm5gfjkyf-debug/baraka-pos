/* =====================================================
   BARAKA POS PRO CORE
   Version: PRO 1.0
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
  if(day!==1) d.setDate(d.getDate()-(day-1));
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
   NOTIFICATION SYSTEM
===================================================== */

function notify(message,type="success"){

  let box=document.createElement("div");

  box.className="pos-notify";

  if(type==="error") box.style.background="#ef4444";
  if(type==="warning") box.style.background="#f59e0b";

  box.innerText=message;

  document.body.appendChild(box);

  setTimeout(()=>{
    box.style.opacity="0";
    box.style.transform="translateY(-20px)";
  },2000);

  setTimeout(()=>{
    box.remove();
  },2500);
}

/* =====================================================
   OFFLINE CACHE SYSTEM
===================================================== */

function cacheSaleOffline(sale){

  let cache=localStorage.getItem("offline_sales");

  if(!cache) cache="[]";

  let sales=JSON.parse(cache);

  sales.push(sale);

  localStorage.setItem("offline_sales",JSON.stringify(sales));

}

async function syncOfflineSales(){

  const shopId=safeGetUserId();
  if(!shopId) return;

  let cache=localStorage.getItem("offline_sales");

  if(!cache) return;

  let sales=JSON.parse(cache);

  if(!sales.length) return;

  for(let sale of sales){

    await db.collection("shops")
    .doc(shopId)
    .collection("sales")
    .add(sale);

  }

  localStorage.removeItem("offline_sales");

  notify("Offline sales synced");

}

window.addEventListener("online",syncOfflineSales);

/* =====================================================
   AUTH STATE
===================================================== */

auth.onAuthStateChanged(user=>{

  const loading=document.getElementById("loadingScreen");
  if(loading) loading.classList.add("hidden");

  if(user){

    document.getElementById("authScreen")?.classList.add("hidden");
    document.getElementById("appScreen")?.classList.remove("hidden");

    document.getElementById("shopTitle").innerText=user.email;

    loadDashboard();
    loadSaleProducts();

    syncOfflineSales();

  }else{

    document.getElementById("appScreen")?.classList.add("hidden");
    document.getElementById("authScreen")?.classList.remove("hidden");

  }

});

/* =====================================================
   NAVIGATION
===================================================== */

function navigate(pageId){

  document.querySelectorAll(".page")
  .forEach(p=>p.classList.add("hidden"));

  const page=document.getElementById(pageId);
  if(!page) return;

  page.classList.remove("hidden");

  document.querySelectorAll(".bottom-nav button")
  .forEach(btn=>btn.classList.remove("active"));

  document.querySelectorAll(".bottom-nav button")
  .forEach(btn=>{
    if(btn.getAttribute("onclick")?.includes(pageId)){
      btn.classList.add("active");
    }
  });

  if(pageId==="dashboardPage") loadDashboard();
  if(pageId==="salePage") loadSaleProducts();
  if(pageId==="stockPage") loadCurrentStock();
  if(pageId==="analyticsPage") loadAnalytics();
  if(pageId==="debtPage") loadDebtCustomers();

}

/* =====================================================
   SMART PRODUCT SEARCH
===================================================== */

function smartSearchProducts(keyword){

  keyword=keyword.toLowerCase();

  return saleProducts
  .filter(p=>p.name?.toLowerCase().includes(keyword))
  .sort((a,b)=>{

    if(a.name.toLowerCase().startsWith(keyword)) return -1;
    if(b.name.toLowerCase().startsWith(keyword)) return 1;
    return 0;

  });

}

function searchProducts(keyword){

  const resultsDiv=document.getElementById("searchResults");

  if(!resultsDiv) return;

  resultsDiv.innerHTML="";

  if(!keyword) return;

  let results=smartSearchProducts(keyword);

  results.slice(0,20).forEach(p=>{

    resultsDiv.innerHTML+=`
      <div class="card product-result"
      onclick="addToCart('${p.id}')">

      <strong>${p.name}</strong>
      <div>${formatMoney(p.sellingPrice)} so'm</div>

      </div>
    `;

  });

}

/* =====================================================
   LOW STOCK WARNING
===================================================== */

function checkLowStock(products){

  let low=[];

  products.forEach(p=>{
    if((p.stock||0)<=5){
      low.push(p);
    }
  });

  if(!low.length) return;

  notify("⚠ Low stock items: "+low.length,"warning");

}

/* =====================================================
   LOAD PRODUCTS
===================================================== */

let saleProducts=[];

function loadSaleProducts(){

  const shopId=safeGetUserId();
  if(!shopId) return;

  db.collection("shops")
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

    checkLowStock(saleProducts);

  });

}

/* =====================================================
   MOBILE POS KEYPAD
===================================================== */

function openNumericPad(callback){

  let pad=document.createElement("div");

  pad.className="pos-keypad";

  pad.innerHTML=`
  <div class="pad-screen" id="padScreen">0</div>

  <div class="pad-grid">
  ${[1,2,3,4,5,6,7,8,9].map(n=>`<button onclick="pressPad(${n})">${n}</button>`).join("")}
  <button onclick="pressPad(0)">0</button>
  <button onclick="clearPad()">DEL</button>
  <button onclick="confirmPad()">OK</button>
  </div>
  `;

  document.body.appendChild(pad);

  window.padValue="";
  window.padCallback=callback;

}

function pressPad(num){

  padValue+=num;

  document.getElementById("padScreen").innerText=padValue;

}

function clearPad(){

  padValue=padValue.slice(0,-1);

  document.getElementById("padScreen").innerText=padValue||0;

}

function confirmPad(){

  if(window.padCallback){
    padCallback(Number(padValue));
  }

  document.querySelector(".pos-keypad").remove();

}

/* =====================================================
   SUCCESS OVERLAY
===================================================== */

function showSuccess(message){

  const overlay=document.getElementById("successOverlay");
  const text=document.getElementById("successText");

  if(!overlay||!text) return;

  text.innerText=message;

  overlay.classList.remove("hidden");

  setTimeout(()=>{
    overlay.classList.add("hidden");
  },1500);

}
/* =====================================================
   POS CART ENGINE
===================================================== */

let cart=[];

/* ADD PRODUCT */

function addToCart(productId){

  const product=saleProducts.find(p=>p.id===productId);
  if(!product) return;

  const existing=cart.find(i=>i.id===productId);

  if(existing){

    existing.quantity+=1;

  }else{

    cart.push({
      id:product.id,
      name:product.name,
      price:product.sellingPrice||0,
      cost:product.costPrice||0,
      quantity:1
    });

  }

  renderCart();

}

/* REMOVE PRODUCT */

function removeFromCart(id){

  cart=cart.filter(i=>i.id!==id);
  renderCart();

}

/* CHANGE PRICE */

function changePrice(id,newPrice){

  const item=cart.find(i=>i.id===id);
  if(!item) return;

  item.price=Number(newPrice)||0;

  renderCart();

}

/* CHANGE QTY BUTTON */

function changeQty(id,amount){

  const item=cart.find(i=>i.id===id);
  if(!item) return;

  item.quantity+=amount;

  if(item.quantity<=0){
    removeFromCart(id);
    return;
  }

  renderCart();

}

/* MANUAL QTY INPUT */

function changeQtyManual(id,value){

  const item=cart.find(i=>i.id===id);
  if(!item) return;

  const q=Number(value)||1;

  item.quantity=q;

  renderCart();

}

/* CLEAR CART */

function clearCart(){

  cart=[];
  renderCart();

}

/* =====================================================
   RENDER CART
===================================================== */

function renderCart(){

  const container=document.getElementById("cartList");
  if(!container) return;

  container.innerHTML="";

  let total=0;

  cart.forEach(item=>{

    const itemTotal=item.price*item.quantity;
    total+=itemTotal;

    container.innerHTML+=`

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

  document.getElementById("saleTotal").innerText=formatMoney(total);

}

/* =====================================================
   COMPLETE SALE ENGINE
===================================================== */

async function completeSale(){

  const button=document.getElementById("completeSaleBtn");

  if(button){
    button.disabled=true;
    button.innerText="Yuklanmoqda...";
  }

  if(cart.length===0){

    notify("Savatcha bo'sh","error");

    if(button){
      button.disabled=false;
      button.innerText="Sotuvni yakunlash";
    }

    return;

  }

  try{

    const shopId=safeGetUserId();
    if(!shopId) throw new Error("No user");

    const total=cart.reduce((s,i)=>s+i.price*i.quantity,0);

    const saleData={
      items:cart,
      total,
      type:"cash",
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    };

    /* OFFLINE SUPPORT */

    if(!navigator.onLine){

      cacheSaleOffline(saleData);

      notify("Sale saved offline");

      generateReceipt(cart,total);

      clearCart();

      return;

    }

    const batch=db.batch();

    const saleRef=db.collection("shops")
    .doc(shopId)
    .collection("sales")
    .doc();

    batch.set(saleRef,saleData);

    /* STOCK UPDATE */

    cart.forEach(item=>{

      const productRef=db.collection("shops")
      .doc(shopId)
      .collection("products")
      .doc(item.id);

      batch.update(productRef,{
        stock:firebase.firestore.FieldValue.increment(-item.quantity)
      });

    });

    await batch.commit();

    generateReceipt(cart,total);

    clearCart();

    showSuccess("Sotuv yakunlandi");

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

  let modal=document.createElement("div");

  modal.className="receipt-modal";

  let itemsHTML="";

  items.forEach(i=>{

    itemsHTML+=`
    <div class="receipt-row">
      <span>${i.name} x${i.quantity}</span>
      <span>${formatMoney(i.price*i.quantity)}</span>
    </div>
    `;

  });

  modal.innerHTML=`

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

  <button onclick="printReceipt()">Print</button>

  <button onclick="closeReceipt()">Close</button>

  </div>

  `;

  document.body.appendChild(modal);

}

/* PRINT */

function printReceipt(){

  window.print();

}

/* CLOSE */

function closeReceipt(){

  const modal=document.querySelector(".receipt-modal");

  if(modal) modal.remove();

}
/* =====================================================
   PROFIT ANALYTICS SYSTEM
===================================================== */

let weeklyChart=null;
let monthlyChart=null;

/* LOAD ANALYTICS */

function loadAnalytics(){

  const shopId=safeGetUserId();
  if(!shopId) return;

  db.collection("shops")
  .doc(shopId)
  .collection("sales")
  .get()
  .then(snapshot=>{

    let totalRevenue=0;
    let totalProfit=0;
    let totalSales=0;

    const weeklyData=[0,0,0,0,0,0,0];
    const monthlyData=new Array(31).fill(0);

    const productStats={};

    const startWeek=getStartOfWeek();
    const startMonth=getStartOfMonth();

    snapshot.forEach(doc=>{

      const sale=doc.data();
      if(!sale.createdAt) return;

      const date=sale.createdAt.toDate();

      totalRevenue+=sale.total||0;
      totalSales++;

      if(sale.items){

        sale.items.forEach(item=>{

          const profit=(item.price-item.cost)*item.quantity;
          totalProfit+=profit;

          if(!productStats[item.name]){
            productStats[item.name]=0;
          }

          productStats[item.name]+=item.quantity;

        });

      }

      if(date>=startWeek){

        const dayIndex=(date.getDay()+6)%7;
        weeklyData[dayIndex]+=sale.total||0;

      }

      if(date>=startMonth){

        const day=date.getDate()-1;
        monthlyData[day]+=sale.total||0;

      }

    });

    renderAnalyticsCards(totalRevenue,totalProfit,totalSales);

    renderWeeklyChart(weeklyData);

    renderMonthlyChart(monthlyData);

    renderTopProducts(productStats);

  });

}

/* =====================================================
   ANALYTICS CARDS
===================================================== */

function renderAnalyticsCards(revenue,profit,sales){

  const container=document.getElementById("analyticsContent");
  if(!container) return;

  container.innerHTML=`

  <div class="card">
    <h3>Umumiy tushum</h3>
    <div style="font-size:26px;font-weight:700">
      ${formatMoney(revenue)} so'm
    </div>
  </div>

  <div class="card">
    <h3>Umumiy foyda</h3>
    <div style="font-size:26px;font-weight:700">
      ${formatMoney(profit)} so'm
    </div>
  </div>

  <div class="card">
    <h3>Savdo soni</h3>
    <div style="font-size:26px;font-weight:700">
      ${sales}
    </div>
  </div>

  `;

}

/* =====================================================
   WEEKLY CHART
===================================================== */

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

/* =====================================================
   MONTHLY CHART
===================================================== */

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
   BEST SELLING PRODUCTS
===================================================== */

function renderTopProducts(stats){

  const container=document.createElement("div");

  container.className="card";

  let sorted=Object.entries(stats)
  .sort((a,b)=>b[1]-a[1])
  .slice(0,5);

  let html="<h3>Top mahsulotlar</h3>";

  sorted.forEach(p=>{

    html+=`
      <div style="display:flex;justify-content:space-between">
        <span>${p[0]}</span>
        <strong>${p[1]}</strong>
      </div>
    `;

  });

  container.innerHTML=html;

  document.getElementById("analyticsContent")
  .appendChild(container);

}

/* =====================================================
   CUSTOMER HISTORY (DEBT)
===================================================== */

function showCustomerHistory(customer){

  const shopId=safeGetUserId();
  if(!shopId) return;

  db.collection("shops")
  .doc(shopId)
  .collection("debts")
  .where("customer","==",customer)
  .get()
  .then(snapshot=>{

    let modal=document.createElement("div");

    modal.className="receipt-modal";

    let html=`<h2>${customer}</h2>`;

    snapshot.forEach(doc=>{

      const d=doc.data();

      html+=`
      <div class="receipt-row">
        <span>Qarz:</span>
        <span>${formatMoney(d.total)}</span>
      </div>

      <div class="receipt-row">
        <span>Qolgan:</span>
        <span>${formatMoney(d.remaining)}</span>
      </div>

      <hr>
      `;

    });

    modal.innerHTML=`
      <div class="receipt-box">
        ${html}
        <button onclick="this.closest('.receipt-modal').remove()">
          Close
        </button>
      </div>
    `;

    document.body.appendChild(modal);

  });

}

/* =====================================================
   LOW STOCK DASHBOARD
===================================================== */

function showLowStockDashboard(){

  let low=saleProducts.filter(p=>(p.stock||0)<=5);

  if(!low.length) return;

  let container=document.createElement("div");

  container.className="card";

  let html="<h3>⚠ Low stock</h3>";

  low.forEach(p=>{

    html+=`
      <div style="display:flex;justify-content:space-between">
        <span>${p.name}</span>
        <span>${p.stock}</span>
      </div>
    `;

  });

  container.innerHTML=html;

  document.getElementById("dashboardPage")
  .appendChild(container);

}

/* =====================================================
   SALES NOTIFICATIONS
===================================================== */

function watchSales(){

  const shopId=safeGetUserId();
  if(!shopId) return;

  db.collection("shops")
  .doc(shopId)
  .collection("sales")
  .orderBy("createdAt","desc")
  .limit(1)
  .onSnapshot(snapshot=>{

    snapshot.forEach(doc=>{

      const sale=doc.data();

      notify(
        "New sale: "+formatMoney(sale.total)+" so'm"
      );

    });

  });

}

/* =====================================================
   ANIMATED COUNTERS
===================================================== */

function animateNumber(element,value){

  let start=0;

  let duration=800;

  let step=value/(duration/16);

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
