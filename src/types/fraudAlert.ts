// src/types/fraudAlert.ts
import type { Timestamp } from "firebase/firestore";

export interface FraudAlert {
  firestoreId?: string; // Firestore document ID
  fullName: string;
  phoneNumber: string;
  detectedAt: Timestamp;
  explanation: string;
  // Considerar añadir más detalles del envío si es necesario
  // participantData?: any; 
  isReviewed: boolean; // Para futura gestión de alertas
}
