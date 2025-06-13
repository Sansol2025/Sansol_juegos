
// src/components/features/registration-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { detectFraudulentSubmission, type DetectFraudulentSubmissionInput } from "@/ai/flows/detect-fraudulent-submissions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, Phone, CheckSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp, collection, addDoc } from "firebase/firestore";
import type { FraudAlert } from "@/types/fraudAlert";

const registrationSchema = z.object({
  fullName: z.string().min(2, { message: "El nombre completo debe tener al menos 2 caracteres." }).max(100),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{7,14}$/, { message: "Por favor, ingresa un número de teléfono válido (ej., +1234567890)." }),
  consent: z.boolean().refine(value => value === true, { message: "Debes aceptar los términos y condiciones para continuar." }),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

export default function RegistrationForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const isFirestoreAvailable = !!db;

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      fullName: "",
      phoneNumber: "",
      consent: false,
    },
  });

  async function onSubmit(data: RegistrationFormValues) {
    setIsLoading(true);
    if (!isFirestoreAvailable) {
      toast({
        variant: "destructive",
        title: "Error de Configuración",
        description: "La base de datos no está disponible. Por favor, contacta al administrador.",
      });
      setIsLoading(false);
      return;
    }

    try {
      const participantRef = doc(db, "participants", data.phoneNumber);
      const participantSnap = await getDoc(participantRef);

      if (participantSnap.exists()) {
        toast({
          variant: "default",
          title: "Ya estás Registrado",
          description: "Este número de teléfono ya ha sido utilizado para participar. ¡Solo se permite una participación por número!",
          className: "bg-blue-100 border-blue-300 text-blue-700",
        });
        if (typeof window !== 'undefined') {
            localStorage.setItem('participantFullName', participantSnap.data()?.fullName || data.fullName);
            localStorage.setItem('participantPhoneNumber', data.phoneNumber);
        }
        setIsLoading(false);
        router.push('/play');
        return;
      }

      const aiInput: DetectFraudulentSubmissionInput = {
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        consent: data.consent,
      };
      
      const fraudCheckResult = await detectFraudulentSubmission(aiInput);

      if (fraudCheckResult.isFraudulent) {
        toast({
          variant: "destructive",
          title: "Registro Bloqueado",
          description: fraudCheckResult.fraudExplanation || "Tu envío ha sido marcado como potencialmente fraudulento.",
        });
        
        try {
          const fraudAlertData: Omit<FraudAlert, 'firestoreId'> = {
            fullName: data.fullName,
            phoneNumber: data.phoneNumber,
            detectedAt: Timestamp.now(),
            explanation: fraudCheckResult.fraudExplanation || "Detección de fraude genérica.",
            isReviewed: false,
          };
          await addDoc(collection(db, "fraudAlerts"), fraudAlertData);
        } catch (fraudSaveError: any) {
          console.error("Error al guardar la alerta de fraude:", fraudSaveError);
           if (fraudSaveError.code === 'permission-denied') {
            console.error("Firestore Permission Denied: Check security rules for 'fraudAlerts' collection write access (addDoc).");
          }
        }
        
        setIsLoading(false);
        return;
      }

      await setDoc(participantRef, {
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        registeredAt: Timestamp.now(),
        consentGiven: data.consent,
      });
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('participantFullName', data.fullName);
        localStorage.setItem('participantPhoneNumber', data.phoneNumber);
      }

      toast({
        title: "¡Registro Exitoso!",
        description: "¡Bienvenido/a a Sansol! Ahora puedes proceder a jugar.",
      });
      form.reset(); 
      router.push('/play');

    } catch (error: any) {
      console.error("Error de registro:", error);
      let errorMessage = "Hubo un problema con tu registro. Por favor, inténtalo de nuevo.";
      if (error.code === 'permission-denied') {
        console.error(`Firestore Permission Denied: Operation on 'participants/${data.phoneNumber}'. Check security rules for read (getDoc) and write (setDoc) access.`);
        errorMessage = "Error de permisos con la base de datos. Contacta al soporte o revisa las reglas de Firestore.";
      } else if (error instanceof Error && error.message.includes("firestore")) {
        errorMessage = "Error de conexión con la base de datos. Verifica tu conexión o contacta al soporte."
      }
      toast({
        variant: "destructive",
        title: "¡Oh, no! Algo salió mal.",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-headline">¡Únete a Sansol!</CardTitle>
        <CardDescription>Ingresa tus datos a continuación para comenzar a jugar y ganar.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><User className="w-4 h-4 text-primary"/>Nombre Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="ej., Ana Pérez" {...field} disabled={!isFirestoreAvailable || isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary"/>Número de Teléfono</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="ej., +12345678900" {...field} disabled={!isFirestoreAvailable || isLoading} />
                  </FormControl>
                  <FormDescription>
                    Usa el formato internacional, ej: +34123456789.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="consent"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-background">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!isFirestoreAvailable || isLoading}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="flex items-center gap-2 cursor-pointer">
                     <CheckSquare className="w-4 h-4 text-primary"/> Acepto los términos y condiciones.
                    </FormLabel>
                    <FormDescription>
                      Debes aceptar para participar en Sansol.
                    </FormDescription>
                     <FormMessage />
                  </div>
                </FormItem>
              )}
            />
             <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-6 shadow-md transition-transform hover:scale-105" disabled={isLoading || !isFirestoreAvailable}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Registrarse y Jugar"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="text-center text-sm text-muted-foreground">
        <p>Tu información está segura con nosotros. Respetamos tu privacidad.</p>
      </CardFooter>
    </Card>
  );
}

    
