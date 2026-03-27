/* =========================================
   PAGE NAVIGATION (FINAL FIXED VERSION)
========================================= */

let currentPage = null;

function navigate(pageId){

  currentPage = pageId;

  /* ================================
     HIDE ALL PAGES
  ================================ */
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));

  /* ================================
     SHOW CURRENT PAGE
  ================================ */
  const page = document.getElementById(pageId);
  if(page) page.classList.remove('hidden');
// 🔥 RESET SALE BUTTON STATES
if(pageId === "salePage"){
  const actions = document.getElementById("saleActions")
  if(actions){
    actions.classList.remove("center","split")
  }
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
     BOTTOM NAV CONTROL
  ================================ */
  const bottomNav = document.querySelector(".bottom-nav");

  if(bottomNav){
    bottomNav.style.display = (
      pageId === "addProductPage" || pageId === "unitPage"
    ) ? "none" : "flex";
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

  /* ================================
     DATA LOADERS (LAZY LOAD)
  ================================ */

  if(pageId === "dashboardPage" && typeof loadDashboard === "function"){
    loadDashboard();
  }

  // 🔥 FIX SALE BUTTONS ON PAGE OPEN
if(pageId === "salePage" && typeof updateSaleButtons === "function"){
  setTimeout(()=>{
    updateSaleButtons()
  }, 50)
}

  if(pageId === "stockPage" && typeof loadCurrentStock === "function"){
    if(typeof stockLoaded === "undefined" || !stockLoaded){
      loadCurrentStock();
      stockLoaded = true;
    }
  }

  if(pageId === "analyticsPage"){
    if(typeof showAnalyticsTab === "function"){
      showAnalyticsTab("weekly");
    }
  }

  if(pageId === "debtAnalyticsPage" && typeof loadDebtCustomers === "function"){
    loadDebtCustomers();
  }
   if(pageId === "debtAnalyticsPage" && typeof loadDebtCustomers === "function"){
  loadDebtCustomers();
}

/* 🔥 ADD THIS HERE (VERY END OF navigate) */
if(pageId === "salePage"){
  const actions = document.getElementById("saleActions")
  if(actions){
    actions.classList.remove("split")
    actions.classList.add("center")
  }
}
}
