import "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js";
import "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js";

const firebaseConfig = {
    apiKey: "AIzaSyB0MOIXrgBOZOPD-ImligI8R5I9LcEP-e4",
    authDomain: "placement-prep-app.firebaseapp.com",
    projectId: "placement-prep-app",
    storageBucket: "placement-prep-app.firebasestorage.app",
    messagingSenderId: "43190903852",
    appId: "1:43190903852:web:94efe77f5da7a84b841d89"
};

let app, auth, db, provider;
const firebase = window.firebase;

if (!firebaseConfig.apiKey) {
    document.getElementById('main-content').innerHTML = `<div class="text-center p-8 bg-red-900 rounded-lg"><h2 class="text-2xl font-bold text-red-200">Firebase Not Configured!</h2><p class="mt-2 text-red-300">Please paste your Firebase config object in index.html to get started.</p></div>`;
}else {

// Initialize Firebase
app = firebase.initializeApp(firebaseConfig);
auth = firebase.auth();
provider = new firebase.auth.GoogleAuthProvider();
db = firebase.firestore();

// Connect to emulators in development
if (window.location.hostname === "localhost") {
    auth.useEmulator("http://localhost:9099");
    db.useEmulator("localhost", 8080);
    console.log("✅ Firebase emulators connected");
}

// Enable offline persistence with multi-tab support
db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('⚠️ Persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
            console.warn('⚠️ Persistence failed: Browser not supported');
        }
    });
}
export { auth, db, provider, app, firebase };