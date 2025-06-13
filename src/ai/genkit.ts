
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import * as admin from 'firebase-admin';

// Inicializar Firebase Admin SDK.
let dbInstance: admin.firestore.Firestore | null = null;

if (!admin.apps.length) {
  console.log("[Genkit] Intentando inicializar Firebase Admin SDK...");
  try {
    // Esta función buscará automáticamente las credenciales en el entorno.
    // En App Hosting, las encontrará sin configuración extra.
    // En local, usará la variable de entorno 'GOOGLE_APPLICATION_CREDENTIALS'.
    admin.initializeApp();
    dbInstance = admin.firestore();
    console.log("[Genkit] Firebase Admin SDK inicializado y Firestore instanciado correctamente.");
  } catch (error) {
    console.error("[Genkit] ERROR CRÍTICO: No se pudo inicializar Firebase Admin SDK o Firestore:", error);
    // Considerar lanzar el error aquí si la app no puede funcionar sin esto.
    // throw new Error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
  }
} else {
  console.log("[Genkit] Firebase Admin SDK ya estaba inicializado.");
  // Asegurarse de que dbInstance se asigne incluso si ya estaba inicializado.
  if (admin.apps[0]) {
    dbInstance = admin.firestore(admin.apps[0]!);
  } else {
     console.error("[Genkit] ERROR: Firebase Admin SDK reporta apps inicializadas, pero admin.apps[0] es undefined.");
  }
}

// Exportamos la instancia de la base de datos para usarla en los flujos.
export const db = dbInstance!; 

if (!dbInstance) {
    console.error("[Genkit] ADVERTENCIA CRÍTICA: db (Firestore Admin instance) no está disponible después del intento de inicialización. Los flujos de Genkit que usen Firestore fallarán.");
}

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});

// Verificación adicional para Genkit y Google AI
if (!process.env.GOOGLE_API_KEY && process.env.NODE_ENV !== 'production') {
  console.warn("[Genkit] ADVERTENCIA: La variable de entorno GOOGLE_API_KEY no está configurada. Las llamadas a Google AI (Genkit) podrían fallar si no se proporcionan credenciales de otra manera.");
} else if (!process.env.GOOGLE_API_KEY && process.env.NODE_ENV === 'production') {
   console.info("[Genkit] INFO: En producción, se espera que GOOGLE_API_KEY esté configurada en el entorno del servidor o que las credenciales de ADC (Application Default Credentials) estén disponibles para Genkit.");
}
