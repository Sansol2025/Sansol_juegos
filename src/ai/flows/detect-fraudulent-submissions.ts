// src/ai/flows/detect-fraudulent-submissions.ts
'use server';

/**
 * @fileOverview Detección de fraude impulsada por IA para envíos de formularios de registro.
 *
 * Este archivo define un flujo de Genkit que analiza los envíos de los usuarios para identificar posibles indicadores de fraude,
 * como el uso de bots o información falsa, y verifica la existencia previa en la base de datos.
 */

import { ai, db } from '@/ai/genkit'; // Import db from genkit setup
import { z } from 'genkit';

const DetectFraudulentSubmissionInputSchema = z.object({
  fullName: z.string().describe('El nombre completo del usuario.'),
  phoneNumber: z.string().describe('El número de teléfono del usuario.'),
  consent: z.boolean().describe('Si el usuario ha aceptado los términos y condiciones.'),
});

export type DetectFraudulentSubmissionInput = z.infer<typeof DetectFraudulentSubmissionInputSchema>;

const DetectFraudulentSubmissionOutputSchema = z.object({
  isFraudulent: z.boolean().describe('Si el envío es probablemente fraudulento.'),
  fraudExplanation: z.string().describe('Explicación de por qué el envío se considera fraudulento.'),
});

export type DetectFraudulentSubmissionOutput = z.infer<typeof DetectFraudulentSubmissionOutputSchema>;

export async function detectFraudulentSubmission(
  input: DetectFraudulentSubmissionInput
): Promise<DetectFraudulentSubmissionOutput> {
  return detectFraudulentSubmissionFlow(input);
}

const detectFraudulentSubmissionPrompt = ai.definePrompt({
  name: 'detectFraudulentSubmissionPrompt',
  input: { schema: DetectFraudulentSubmissionInputSchema },
  output: { schema: DetectFraudulentSubmissionOutputSchema },
  prompt: `Eres un asistente de IA experto en detectar envíos fraudulentos a un juego promocional.
  Analiza el nombre completo, número de teléfono y consentimiento del usuario para identificar posibles fraudes.

  Considera los siguientes factores con cuidado:
  - **Patrones sospechosos en el nombre:** Busca cadenas de caracteres sin sentido (ej: "asdfghjkl"), nombres obviamente falsos o absurdos (ej: "Superman Batman"), o nombres que parezcan generados por un bot. **Importante: No consideres nombres cortos, comunes o que puedan parecer simples (como "vera juan", "ana gil", "pepe luis") como fraudulentos por sí solos, a menos que haya otros indicadores claros de fraude.** La combinación de nombre y apellido es común.
  - **Patrones sospechosos en el número de teléfono:** Números de teléfono que parezcan falsos, incompletos o con formatos imposibles.
  - **Falta de consentimiento:** Si el usuario no ha dado su consentimiento, esto es un indicador, pero evalúa también los otros campos.
  - **Combinación de factores:** Un solo factor podría no ser concluyente, pero múltiples indicadores débiles pueden sumar a una sospecha de fraude.

  Basándote en tu análisis, determina si el envío es probablemente fraudulento ('isFraudulent: true') o no ('isFraudulent: false').
  Proporciona una explicación concisa ('fraudExplanation') SOLO si consideras que el envío es fraudulento. Si no es fraudulento, la explicación puede ser breve indicando que es válido o simplemente no es necesaria.

  Ejemplos de envíos VÁLIDOS (isFraudulent: false):
  - Nombre: "Vera Juan", Teléfono: "+34123456789", Consentimiento: true -> Explicación: "Envío válido."
  - Nombre: "Ana López García", Teléfono: "+525512345678", Consentimiento: true -> Explicación: "Envío válido."

  Ejemplos de envíos FRAUDULENTOS (isFraudulent: true):
  - Nombre: "jkla sdfkj", Teléfono: "+19999999999", Consentimiento: true -> Explicación: "Nombre parece aleatorio y el número podría ser sospechoso."
  - Nombre: "Robot Test", Teléfono: "+12345123451", Consentimiento: false -> Explicación: "Nombre sugiere un bot y no hay consentimiento."

  Analiza la siguiente información:
  Nombre Completo: {{{fullName}}}
  Número de Teléfono: {{{phoneNumber}}}
  Consentimiento: {{{consent}}}
  `,
});

const detectFraudulentSubmissionFlow = ai.defineFlow(
  {
    name: 'detectFraudulentSubmissionFlow',
    inputSchema: DetectFraudulentSubmissionInputSchema,
    outputSchema: DetectFraudulentSubmissionOutputSchema,
  },
  async (input) => {
    // Paso 1: Verificar si el número de teléfono ya existe en la base de datos.
    const participantsRef = db.collection('participants');
    const snapshot = await participantsRef.where('phoneNumber', '==', input.phoneNumber).limit(1).get();

    if (!snapshot.empty) {
      // Si el snapshot no está vacío, significa que el número ya está registrado.
      return {
        isFraudulent: true,
        fraudExplanation: 'Este número de teléfono ya ha sido registrado.',
      };
    }

    // Paso 2: Si el número no existe, proceder con el análisis de IA.
    const { output } = await detectFraudulentSubmissionPrompt(input);
    return output!;
  }
);
