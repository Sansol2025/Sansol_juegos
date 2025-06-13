
// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined = undefined;
let db: Firestore | undefined = undefined;
let storage: FirebaseStorage | undefined = undefined;

if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.projectId ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.storageBucket || // Esencial para Storage
  !firebaseConfig.messagingSenderId ||
  !firebaseConfig.appId
) {
  console.warn( // Changed from console.error
    "Advertencia: Configuración de Firebase incompleta en .env. Verifica todas las variables NEXT_PUBLIC_FIREBASE_*. La funcionalidad de Firebase podría estar limitada."
  );
  if (!firebaseConfig.storageBucket) {
    console.warn( // Changed from console.error
        "Advertencia: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET es obligatorio y no está definido. Firebase Storage no funcionará."
    );
  }
} else {
  if (!getApps().length) {
    try {
      // console.log("Inicializando Firebase App con config:", firebaseConfig); // Kept for debugging if needed
      app = initializeApp(firebaseConfig);
    } catch (error) {
      console.error("Error Crítico: No se pudo inicializar Firebase App:", error);
      console.error("Verifica que las variables de entorno NEXT_PUBLIC_FIREBASE_* en tu archivo .env sean correctas y que el proyecto de Firebase exista y esté configurado.");
    }
  } else {
    app = getApps()[0];
  }

  if (app) {
    try {
      db = getFirestore(app);
      // console.log("Firestore inicializado correctamente."); // Kept for debugging if needed
    } catch (error) {
      console.error("Error Crítico: No se pudo inicializar Firestore:", error);
      db = undefined; // Asegurar que db sea undefined si falla
    }

    // Solo intentar inicializar storage si el bucket está definido y la app se inicializó
    if (firebaseConfig.storageBucket) { 
      try {
        storage = getStorage(app);
        // console.log("Firebase Storage inicializado correctamente."); // Kept for debugging if needed
      } catch (error) {
        console.error("Error Crítico: No se pudo inicializar Firebase Storage:", error);
        storage = undefined; // Asegurar que storage sea undefined si falla
      }
    } else {
      // Este caso ya se cubre arriba, pero por si acaso.
      console.warn( // Changed from console.error
        "Firebase Storage no se inicializará: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET no está definido en la configuración."
      );
      storage = undefined;
    }
  }
}

export { app, db, storage };
