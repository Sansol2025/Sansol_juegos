// src/types/claimedPrize.ts
import type { Timestamp } from "firebase/firestore";

export interface ClaimedPrize {
  firestoreId?: string; // Firestore document ID
  qrCodeValue: string; // El valor completo del código QR escaneado
  prizeId: string; // ID del premio (ej. "auricular-bt")
  prizeName: string; // Nombre del premio (ej. "Auricular BT")
  participantIdentifier?: string; // Identificador del participante (ej. número de teléfono, si se incluye en el QR en el futuro)
  claimedAt: Timestamp; // Cuándo fue canjeado
  verifiedBy: string; // Username del verificador que lo canjeó
  verificationTimestamp: Timestamp; // Timestamp de la verificación (similar a claimedAt, puede ser redundante o usarse para auditoría)
}
