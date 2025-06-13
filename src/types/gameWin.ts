// src/types/gameWin.ts
import type { Timestamp } from "firebase/firestore";

export interface GameWin {
  firestoreId?: string; // Firestore document ID
  participantFullName: string;
  participantPhoneNumber: string;
  prizeId: string;
  prizeName: string;
  prizeImageUrl?: string | null;
  qrCodeValue: string; // El valor completo del código QR generado
  wonAt: Timestamp; // Cuándo se ganó el premio (generación del QR)
  validUntil: Timestamp; // Hasta cuándo es válido el QR
  status: "won" | "claimed" | "expired_unclaimed"; // Estado del premio
  claimedAt?: Timestamp; // Cuándo fue realmente canjeado
  verifiedBy?: string; // Quién lo verificó/canjeó
}

// Para cuando escribimos un nuevo GameWin, no necesitamos firestoreId
export interface GameWinWrite extends Omit<GameWin, 'firestoreId'> {}
