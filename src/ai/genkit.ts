import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import * as admin from 'firebase-admin';

// **MODIFICADO PARA PUBLICACIÓN**
// Ya no importamos el JSON directamente.
// En su lugar, inicializamos la app de Firebase Admin usando las credenciales
// que Google Cloud proporciona automáticamente en el entorno de producción (App Hosting).
// Para el desarrollo local, configuraremos una variable de entorno.

// Inicializar Firebase Admin SDK.
if (!admin.apps.length) {
  console.log("Inicializando Firebase Admin SDK...");
  // Esta función buscará automáticamente las credenciales en el entorno.
  // En App Hosting, las encontrará sin configuración extra.
  // En local, usará la variable de entorno 'GOOGLE_APPLICATION_CREDENTIALS'.
  admin.initializeApp();
}

// Exportamos la instancia de la base de datos para usarla en los flujos.
export const db = admin.firestore();

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});
