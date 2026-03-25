/* =========================================
   PAGE NAVIGATION
========================================= */

function navigate(pageId){

  // hide all pages
  document.querySelectorAll(".page")
  .forEach(p => p.classList.add("hidden"));

  const page = document.getElementById(pageId);

  if(page){
  page.classList.remove("hidden");

  // 🔥 FORCE FIX (NO MORE BUGS)
  setTimeout(() => {
    const actions = document.getElementById("addProductActions")

    if(actions){
      if(pageId === "addProductPage"){
        actions.style.display = "flex"
      } else {
        actions.style.display = "none"
      }
    }
  }, 50)
}
// CAMERA BUTTON CONTROL
const cameraBtn = document.getElementById("cameraSaleButton")

if(typeof updateCamera === "function"){
  updateCamera()
}
const navButtons = document.querySelectorAll(".bottom-nav button");

navButtons.forEach(btn => btn.classList.remove("active"));

if(pageId === "dashboardPage") navButtons[0].classList.add("active");
if(pageId === "salePage") navButtons[1].classList.add("active");
if(pageId === "stockPage") navButtons[2].classList.add("active");
if(pageId === "analyticsPage") navButtons[3].classList.add("active");
  if(pageId === "dashboardPage" && typeof loadDashboard === "function"){
    loadDashboard();
  }

  if(pageId === "salePage" && typeof loadProducts === "function" && productCache.length === 0){
    loadProducts();
  }

  if(pageId === "debtPage" && typeof loadDebtCustomers === "function"){
    loadDebtCustomers();
  }

  if(pageId === "stockPage" && typeof loadCurrentStock === "function"){
    loadCurrentStock();
  }

if(pageId === "analyticsPage"){
  if(typeof showAnalyticsTab === "function"){
    showAnalyticsTab("weekly") // default tab
  }
}
// 🔥 ADD PRODUCT BUTTON CONTROL
const actions = document.getElementById("addProductActions")

if(actions){
  if(pageId === "addProductPage"){
    actions.style.display = "flex"
  } else {
    actions.style.display = "none"
  }
}
}
