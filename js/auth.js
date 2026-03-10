
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

    if(e.code === "auth/email-already-in-use"){
      alert("Bu email allaqachon ro'yxatdan o'tgan")
    }

    else if(e.code === "auth/invalid-email"){
      alert("Email noto'g'ri")
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
}
