/* =========================================
   AUTH SYSTEM
========================================= */

auth.onAuthStateChanged(user => {

  const loading = document.getElementById("loadingScreen");

  if(loading) loading.classList.add("hidden");

  if(user){

    document.getElementById("authScreen").classList.add("hidden");

    document.getElementById("appScreen").classList.remove("hidden");

  const shopTitle = document.getElementById("shopTitle")

if(shopTitle){
    shopTitle.innerText = "BARAKA"
}

    loadDashboard();

  }else{

    document.getElementById("appScreen").classList.add("hidden");

    document.getElementById("authScreen").classList.remove("hidden");

  }

});

async function register(){

  const shopName = document.getElementById("shopName").value.trim();

  const email = document.getElementById("email").value.trim();

  const password = document.getElementById("password").value;

  if(!shopName || !email || !password){
    alert("Ma'lumotlarni to'ldiring");
    return;
  }

  const cred = await auth.createUserWithEmailAndPassword(email,password);

  await db.collection("shops")
  .doc(cred.user.uid)
  .set({
    shopName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

}

async function login(){

  const email = document.getElementById("email").value.trim();

  const password = document.getElementById("password").value;

  await auth.signInWithEmailAndPassword(email,password);

}

function logout(){
  auth.signOut();
}
