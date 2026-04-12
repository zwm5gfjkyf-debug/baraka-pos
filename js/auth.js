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

  }

})

/* =========================================
   REGISTER
========================================= */

async function register(){

  const shopName = document.getElementById("shopName")?.value.trim() || ""
  const email = document.getElementById("email")?.value.trim() || ""
  const password = document.getElementById("password")?.value || ""

  if(!shopName || !email || !password){
    showTopBanner("Ma'lumotlarni to'ldiring", "error")
    return
  }

  if(password.length < 6){
    showTopBanner("Parol kamida 6 ta belgi bo'lishi kerak", "error")
    return
  }

  try{

    const cred = await auth.createUserWithEmailAndPassword(email,password)

    await db.collection("shops")
    .doc(cred.user.uid)
    .set({
      shopName: shopName,
      ownerEmail: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })

    showTopBanner("Ro'yxatdan o'tish muvaffaqiyatli", "success")

  }catch(e){

    console.error(e)

    if(e.code === "auth/email-already-in-use"){
      showTopBanner("Bu email allaqachon ro'yxatdan o'tgan", "error")
    }

    else if(e.code === "auth/invalid-email"){
      showTopBanner("Email noto'g'ri", "error")
    }

    else if(e.code === "auth/weak-password"){
      showTopBanner("Parol juda oddiy", "error")
    }

    else{
      showTopBanner("Ro'yxatdan o'tishda xatolik", "error")
    }

  }

}

/* =========================================
   LOGIN
========================================= */

async function login(){

const email = document.getElementById("emailLogin")?.value.trim() || ""
const password = document.getElementById("passwordLogin")?.value || ""

  if(!email || !password){
    showTopBanner("Email va parolni kiriting", "error")
    return
  }

  try{

    await auth.signInWithEmailAndPassword(email,password)

    showTopBanner("Xush kelibsiz!", "success")

  }catch(e){

    console.error(e)

    if(e.code === "auth/user-not-found"){
      showTopBanner("Bunday akkaunt mavjud emas", "error")
    }

    else if(e.code === "auth/wrong-password"){
      showTopBanner("Parol noto'g'ri", "error")
    }

    else if(e.code === "auth/invalid-email"){
      showTopBanner("Email noto'g'ri", "error")
    }

    else{
      showTopBanner("Kirishda xatolik", "error")
    }

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

  showTopBanner("Tizimdan chiqdingiz", "success")
   
  const appScreen = document.getElementById("appScreen")
  const authScreen = document.getElementById("authScreen")

  if(appScreen) appScreen.classList.add("hidden")
  if(authScreen) authScreen.style.display = "flex"
if(typeof switchAuth === "function"){
  switchAuth("register")
}
}
