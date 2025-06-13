
'use server';
/**
 * @fileOverview Initializes the Genkit AI and Firebase Admin SDK.
 *
 * Exports:
 * - ai: The Genkit AI instance.
 * - db: The Firebase Admin Firestore instance (conditionally).
 */

import {genkit, Ai} from 'genkit';
import {googleAI} from 'genkit/googleai';
import {firebase} from 'genkit/firebase';
import admin, {ServiceAccount} from 'firebase-admin';
import type {Firestore} from 'firebase-admin/firestore';

import serviceAccountKey from '../../serviceAccountKey.json';

let db: Firestore | undefined = undefined;

const serviceAccount = serviceAccountKey as ServiceAccount;

try {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // projectId and storageBucket are not strictly needed here if you only use Firestore Admin
      // but good to have if you expand Admin SDK usage.
      // projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      // storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    
  }
  db = admin.firestore();
  
} catch (e: any) {
  console.error(
    '[Genkit] ERROR CRÍTICO: No se pudo inicializar Firebase Admin SDK o Firestore:',
    e.message,
    e.stack
  );
  db = undefined; // Ensure db is undefined if initialization fails
}

if (!db) {
  console.warn(
    '[Genkit] ADVERTENCIA CRÍTICA: db (Firestore Admin instance) no está disponible. ' +
      'Los flujos de Genkit que dependan de Firestore Admin fallarán. ' +
      'Revisa los logs de inicialización de Firebase Admin.'
  );
}

// Initialize Genkit AI instance
let ai: Ai;
if (process.env.GOOGLE_API_KEY) {
  ai = genkit({
    plugins: [
      googleAI({
        apiKey: process.env.GOOGLE_API_KEY,
      }),
      firebase(), // For Firebase-specific Genkit functionalities if needed later
    ],
    // Do not set logLevel: 'debug' in production environments
    // logLevel: 'debug',
    enableTracingAndMetrics: true, // Recommended for production monitoring
  });
} else {
  console.warn(
    '[Genkit] ADVERTENCIA: La variable de entorno GOOGLE_API_KEY no está configurada. ' +
      'Genkit se inicializará sin el plugin googleAI, lo que limitará su funcionalidad de IA. ' +
      'Asegúrate de que GOOGLE_API_KEY esté definida en tu entorno de servidor.'
  );
  ai = genkit({
    plugins: [
      firebase(), // Initialize with Firebase plugin even if Google AI is not available
    ],
    enableTracingAndMetrics: true,
  });
}

export {ai, db};
