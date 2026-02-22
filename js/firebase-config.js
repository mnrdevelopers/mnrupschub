// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAmt-CJMiqZ4sTNAUWtrE2Wk0mia3PcTYI",
  authDomain: "upsc-prep-hub-f4b49.firebaseapp.com",
  projectId: "upsc-prep-hub-f4b49",
  storageBucket: "upsc-prep-hub-f4b49.firebasestorage.app",
  messagingSenderId: "179495122168",
  appId: "1:179495122168:web:39661e0d3a3057e3e0b70d",
  measurementId: "G-MGLSQR0D46"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize services and make them globally available
var db = firebase.firestore();
var auth = firebase.auth();
var storage = null;

// Only initialize storage if the SDK is loaded
if (typeof firebase.storage === 'function') {
    storage = firebase.storage();
}