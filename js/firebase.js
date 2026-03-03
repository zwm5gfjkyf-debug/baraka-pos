const firebaseConfig = {
  apiKey: "AIzaSyBzs6n66fLSWBhobX-GOnROx-QvR8eH9gU",
  authDomain: "baraka-pos-2.firebaseapp.com",
  projectId: "baraka-pos-2",
  storageBucket: "baraka-pos-2.firebasestorage.app",
  messagingSenderId: "3915833554",
  appId: "1:3915833554:web:36144e4699aaf4249e0d0b",
  measurementId: "G-0MQEE5DWLK"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
