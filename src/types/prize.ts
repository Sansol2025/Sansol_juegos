
// src/types/prize.ts
export interface Prize {
  id: string; // User-defined ID, e.g., "cafe"
  name: string;
  imageUrl?: string; // Optional URL for the prize image, will be Firebase Storage URL
  frequency: number; // Weight for prize selection probability, higher is more frequent
  stock: number; // Available stock for this prize
}

export interface PrizeWithFirestoreId extends Prize {
  firestoreId: string; // Firestore document ID
}

// Interface for what the prize wheel component will actually use for each segment
export interface WheelSegmentItem extends Prize {
  // Could add more segment-specific properties here if needed in the future
  // e.g. segmentColor, etc.
}

