/* =========================================
   FIREBASE CONFIG
========================================= */

const firebaseConfig = {
  apiKey: "AIzaSyBzs6n66fLSWBhobX-GOnROx-QvR8eH9gU",
  authDomain: "baraka-pos-2.firebaseapp.com",
  projectId: "baraka-pos-2",
  storageBucket: "baraka-pos-2.firebasestorage.app",
  messagingSenderId: "3915833554",
  appId: "1:3915833554:web:36144e4699aaf4249e0d0b"
};

if (!firebase.apps.length) {
firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage()
db.settings({
experimentalAutoDetectLongPolling: true,
merge: true
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
