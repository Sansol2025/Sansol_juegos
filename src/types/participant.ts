// src/types/participant.ts
import type { Timestamp } from "firebase/firestore";

export interface Participant {
  fullName: string;
  phoneNumber: string; // Usado como ID en Firestore para la colección 'participants'
  registeredAt: Timestamp;
  consentGiven: boolean;
  // Podríamos añadir más campos si es necesario, como:
  // lastPlayedAt?: Timestamp;
  // totalGamesPlayed?: number;
}

export interface ParticipantWithFirestoreId extends Participant {
  firestoreId: string; // El ID del documento, que en este caso es el phoneNumber.
}
