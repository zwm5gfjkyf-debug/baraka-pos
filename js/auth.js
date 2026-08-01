/* =========================================
   NAVIGATION VISIBILITY HELPERS
========================================= */

function updateNavVisibility(isLoggedIn){
  const body = document.body
  const bottomNav = document.querySelector('.bottom-nav')
  const fab = document.getElementById('floatingAddBtn')
  const appHeader = document.querySelector('.app-header')
  const sidebar = document.getElementById('sidebar')
  const sidebarOverlay = document.getElementById('sidebarOverlay')

  if(isLoggedIn){
    body.classList.remove('auth-active')
    if(bottomNav) {
      bottomNav.style.display = 'flex'
      bottomNav.style.visibility = 'visible'
      bottomNav.style.removeProperty('opacity')
    }
    if(fab) fab.style.display = ''
    if(appHeader) appHeader.style.display = ''
    if(sidebar) sidebar.style.display = ''
    if(sidebarOverlay) sidebarOverlay.style.display = ''
  } else {
    body.classList.add('auth-active')
    if(bottomNav) bottomNav.style.display = 'none'
    if(fab) fab.style.display = 'none'
    if(appHeader) appHeader.style.display = 'none'
    if(sidebar) sidebar.style.display = 'none'
    if(sidebarOverlay) sidebarOverlay.style.display = 'none'
  }
}

function normalizeUsername(value){
  return String(value || '').trim().toLowerCase()
}

function clearAuthInputs(){
  ;['loginUsername', 'loginPassword'].forEach(id => {
    const input = document.getElementById(id)
    if(input){
      input.value = ''
      input.classList.remove('invalid', 'valid')
      if(input.type === 'text' && id.toLowerCase().includes('password')){
        input.type = 'password'
      }
    }
  })

  const loginError = document.getElementById('loginErrorMessage')
  if(loginError) loginError.textContent = ''

  const btn = document.getElementById('loginPasswordToggle')
  if(btn){
    btn.textContent = '👁'
    btn.setAttribute('aria-label', 'Parolni ko‘rsatish')
  }
}

function togglePasswordVisibility(inputId, buttonId){
  if(window.event && typeof window.event.preventDefault === 'function'){
    window.event.preventDefault()
  }

  const input = document.getElementById(inputId)
  const button = document.getElementById(buttonId)

  if(!input || !button) return

  if(input.type === 'password'){
    input.type = 'text'
    button.textContent = '🙈'
    button.setAttribute('aria-label', 'Parolni yashirish')
  } else {
    input.type = 'password'
    button.textContent = '👁'
    button.setAttribute('aria-label', 'Parolni ko‘rsatish')
  }

  input.focus()
}

function formatAuthDisplayEmail(user){
  if(!user) return "Foydalanuvchi"
  const email = user.email || ''
  if(!email) return "Foydalanuvchi"
  if(email.endsWith('@baraka.local')){
    const local = email.split('@')[0]
    return local || "Foydalanuvchi"
  }
  return email
}

document.addEventListener('DOMContentLoaded', () => {
  clearAuthInputs()
  setTimeout(() => clearAuthInputs(), 250)
})

async function showButtonSpinner(buttonId, show){
  const spinner = document.getElementById(buttonId)
  if(spinner){
    spinner.classList.toggle('hidden', !show)
  }
}

/* =========================================
   AUTH STATE LISTENER
========================================= */

