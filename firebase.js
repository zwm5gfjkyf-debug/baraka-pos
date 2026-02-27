// ===============================
// 🔥 Firebase Config
// ===============================

const firebaseConfig = {
  apiKey: "AIzaSyAu20D0I1Niel7n9dZmUx6Nw0ZAKhT-A",
  authDomain: "baraka-pos-d0964.firebaseapp.com",
  projectId: "baraka-pos-d0964",
  storageBucket: "baraka-pos-d0964.firebasestorage.app",
  messagingSenderId: "12043762678",
  appId: "1:12043762678:web:859a6e1fca0296d9fe25d7",
  measurementId: "G-V7GR4DJK2M"
};

// ===============================
// 🚀 Initialize Firebase
// ===============================

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ===============================
// 🔐 Auth & Firestore
// ===============================

const auth = firebase.auth();
const db = firebase.firestore();
