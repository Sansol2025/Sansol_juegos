// src/app/api/detect-fraud/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; // Usar la inicialización de cliente de Firebase
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verificar si el número de teléfono ya existe en la base de datos.
    // Esto se ejecuta en el servidor y utiliza la configuración de Firebase Admin.
    const participantsRef = collection(db, 'participants');
    const q = query(participantsRef, where('phoneNumber', '==', phoneNumber), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Si el snapshot no está vacío, significa que el número ya está registrado.
      // Lo marcamos como "fraudulento" para seguir la lógica del cliente,
      // que espera esta respuesta para detener el registro duplicado.
      return NextResponse.json({
        isFraudulent: true,
        fraudExplanation: 'Este número de teléfono ya ha sido registrado.',
      });
    }

    // Si el número no existe, el envío es válido.
    return NextResponse.json({
      isFraudulent: false,
      fraudExplanation: 'Envío válido.',
    });

  } catch (error) {
    console.error('--- Error in /api/detect-fraud endpoint ---');
    let errorDetailsForClient = 'An internal error occurred while checking for duplicates.';

    if (error instanceof Error) {
      console.error('Error Name:', error.name);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      errorDetailsForClient = error.message; 
    } else {
      console.error('Non-Error object thrown:', error);
    }
    
    return NextResponse.json({ 
      error: 'Fraud detection service encountered an issue.', 
      details: errorDetailsForClient 
    }, { status: 500 });
  }
}
