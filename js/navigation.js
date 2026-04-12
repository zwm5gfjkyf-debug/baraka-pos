/* =========================================
   PAGE NAVIGATION (FINAL FIXED VERSION)
========================================= */

let currentPage = null;

function navigate(pageId){
  const previousPage = currentPage;
  currentPage = pageId;

/* ================================
   HIDE ALL PAGES
================================ */
document.querySelectorAll('.page').forEach(p => {
  p.classList.add('hidden')
})

/* ================================
   SHOW CURRENT PAGE
================================ */
const page = document.getElementById(pageId)

if(page){
  page.classList.remove('hidden')
  page.style.display = "block"
}
  /* ================================
     SCANNER CONTROL (🔥 FIX)
  ================================ */
  const camera = document.getElementById("cameraSection");

 

  if(camera){
    camera.style.display = (pageId === "stockPage") ? "flex" : "none";
  }

  /* ================================
     CAMERA SYSTEM UPDATE
  ================================ */
  if(typeof updateCamera === "function"){
    updateCamera();
  }

  /* ================================
     TOP HEADER CONTROL (always visible, including Asosiy)
  ================================ */
  const appHeader = document.querySelector('.app-header');
  if(appHeader){
    appHeader.style.display = 'flex';
  }

  const mainContent = document.querySelector('.main-content');
  if(mainContent){
    mainContent.style.paddingTop = '80px';
  }

  if(previousPage === 'todaySalesHistoryPage' && pageId !== 'todaySalesHistoryPage' && typeof cleanupTodaySalesHistoryListeners === 'function'){
    cleanupTodaySalesHistoryListeners()
  }

  if(previousPage === 'tahlilHubPage' && pageId !== 'tahlilHubPage' && typeof cleanupTahlilHubListeners === 'function'){
    cleanupTahlilHubListeners()
  }

  if(previousPage === 'weeklyTahliliPage' && pageId !== 'weeklyTahliliPage' && typeof cleanupWeeklyTahliliListeners === 'function'){
    cleanupWeeklyTahliliListeners()
  }

  if(previousPage === 'monthlyTahliliPage' && pageId !== 'monthlyTahliliPage' && typeof cleanupMonthlyTahliliListeners === 'function'){
    cleanupMonthlyTahliliListeners()
  }

  if(previousPage === 'nasiyaTahliliPage' && pageId !== 'nasiyaTahliliPage' && typeof cleanupNasiyaTahliliListeners === 'function'){
    cleanupNasiyaTahliliListeners()
  }

  if(previousPage === 'dokonTahliliPage' && pageId !== 'dokonTahliliPage' && typeof cleanupStoreAnalyticsListener === 'function'){
    cleanupStoreAnalyticsListener()
  }

  if(previousPage === 'dashboardPage' && pageId !== 'dashboardPage' && pageId !== 'todaySalesHistoryPage' && typeof cleanupDashboardListeners === 'function'){
    cleanupDashboardListeners()
  }

  /* ================================
     BOTTOM NAV CONTROL
  ================================ */
  const bottomNav = document.querySelector(".bottom-nav");

  if(bottomNav){
    bottomNav.style.display = (
      pageId === "addProductPage" || pageId === "unitPage"
    ) ? "none" : "flex";
  }

  const centerHandle = document.getElementById('centerNavHandle');
  if(centerHandle){
    centerHandle.style.display = pageId === 'dashboardPage' ? 'flex' : 'none';
  }

  const fab = document.getElementById('floatingAddBtn');
  if(fab){
    fab.style.display = (pageId === 'dashboardPage' || pageId === 'todaySalesHistoryPage') ? 'flex' : 'none';
  }

  /* ================================
     ACTIVE NAV BUTTON
  ================================ */
  const navMap = {
    dashboardPage: 0,
    salePage: 1,
    stockPage: 2,
    tahlilHubPage: 3,
    dokonTahliliPage: 3,
    weeklyTahliliPage: 3,
    monthlyTahliliPage: 3,
    nasiyaTahliliPage: 3
  };

  const navButtons = document.querySelectorAll(".bottom-nav button");
  navButtons.forEach(btn => btn.classList.remove("active"));

  if(navMap[pageId] !== undefined){
    navButtons[navMap[pageId]].classList.add("active");
  }

  if(pageId === 'todaySalesHistoryPage' && navButtons.length > 0){
    navButtons[0].classList.add("active");
  }

  let sidebarRoute = pageId
  if(pageId === 'todaySalesHistoryPage'){
    sidebarRoute = 'dashboardPage'
  } else if(['tahlilHubPage','dokonTahliliPage','weeklyTahliliPage','monthlyTahliliPage','nasiyaTahliliPage'].includes(pageId)){
    sidebarRoute = 'tahlilHubPage'
  }

  if(typeof updateSidebarActive === 'function'){
    updateSidebarActive(sidebarRoute)
  }

 /* ================================
   DATA LOADERS (LAZY LOAD)
================================ */

if(pageId === "dashboardPage"){

  if(typeof loadDashboard === "function"){
    loadDashboard()
  }

}

if(pageId === "todaySalesHistoryPage"){

  if(typeof loadTodaySalesHistory === "function"){
    loadTodaySalesHistory()
  }

}

if(pageId === "salePage"){

  setTimeout(()=>{

    if(typeof renderCart === "function"){
      renderCart()
    }

    if(typeof updateSaleButtons === "function"){
      updateSaleButtons()
    }

  }, 100) // ⬅️ IMPORTANT: increase delay

}
// ✅ FIX STOCK LOADER (SAFE)
if(pageId === "stockPage"){
  if(typeof loadCurrent === "function"){
    if(typeof stockLoaded === "undefined" || !stockLoaded){
      loadCurrent()
      stockLoaded = true
    }
  }
}

if(pageId === "tahlilHubPage"){

  if(typeof loadTahlilHub === "function"){
    loadTahlilHub()
  }

}

if(pageId === "dokonTahliliPage"){

  setTimeout(() => {
    if(typeof loadStoreAnalytics === "function"){
      loadStoreAnalytics()
    }
  }, 150)

}

if(pageId === "weeklyTahliliPage"){

  if(typeof loadWeeklyTahliliPage === "function"){
    loadWeeklyTahliliPage()
  }

}

if(pageId === "monthlyTahliliPage"){

  if(typeof loadMonthlyTahliliPage === "function"){
    loadMonthlyTahliliPage()
  }

}

if(pageId === "nasiyaTahliliPage"){

  if(typeof loadNasiyaTahliliPage === "function"){
    loadNasiyaTahliliPage()
  }

}

// ✅ FIX DUPLICATE
if(pageId === "debtAnalyticsPage" && typeof loadDebtCustomers === "function"){
  loadDebtCustomers()
}

/* ================================
   SALE ACTIONS VISIBILITY (FINAL)
================================ */

const actions = document.getElementById("saleActions")

if(actions){

  if(pageId === "salePage"){
    actions.classList.remove("hidden")
    actions.classList.remove("split") 
    actions.classList.add("center")
  }else{
    actions.classList.add("hidden")
  }

}
}
