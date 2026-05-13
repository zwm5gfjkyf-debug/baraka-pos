/* =========================================
   PAGE NAVIGATION
========================================= */

let currentPage = null

function hideSaleFlowPages(){
  ;['paymentPage', 'debtCustomerPage', 'successPage'].forEach(id => {
    const el = document.getElementById(id)
    if(el){
      el.classList.add('hidden')
      el.style.removeProperty('display')
    }
  })
}

function navigate(pageId){
  const previousPage = currentPage
  currentPage = pageId
  window.__barakaCurrentPage = pageId

  const loggedIn = typeof auth !== 'undefined' && auth.currentUser

  document.querySelectorAll('.page').forEach(p => {
    p.classList.add('hidden')
    p.style.removeProperty('display')
  })

  const page = document.getElementById(pageId)
  if(page){
    page.classList.remove('hidden')
  }

  const isSaleFlowPage =
    pageId === 'paymentPage' || pageId === 'debtCustomerPage' || pageId === 'successPage'
  if(!isSaleFlowPage){
    hideSaleFlowPages()
  }

  const camera = document.getElementById('cameraSection')
  if(camera){
    camera.style.display = pageId === 'stockPage' ? 'flex' : 'none'
  }

  if(typeof updateCamera === 'function'){
    updateCamera()
  }

  const appHeader = document.querySelector('.app-header')
  if(appHeader){
    appHeader.style.display = 'flex'
  }

  const mainContent = document.querySelector('.main-content')
  if(mainContent){
    mainContent.style.paddingTop = '80px'
    mainContent.style.paddingBottom = '70px'
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

  const bottomNav = document.querySelector('.bottom-nav')
  if(bottomNav){
    if(!loggedIn){
      bottomNav.style.display = 'none'
    }else if(pageId === 'addProductPage' || pageId === 'unitPage' || isSaleFlowPage){
      bottomNav.style.display = 'none'
    }else{
      bottomNav.style.display = 'flex'
    }
  }

  const centerHandle = document.getElementById('centerNavHandle')
  if(centerHandle){
    centerHandle.style.display = pageId === 'dashboardPage' ? 'flex' : 'none'
  }

  const fab = document.getElementById('floatingAddBtn')
  if(fab){
    if(!loggedIn){
      fab.style.display = 'none'
    }else{
      fab.style.display = (pageId === 'dashboardPage' || pageId === 'todaySalesHistoryPage') ? 'flex' : 'none'
    }
  }

  const navMap = {
    dashboardPage: 0,
    salePage: 1,
    stockPage: 2,
    tahlilHubPage: 3,
    dokonTahliliPage: 3,
    weeklyTahliliPage: 3,
    monthlyTahliliPage: 3,
    nasiyaTahliliPage: 3
  }

  const navButtons = document.querySelectorAll('.bottom-nav button')
  navButtons.forEach(btn => btn.classList.remove('active'))

  if(navMap[pageId] !== undefined){
    navButtons[navMap[pageId]]?.classList.add('active')
  }

  if(pageId === 'todaySalesHistoryPage' && navButtons.length > 0){
    navButtons[0].classList.add('active')
  }

  let sidebarRoute = pageId
  if(pageId === 'todaySalesHistoryPage'){
    sidebarRoute = 'dashboardPage'
  }else if(['tahlilHubPage', 'dokonTahliliPage', 'weeklyTahliliPage', 'monthlyTahliliPage', 'nasiyaTahliliPage'].includes(pageId)){
    sidebarRoute = 'tahlilHubPage'
  }

  if(typeof updateSidebarActive === 'function'){
    updateSidebarActive(sidebarRoute)
  }

  if(pageId === 'dashboardPage' && typeof loadDashboard === 'function'){
    loadDashboard()
  }

  if(pageId === 'todaySalesHistoryPage' && typeof loadTodaySalesHistory === 'function'){
    loadTodaySalesHistory()
  }

  if(pageId === 'salePage'){
    setTimeout(() => {
      if(typeof renderCart === 'function'){
        renderCart()
      }
      if(typeof updateSaleButtons === 'function'){
        updateSaleButtons()
      }
      if(typeof updatePaymentEmptyState === 'function'){
        updatePaymentEmptyState()
      }
    }, 100)
  }

  if(pageId === 'stockPage'){
    if(typeof loadCurrent === 'function'){
      if(typeof stockLoaded === 'undefined' || !stockLoaded){
        loadCurrent()
        stockLoaded = true
      }
    }
  }

  if(pageId === 'tahlilHubPage' && typeof loadTahlilHub === 'function'){
    loadTahlilHub()
  }

  if(pageId === 'dokonTahliliPage'){
    setTimeout(() => {
      if(typeof loadStoreAnalytics === 'function'){
        loadStoreAnalytics()
      }
    }, 150)
  }

  if(pageId === 'weeklyTahliliPage' && typeof loadWeeklyTahliliPage === 'function'){
    loadWeeklyTahliliPage()
  }

  if(pageId === 'monthlyTahliliPage' && typeof loadMonthlyTahliliPage === 'function'){
    loadMonthlyTahliliPage()
  }

  if(pageId === 'nasiyaTahliliPage' && typeof loadNasiyaTahliliPage === 'function'){
    loadNasiyaTahliliPage()
  }

  if(pageId === 'debtAnalyticsPage' && typeof loadDebtCustomers === 'function'){
    loadDebtCustomers()
  }

  const actions = document.getElementById('saleActions')
  if(actions){
    if(pageId === 'salePage'){
      actions.classList.remove('hidden')
      actions.classList.remove('split')
      actions.classList.add('center')
    }else{
      actions.classList.add('hidden')
    }
  }
}
