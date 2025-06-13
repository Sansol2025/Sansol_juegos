
// src/types/verifier.ts
export interface Verifier {
  firestoreId?: string; // Firestore document ID, opcional porque no se usa al crear
  username: string;
  password?: string; // Almacenado en texto plano para prototipo - ¡NO SEGURO PARA PRODUCCIÓN!
  createdAt: Date;
}
