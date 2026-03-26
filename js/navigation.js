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


if(typeof handleAddProductActions === "function"){
  handleAddProductActions();
}
  /* ================================
     CAMERA BUTTON CONTROL
  ================================ */
  const cameraSection = document.getElementById("cameraSection");

  if(cameraSection){
// show ONLY on stock page
cameraSection.style.display = (pageId === "stockPage") ? "block" : "none";}

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

  if(pageId === "salePage" && typeof loadProducts === "function"){
    if(typeof productCache === "undefined" || productCache.length === 0){
      loadProducts();
    }
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
}
