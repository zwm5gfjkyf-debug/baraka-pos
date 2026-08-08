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

function hideAllPagesExcept(activePageId){
  document.querySelectorAll('.page').forEach(p => {
    const isActive = !!activePageId && p.id === activePageId
    p.classList.toggle('hidden', !isActive)
    // Clear any leftover inline display from overlay flows (e.g. paymentPage)
    p.style.removeProperty('display')
    p.style.removeProperty('visibility')
    p.style.removeProperty('pointer-events')
  })
}

function navigate(pageId){
  const previousPage = currentPage
  currentPage = pageId
  window.__barakaCurrentPage = pageId

  const loggedIn = typeof auth !== 'undefined' && auth.currentUser

  const page = document.getElementById(pageId)
  hideAllPagesExcept(page ? pageId : null)
  if(page && !page.classList.contains('page')){
    // Safety: targets without .page still get shown explicitly
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
    // Keep top offset for fixed header; bottom clearance comes from CSS --bottom-content-pad
    mainContent.style.paddingTop = '80px'
    mainContent.style.removeProperty('padding-bottom')
  }

  if(previousPage === 'todaySalesHistoryPage' && pageId !== 'todaySalesHistoryPage' && pageId !== 'saleDetailPage' && typeof cleanupTodaySalesHistoryListeners === 'function'){
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

  if(previousPage === 'dashboardPage' && pageId !== 'dashboardPage' && pageId !== 'todaySalesHistoryPage' && pageId !== 'saleDetailPage' && typeof cleanupDashboardListeners === 'function'){
    cleanupDashboardListeners()
  }

  if(previousPage === 'buyurtmaPage' && pageId !== 'buyurtmaPage' && pageId !== 'addProductPage' && pageId !== 'unitPage' && typeof cleanupBuyurtmaPage === 'function'){
    cleanupBuyurtmaPage()
  }

  if(previousPage === 'buyurtmalarPage' && pageId !== 'buyurtmalarPage' && typeof cleanupBuyurtmalarPage === 'function'){
    cleanupBuyurtmalarPage()
  }

  const bottomNav = document.querySelector('.bottom-nav')
  if(bottomNav){
    if(!loggedIn){
      bottomNav.style.display = 'none'
    }else if(pageId === 'addProductPage' || pageId === 'unitPage' || pageId === 'buyurtmaPage' || pageId === 'buyurtmalarPage' || pageId === 'saleDetailPage' || isSaleFlowPage){
      bottomNav.style.display = 'none'
    }else{
      bottomNav.style.display = 'flex'
      bottomNav.style.visibility = 'visible'
      bottomNav.style.opacity = '1'
    }
  }

  const centerHandle = document.getElementById('centerNavHandle')
  if(centerHandle){
    centerHandle.style.display = pageId === 'dashboardPage' ? 'flex' : 'none'
  }

  const navMap = {
    dashboardPage: 0,
    salePage: 1,
    stockPage: 2,
    buyurtmaPage: 2,
    buyurtmalarPage: 2,
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

  if((pageId === 'todaySalesHistoryPage' || pageId === 'saleDetailPage') && navButtons.length > 0){
    navButtons[0].classList.add('active')
  }

  if(pageId === 'saleDetailPage'){
    const main = document.querySelector('.main-content')
    if(main) main.style.paddingTop = '80px'
  }

  let sidebarRoute = pageId
  if(pageId === 'todaySalesHistoryPage' || pageId === 'saleDetailPage'){
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

  if(pageId === 'buyurtmaPage'){
    // Draft is opened by startNewBuyurtma / finishAddProductForOrder
    const mainContent = document.querySelector('.main-content')
    if(mainContent){
      mainContent.style.paddingTop = '80px'
    }
  }

  if(pageId === 'buyurtmalarPage'){
    const mainContent = document.querySelector('.main-content')
    if(mainContent){
      mainContent.style.paddingTop = '80px'
    }
    if(typeof loadBuyurtmalarList === 'function'){
      loadBuyurtmalarList()
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
