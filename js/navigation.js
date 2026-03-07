/* =========================================
   PAGE NAVIGATION
========================================= */

function navigate(pageId){

  document.querySelectorAll(".page")
  .forEach(p => p.classList.add("hidden"));

  const page = document.getElementById(pageId);

  if(page){
    page.classList.remove("hidden");
  }

  document.querySelectorAll(".bottom-nav button")
  .forEach(btn => btn.classList.remove("active"));

  document.querySelectorAll(".bottom-nav button")
  .forEach(btn=>{
    if(btn.getAttribute("onclick")?.includes(pageId)){
      btn.classList.add("active");
    }
  });

  if(pageId === "dashboardPage") loadDashboard();

  if(pageId === "salePage") loadProducts();

  if(pageId === "debtPage") loadDebtCustomers();

  if(pageId === "stockPage") loadCurrentStock();

if(pageId === "analyticsPage"){
loadWeeklyAnalytics()
loadMonthlyAnalytics()
}
}
