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
   REGISTER / LOGIN
========================= */

async function register(){
  const shopName = shopName.value.trim();
  const emailVal = email.value.trim();
  const passVal = password.value;

  if(!shopName || !emailVal || !passVal){
    alert("Barcha maydonlarni to'ldiring");
    return;
  }

  const cred = await auth.createUserWithEmailAndPassword(emailVal, passVal);

  await db.collection("shops")
    .doc(cred.user.uid)
    .set({
      shopName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function login(){
  await auth.signInWithEmailAndPassword(
    email.value.trim(),
    password.value
  );
}

function logout(){
  auth.signOut();
}

function toggleProfileMenu(){
  profileMenu.classList.toggle("hidden");
}

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

  event.target.classList.add("active");

  if(pageId==="dashboardPage") loadDashboard();
  if(pageId==="salePage") loadSaleProducts();
  if(pageId==="debtPage") loadDebtCustomers();
  if(pageId==="analyticsPage") loadAnalytics();
}

/* =========================
   DASHBOARD (REAL CALC)
========================= */

function loadDashboard(){

  const shopId = auth.currentUser.uid;
  const salesRef = db.collection("shops")
    .doc(shopId)
    .collection("sales");

  salesRef.onSnapshot(snapshot=>{

    let today=0, week=0, month=0;

    const startToday = getStartOfToday();
    const startWeek = getStartOfWeek();
    const startMonth = getStartOfMonth();

    snapshot.forEach(doc=>{
      const s = doc.data();
      if(!s.createdAt) return;

      const date = s.createdAt.toDate();

      if(s.type==="cash"){
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
   SALE ENGINE
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

function renderCart(){
  cartList.innerHTML="";
  let total=0;

  cart.forEach(item=>{
    total += item.price*item.quantity;

    cartList.innerHTML+=`
      <div class="cart-item">
        <strong>${item.name}</strong><br>
        ${formatMoney(item.price)} × ${item.quantity}
        <div>${formatMoney(item.price*item.quantity)} so'm</div>
      </div>`;
  });

  saleTotal.innerText=formatMoney(total);
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

  await db.collection("shops")
    .doc(shopId)
    .collection("sales")
    .add({
      items:cart,
      total,
      type:"cash",
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });

  cart=[];
  renderCart();
  alert("Sotuv muvaffaqiyatli");
  isProcessing=false;
}

/* =========================
   NASIYA SYSTEM
========================= */

async function completeDebtSale(){

  const name = debtCustomerName.value.trim();
  if(!name || debtCart.length===0){
    alert("Mijoz yoki savat bo'sh");
    return;
  }

  const shopId=auth.currentUser.uid;
  const total = debtCart.reduce((s,i)=>s+i.price*i.quantity,0);

  await db.collection("shops")
    .doc(shopId)
    .collection("debts")
    .add({
      customer:name,
      items:debtCart,
      total,
      remaining:total,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });

  alert("Nasiya saqlandi");
}

function loadDebtCustomers(){

  const shopId=auth.currentUser.uid;

  db.collection("shops")
    .doc(shopId)
    .collection("debts")
    .onSnapshot(snapshot=>{

      debtCustomersList.innerHTML="";

      snapshot.forEach(doc=>{
        const d=doc.data();

        debtCustomersList.innerHTML+=`
          <div class="card">
            <strong>${d.customer}</strong><br>
            Qolgan: ${formatMoney(d.remaining)} so'm
          </div>`;
      });
    });
}

/* =========================
   ANALYTICS (CHART.JS)
========================= */

let weeklyChartInstance;
let monthlyChartInstance;

function loadAnalytics(){

  const shopId = auth.currentUser.uid;

  db.collection("shops")
    .doc(shopId)
    .collection("sales")
    .get()
    .then(snapshot=>{

      const weeklyData=[0,0,0,0,0,0,0];
      const monthlyData=new Array(31).fill(0);

      snapshot.forEach(doc=>{
        const s=doc.data();
        if(!s.createdAt) return;

        const date=s.createdAt.toDate();
        const day=date.getDay();
        const monthDay=date.getDate();

        weeklyData[day]+=s.total;
        monthlyData[monthDay-1]+=s.total;
      });

      if(weeklyChartInstance) weeklyChartInstance.destroy();
      if(monthlyChartInstance) monthlyChartInstance.destroy();

      weeklyChartInstance=new Chart(
        document.getElementById("weeklyChart"),
        {
          type:"bar",
          data:{
            labels:["Yak","Dush","Sesh","Chor","Pay","Jum","Shan"],
            datasets:[{
              label:"Haftalik",
              data:weeklyData
            }]
          }
        }
      );

      monthlyChartInstance=new Chart(
        document.getElementById("monthlyChart"),
        {
          type:"line",
          data:{
            labels:monthlyData.map((_,i)=>i+1),
            datasets:[{
              label:"Oylik",
              data:monthlyData
            }]
          }
        }
      );

    });
}
