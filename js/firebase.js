/* =========================================
   FIREBASE CONFIG
========================================= */

const firebaseConfig = {
  apiKey: "AIzaSyBzs6n66fLSWBhobX-GOnROx-QvR8eH9gU",
  authDomain: "baraka-pos-2.firebaseapp.com",
  projectId: "baraka-pos-2",
  storageBucket: "baraka-pos-2.appspot.com", // ✅ FIXED
  messagingSenderId: "3915833554",
  appId: "1:3915833554:web:36144e4699aaf4249e0d0b"
};

const storage = firebase.storage(firebase.app()) // ✅ FIXED
const storageRef = storage.ref() // ✅ ADDED

db.settings({
  experimentalAutoDetectLongPolling: true // ✅ FIXED
})

db.enablePersistence()
.catch((err) => {

if (err.code === "failed-precondition") {
console.warn("⚠ Multiple tabs open — persistence disabled")
}

if (err.code === "unimplemented") {
console.warn("⚠ Browser does not support persistence")
}

})
