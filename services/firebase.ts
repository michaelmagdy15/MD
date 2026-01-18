import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCK7b_WlKXv4Kkh6V90UeL9lHjTeKehSwY",
  authDomain: "michael-and-douris-world.firebaseapp.com",
  projectId: "michael-and-douris-world",
  storageBucket: "michael-and-douris-world.firebasestorage.app",
  messagingSenderId: "769522697028",
  appId: "1:769522697028:web:46dd6f8defa961cd228d11",
  measurementId: "G-LDPD7FXQ8Z"
};

let app: firebase.app.App;
let auth: firebase.auth.Auth;
let db: firebase.firestore.Firestore;

if (!firebase.apps.length) {
  app = firebase.initializeApp(firebaseConfig);
} else {
  app = firebase.app(); // if already initialized
}

auth = firebase.auth();
db = firebase.firestore();

export const APP_ID_KEY = 'md-world-public';

export { firebase, auth, db };