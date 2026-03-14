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
  }
// CAMERA BUTTON CONTROL
const cameraBtn = document.getElementById("cameraSaleButton")

if(cameraBtn){
  if(pageId === "salePage"){
    cameraBtn.style.display = "block"
  }else{
    cameraBtn.style.display = "none"
  }
}
  const navButtons = document.querySelectorAll(".bottom-nav button");

  navButtons.forEach(btn => btn.classList.remove("active"));

  navButtons.forEach(btn=>{
    if(btn.getAttribute("onclick")?.includes(pageId)){
      btn.classList.add("active");
    }
  });

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

    if(typeof loadWeeklyAnalytics === "function") loadWeeklyAnalytics();

    if(typeof loadMonthlyAnalytics === "function") loadMonthlyAnalytics();

    if(typeof loadTopProducts === "function") loadTopProducts();

  }

}
