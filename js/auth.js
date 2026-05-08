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
    if(bottomNav) bottomNav.style.display = ''
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

let usernameCheckTimeout = null
let usernameAvailable = false
let usernameChecked = false

function validateUsernameFormat(username){
  const regex = /^[a-zA-Z0-9_]{3,20}$/
  return regex.test(username)
}

function setRegisterButtonState(){
  const shopName = document.getElementById('shopName')?.value.trim() || ''
  const username = document.getElementById('registerUsername')?.value.trim() || ''
  const password = document.getElementById('registerPassword')?.value || ''
  const confirmPassword = document.getElementById('registerPasswordConfirm')?.value || ''
  const registerBtn = document.getElementById('registerBtn')

  const canRegister = shopName !== '' && username !== '' && usernameAvailable && password.length >= 6 && password === confirmPassword

  if(registerBtn){
    registerBtn.disabled = !canRegister
  }
}

function showUsernameHelp(message, isError){
  const help = document.getElementById('usernameHelp')
  if(help){
    help.textContent = message
    if(message === ''){
      help.classList.remove('auth-help-text-error', 'auth-help-text-success')
    } else {
      help.classList.toggle('auth-help-text-error', isError)
      help.classList.toggle('auth-help-text-success', !isError)
    }
  }
}

function showPasswordMatchHelp(message, isError){
  const help = document.getElementById('passwordMatchHelp')
  if(help){
    help.textContent = message
    if(message === ''){
      help.classList.remove('auth-help-text-error', 'auth-help-text-success')
    } else {
      help.classList.toggle('auth-help-text-error', isError)
      help.classList.toggle('auth-help-text-success', !isError)
    }
  }
}

async function checkUsernameAvailable(username){
  const usernameLower = username.toLowerCase()
  const usernameDoc = await db.collection('usernames').doc(usernameLower).get()
  return usernameDoc.exists ? false : true
}

function handleRegisterUsernameInput(){
  const input = document.getElementById('registerUsername')
  const username = input?.value.trim() || ''
  usernameAvailable = false
  usernameChecked = false
  setRegisterButtonState()

  if(username === ''){
    showUsernameHelp('', false)
    input?.classList.remove('invalid', 'valid')
    return
  }

  if(!validateUsernameFormat(username)){
    showUsernameHelp('❌ Faqat harf, raqam va _ ishlatish mumkin (3-20 belgi)', true)
    input?.classList.add('invalid')
    input?.classList.remove('valid')
    return
  }

  input?.classList.remove('invalid')
  input?.classList.add('valid')
  showUsernameHelp('Tekshirilmoqda…', false)

  if(usernameCheckTimeout){
    clearTimeout(usernameCheckTimeout)
  }

  usernameCheckTimeout = setTimeout(async () => {
    const available = await checkUsernameAvailable(username)
    usernameAvailable = available
    usernameChecked = true

    if(available){
      showUsernameHelp('✅ Bu nom mavjud!', false)
      input?.classList.add('valid')
      input?.classList.remove('invalid')
    } else {
      showUsernameHelp('❌ Bu foydalanuvchi nomi band. Boshqa nom tanlang.', true)
      input?.classList.add('invalid')
      input?.classList.remove('valid')
    }
    setRegisterButtonState()
  }, 500)
}

function handleRegisterPasswordInput(){
  const password = document.getElementById('registerPassword')?.value || ''
  const confirmPassword = document.getElementById('registerPasswordConfirm')?.value || ''
  const passwordInput = document.getElementById('registerPassword')
  const confirmInput = document.getElementById('registerPasswordConfirm')

  if(password.length > 0){
    passwordInput?.classList.toggle('invalid', password.length < 6)
    passwordInput?.classList.toggle('valid', password.length >= 6)
  } else {
    passwordInput?.classList.remove('invalid', 'valid')
  }

  if(confirmPassword.length > 0){
    if(password !== confirmPassword){
      showPasswordMatchHelp('❌ Parollar mos kelmadi', true)
      confirmInput?.classList.add('invalid')
      confirmInput?.classList.remove('valid')
    } else {
      showPasswordMatchHelp('✅ Parollar mos keldi', false)
      confirmInput?.classList.add('valid')
      confirmInput?.classList.remove('invalid')
    }
  } else {
    showPasswordMatchHelp('', false)
    confirmInput?.classList.remove('invalid', 'valid')
  }

  setRegisterButtonState()
}

function togglePasswordVisibility(inputId, buttonId){
  const input = document.getElementById(inputId)
  const button = document.getElementById(buttonId)

  if(!input || !button) return

  if(input.type === 'password'){
    input.type = 'text'
    button.textContent = '🙈'
  } else {
    input.type = 'password'
    button.textContent = '👁'
  }
}

