// ================================
// 🔥 Firebase Imports (MODULAR)
// ================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ================================
// 🔥 Firebase Config
// ================================

const firebaseConfig = {
  apiKey: "AIzaSyAu20D1INj1eL7n9dZmUx6NwwOZAKhT-A",
  authDomain: "baraka-pos-d0964.firebaseapp.com",
  projectId: "baraka-pos-d0964",
  storageBucket: "baraka-pos-d0964.appspot.com",
  messagingSenderId: "12043762678",
  appId: "1:12043762678:web:859a6e1fca0296d9fe25d7"
};


// ================================
// 🚀 Initialize Firebase
// ================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// ================================
// 📝 REGISTER FUNCTION
// ================================

window.register = async function () {
  const shopName = document.getElementById("shopNameInput").value;
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  if (!shopName || !email || !password) {
    alert("Barcha maydonlarni to‘ldiring.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "shops", user.uid), {
      shopName: shopName,
      email: email,
      createdAt: new Date()
    });

    alert("Ro‘yxatdan o‘tildi!");
    location.reload();

  } catch (error) {
    alert(error.message);
  }
};


// ================================
// 🔐 LOGIN FUNCTION
// ================================

window.login = async function () {
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Kirish muvaffaqiyatli!");
    location.reload();
  } catch (error) {
    alert(error.message);
  }
};


// ================================
// 👀 AUTH STATE CHECK
// ================================

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const docRef = doc(db, "shops", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const shopData = docSnap.data();
      console.log("Shop:", shopData.shopName);
    }
  }
});


// ================================
// 🚪 LOGOUT
// ================================

window.logout = async function () {
  await signOut(auth);
  location.reload();
};
