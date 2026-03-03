const loadingScreen = document.getElementById("loadingScreen");
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");

auth.onAuthStateChanged(async user => {

  loadingScreen.classList.add("hidden");

  if(user){

    // Hide auth screen
    authScreen.classList.add("hidden");

    // Show app
    appScreen.classList.remove("hidden");

    document.getElementById("shopTitle").innerText = user.email;

  } else {

    // Hide app
    appScreen.classList.add("hidden");

    // Show auth
    authScreen.classList.remove("hidden");

  }

});
async function register(){

  const shopName = document.getElementById("shopName").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const cred = await auth.createUserWithEmailAndPassword(email,password);

  await db.collection("shops").doc(cred.user.uid).set({
    shopName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

}

async function login(){
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  await auth.signInWithEmailAndPassword(email,password);
}

function logout(){
  auth.signOut();
}

function navigate(pageId){

  document.querySelectorAll(".page").forEach(p=>{
    p.classList.add("hidden");
  });

  document.getElementById(pageId).classList.remove("hidden");
}
