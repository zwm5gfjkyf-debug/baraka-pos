/* =========================================
   PAGE NAVIGATION (OPTIMIZED + CLEAN)
========================================= */

let currentPage = null;

function navigate(pageId){

  // prevent unnecessary reload
  if(currentPage === pageId) return;
  currentPage = pageId;

  // hide all pages
  document.querySelectorAll(".page")
    .forEach(p => p.classList.add("hidden"));

  const page = document.getElementById(pageId);

  if(page){
    page.classList.remove("hidden");
  }

  /* ================================
     ADD PRODUCT ACTION BAR
  ================================ */
  const actions = document.getElementById("addProductActions");
  if(actions){
    actions.style.display = (pageId === "addProductPage") ? "flex" : "none";
  }

  /* ================================
     CAMERA BUTTON CONTROL
  ================================ */
  const cameraSection = document.getElementById("cameraSection");

  if(cameraSection){
    // show ONLY on sale page
    cameraSection.style.display = (pageId === "salePage") ? "block" : "none";
  }

  if(typeof updateCamera === "function"){
    updateCamera();
  }

  /* ================================
     BOTTOM NAV CONTROL
  ================================ */
  const bottomNav = document.querySelector(".bottom-nav");

  if(bottomNav){
    // hide on add product page (clean UI)
    bottomNav.style.display = (pageId === "addProductPage") ? "none" : "flex";
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

  if(pageId === "salePage" && typeof loadProducts === "function"){
    if(typeof productCache === "undefined" || productCache.length === 0){
      loadProducts();
    }
  }

  if(pageId === "stockPage" && typeof loadCurrentStock === "function"){
    loadCurrentStock();
  }

  if(pageId === "analyticsPage"){
    if(typeof showAnalyticsTab === "function"){
      showAnalyticsTab("weekly");
    }
  }

  if(pageId === "debtAnalyticsPage" && typeof loadDebtCustomers === "function"){
    loadDebtCustomers();
  }
}
