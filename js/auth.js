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

  const shopName = document.getElementById("shopName").value.trim()
  const email = document.getElementById("email").value.trim()
  const password = document.getElementById("password").value

  if(!shopName || !email || !password){
    alert("Ma'lumotlarni to'ldiring")
    return
  }

  if(password.length < 6){
    alert("Parol kamida 6 ta belgi bo'lishi kerak")
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

    alert("Ro'yxatdan o'tish muvaffaqiyatli")

  }catch(e){

    console.error(e)

    if(e.code === "auth/email-already-in-use"){
      alert("Bu email allaqachon ro'yxatdan o'tgan")
    }

    else if(e.code === "auth/invalid-email"){
      alert("Email noto'g'ri")
    }

    else if(e.code === "auth/weak-password"){
      alert("Parol juda oddiy")
    }

    else{
      alert("Ro'yxatdan o'tishda xatolik")
    }

  }

}

/* =========================================
   LOGIN
========================================= */

async function login(){

  const email = document.getElementById("email").value.trim()
  const password = document.getElementById("password").value

  if(!email || !password){
    alert("Email va parolni kiriting")
    return
  }

  try{

    await auth.signInWithEmailAndPassword(email,password)

  }catch(e){

    console.error(e)

    if(e.code === "auth/user-not-found"){
      alert("Bunday akkaunt mavjud emas")
    }

    else if(e.code === "auth/wrong-password"){
      alert("Parol noto'g'ri")
    }

    else if(e.code === "auth/invalid-email"){
      alert("Email noto'g'ri")
    }

    else{
      alert("Kirishda xatolik")
    }

  }

}

/* =========================================
   LOGOUT
========================================= */

function logout(){

  auth.signOut()

  const appScreen = document.getElementById("appScreen")
  const authScreen = document.getElementById("authScreen")

  if(appScreen) appScreen.classList.add("hidden")
  if(authScreen) authScreen.style.display = "flex"

}