auth.onAuthStateChanged(user => {

  const loading = document.getElementById("loadingScreen")
  const authScreen = document.getElementById("authScreen")
  const appScreen = document.getElementById("appScreen")

  document.body.classList.toggle("auth-active", !user)

  if(user){

    currentShopId = user.uid
    window.currentShopId = user.uid

    if(loading) loading.classList.add("hidden")
    if(authScreen){
      authScreen.classList.add("hidden")
      authScreen.style.display = 'none'
    }
    if(appScreen) {
      appScreen.classList.remove("hidden")
      appScreen.style.removeProperty('display')
    }

    updateNavVisibility(true)

    const profileEmailBox = document.getElementById("profileEmail")
    const sidebarEmailBox = document.getElementById("sidebarShopEmail")
    if(profileEmailBox && typeof formatAuthDisplayEmail === "function"){
      profileEmailBox.textContent = formatAuthDisplayEmail(user)
    }
    if(sidebarEmailBox && typeof formatAuthDisplayEmail === "function"){
      sidebarEmailBox.textContent = formatAuthDisplayEmail(user)
    }

    if(typeof bootstrapShopAfterAuth === "function"){
      bootstrapShopAfterAuth(user)
    }

    if(typeof navigate === "function"){
      navigate("dashboardPage")
    }

  }else{

    if(loading) loading.classList.add("hidden")
    if(authScreen) {
      authScreen.classList.remove("hidden")
      authScreen.style.removeProperty('display')
    }
    if(appScreen) {
      appScreen.classList.add("hidden")
      appScreen.style.display = 'none'
    }

    if(typeof clearAuthInputs === "function"){
      clearAuthInputs()
      setTimeout(() => clearAuthInputs(), 250)
    }

    updateNavVisibility(false)
  }

})

/* =========================================
   LOGIN (Auth-first — no pre-login Firestore reads)
========================================= */

async function login(){
  const username = normalizeUsername(document.getElementById('loginUsername')?.value || '')
  const password = document.getElementById('loginPassword')?.value || ''
  const loginError = document.getElementById('loginErrorMessage')
  const loginBtn = document.getElementById('loginBtn')

  if(loginError) loginError.textContent = ''

  if(!username || !password){
    if(loginError) loginError.textContent = '❌ Foydalanuvchi nomi va parolni kiriting'
    return
  }

  const syntheticEmail = `${username}@baraka.local`

  if(loginBtn) loginBtn.disabled = true
  showButtonSpinner('loginSpinner', true)

  try{
    await auth.signInWithEmailAndPassword(syntheticEmail, password)
    showTopBanner('Xush kelibsiz!', 'success')
  }catch(e){
    console.error(e)
    if(loginError){
      if(e.code === 'auth/user-not-found'){
        loginError.textContent = '❌ Bunday foydalanuvchi topilmadi'
      } else if(e.code === 'auth/wrong-password' || e.code === 'auth/invalid-login-credentials' || e.code === 'auth/invalid-credential'){
        loginError.textContent = "❌ Parol noto'g'ri"
      } else {
        loginError.textContent = '❌ Kirishda xatolik yuz berdi'
      }
    }
  } finally {
    showButtonSpinner('loginSpinner', false)
    if(loginBtn) loginBtn.disabled = false
  }
}

/* =========================================
   LOGOUT
========================================= */

function logout(){

  auth.signOut()

  if(typeof cleanupSidebarListeners === 'function'){
    cleanupSidebarListeners()
  }

  if(typeof cleanupDashboardListeners === 'function'){
    cleanupDashboardListeners()
  }

  if(typeof cleanupTodaySalesHistoryListeners === 'function'){
    cleanupTodaySalesHistoryListeners()
  }

  if(typeof cleanupTahlilHubListeners === 'function'){
    cleanupTahlilHubListeners()
  }

  if(typeof cleanupWeeklyTahliliListeners === 'function'){
    cleanupWeeklyTahliliListeners()
  }

  if(typeof cleanupMonthlyTahliliListeners === 'function'){
    cleanupMonthlyTahliliListeners()
  }

  if(typeof cleanupNasiyaTahliliListeners === 'function'){
    cleanupNasiyaTahliliListeners()
  }

  if(typeof cleanupStoreAnalyticsListener === 'function'){
    cleanupStoreAnalyticsListener()
  }

  showTopBanner("Tizimdan chiqdingiz", "success")
   
  const appScreen = document.getElementById("appScreen")
  const authScreen = document.getElementById("authScreen")

  if(appScreen) appScreen.classList.add("hidden")
  if(authScreen) authScreen.classList.remove("hidden")
  document.body.classList.add("auth-active")

  updateNavVisibility(false)
}
