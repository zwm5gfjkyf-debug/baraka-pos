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
     TOP HEADER CONTROL
  ================================ */
  const appHeader = document.querySelector('.app-header');
  if(appHeader){
    const hideHeader = pageId === 'dashboardPage' || pageId === 'todaySalesHistoryPage';
    appHeader.style.display = hideHeader ? 'none' : 'flex';
  }

  const mainContent = document.querySelector('.main-content');
  if(mainContent){
    const topPad = (pageId === 'dashboardPage' || pageId === 'todaySalesHistoryPage') ? '0' : '80px';
    mainContent.style.paddingTop = topPad;
  }

  if(previousPage === 'todaySalesHistoryPage' && pageId !== 'todaySalesHistoryPage' && typeof cleanupTodaySalesHistoryListeners === 'function'){
    cleanupTodaySalesHistoryListeners()
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
    analyticsPage: 3
  };

  const navButtons = document.querySelectorAll(".bottom-nav button");
  navButtons.forEach(btn => btn.classList.remove("active"));

  if(navMap[pageId] !== undefined){
    navButtons[navMap[pageId]].classList.add("active");
  }

  if(pageId === 'todaySalesHistoryPage' && navButtons.length > 0){
    navButtons[0].classList.add("active");
  }

  if(typeof updateSidebarActive === 'function'){
    updateSidebarActive(pageId === 'todaySalesHistoryPage' ? 'dashboardPage' : pageId)
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

if(pageId === "analyticsPage"){

  setTimeout(() => {

    if(typeof loadStoreAnalytics === "function"){
      loadStoreAnalytics()
    }

  }, 150)

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