async function hashPassword(password){
  if(!window.crypto || !window.crypto.subtle){
    return password
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function showButtonSpinner(buttonId, show){
  const spinner = document.getElementById(buttonId)
  if(spinner){
    spinner.classList.toggle('hidden', !show)
  }
}

/* =========================================
   AUTH STATE LISTENER
========================================= */

auth.onAuthStateChanged(async (user) => {

  const loading = document.getElementById("loadingScreen")
  const authScreen = document.getElementById("authScreen")
  const appScreen = document.getElementById("appScreen")

  if(user){

    currentShopId = user.uid

    if(loading) loading.classList.add("hidden")
    if(authScreen) authScreen.style.display = "none"
    if(appScreen) appScreen.classList.remove("hidden")

    updateNavVisibility(true)

    // Navigate to dashboard
    if(typeof navigate === "function"){
      navigate('dashboardPage')
    }

    // load inventory
    if(typeof loadCurrentStock === "function"){
      loadCurrentStock()
    }

  }else{

    if(loading) loading.classList.add("hidden")
    if(authScreen) authScreen.style.display = "flex"
    if(appScreen) appScreen.classList.add("hidden")

    updateNavVisibility(false)
  }

})

/* =========================================
   REGISTER
========================================= */

async function register(){
  const shopName = document.getElementById('shopName')?.value.trim() || ''
  const username = document.getElementById('registerUsername')?.value.trim() || ''
  const password = document.getElementById('registerPassword')?.value || ''
  const confirmPassword = document.getElementById('registerPasswordConfirm')?.value || ''
  const loginError = document.getElementById('loginErrorMessage')

  if(loginError) loginError.textContent = ''

  if(!shopName || !username || !password || !confirmPassword){
    showTopBanner("Ma'lumotlarni to'ldiring", "error")
    return
  }

  if(!validateUsernameFormat(username)){
    showTopBanner("Username formati noto‘g‘ri", "error")
    return
  }

  if(password.length < 6){
    showTopBanner("Parol kamida 6 ta belgi bo'lishi kerak", "error")
    return
  }

  if(password !== confirmPassword){
    showTopBanner("Parollar mos kelmadi", "error")
    return
  }

  if(!usernameAvailable || !usernameChecked){
    showTopBanner("Foydalanuvchi nomi mavjudligini tekshiring", "error")
    return
  }

  const registerBtn = document.getElementById('registerBtn')
  if(registerBtn) registerBtn.disabled = true
  showButtonSpinner('registerSpinner', true)

  const usernameLower = username.toLowerCase()
  const syntheticEmail = `${usernameLower}@baraka.local`

  try{
    const passwordHash = await hashPassword(password)

    const cred = await auth.createUserWithEmailAndPassword(syntheticEmail, password)
    const uid = cred.user.uid

    await db.collection('users').doc(uid).set({
      username: usernameLower,
      dokon_nomi: shopName,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      uid: uid,
      passwordHash: passwordHash
    })

    await db.collection('usernames').doc(usernameLower).set({
      uid: uid,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    })

    await db.collection('shops').doc(uid).set({
      shopName: shopName,
      ownerEmail: syntheticEmail,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      username: usernameLower
    })

    showTopBanner("Ro'yxatdan o'tish muvaffaqiyatli", "success")

  }catch(e){
    console.error(e)
    if(e.code === 'auth/email-already-in-use'){
      showTopBanner("Bu foydalanuvchi nomi allaqachon ishlatilgan", "error")
    } else if(e.code === 'auth/weak-password'){
      showTopBanner("Parol juda oddiy", "error")
    } else {
      showTopBanner("Ro'yxatdan o'tishda xatolik", "error")
    }
  } finally {
    showButtonSpinner('registerSpinner', false)
    if(registerBtn) registerBtn.disabled = false
  }
}

/* =========================================
   LOGIN
========================================= */

async function login(){
  const username = document.getElementById('loginUsername')?.value.trim() || ''
  const password = document.getElementById('loginPassword')?.value || ''
  const loginError = document.getElementById('loginErrorMessage')
  const loginBtn = document.getElementById('loginBtn')

  if(loginError) loginError.textContent = ''

  if(!username || !password){
    if(loginError) loginError.textContent = '❌ Foydalanuvchi nomi va parolni kiriting'
    return
  }

  const usernameLower = username.toLowerCase()
  const syntheticEmail = `${usernameLower}@baraka.local`

  if(loginBtn) loginBtn.disabled = true
  showButtonSpinner('loginSpinner', true)

  try{
    const userDoc = await db.collection('usernames').doc(usernameLower).get()
    if(!userDoc.exists){
      if(loginError) loginError.textContent = '❌ Bunday foydalanuvchi topilmadi'
      return
    }

    await auth.signInWithEmailAndPassword(syntheticEmail, password)
    showTopBanner('Xush kelibsiz!', 'success')
  }catch(e){
    console.error(e)
    if(loginError){
      if(e.code === 'auth/user-not-found'){
        loginError.textContent = '❌ Bunday foydalanuvchi topilmadi'
      } else if(e.code === 'auth/wrong-password'){
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
  if(authScreen) authScreen.style.display = "flex"
  if(typeof switchAuth === "function"){
    switchAuth("register")
  }

  updateNavVisibility(false)
}
