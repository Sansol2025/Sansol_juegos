
// src/app/play/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import TriviaGame from "@/components/features/trivia-game"; 
import PrizeReveal from "@/components/features/prize-wheel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Gift, Loader2, Target, Sparkles, HelpCircle, UserCheck, Trophy, AlertCircle, ArrowRight } from "lucide-react"; 
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import type { Prize, WheelSegmentItem } from '@/types/prize';
import type { GameWin } from '@/types/gameWin';
import { useSearchParams, useRouter } from 'next/navigation';

const PLACEHOLDER_PRIZE_FREQUENCY = 5; 

export default function PlayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isTestMode = searchParams.get('testMode') === 'true';

  const [prizeMechanismUnlocked, setPrizeMechanismUnlocked] = useState(isTestMode);
  const [showTriviaGame, setShowTriviaGame] = useState(!isTestMode); 
  const [availablePrizesForReveal, setAvailablePrizesForReveal] = useState<WheelSegmentItem[]>([]);
  const [isLoadingPrizes, setIsLoadingPrizes] = useState(true);
  const [sessionPrizeWon, setSessionPrizeWon] = useState<WheelSegmentItem | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(!isTestMode);
  
  const [isLoadingParticipationStatus, setIsLoadingParticipationStatus] = useState(!isTestMode);
  const [hasActiveOrClaimedMajorPrize, setHasActiveOrClaimedMajorPrize] = useState(false);
  const [participationStatusMessage, setParticipationStatusMessage] = useState<string | null>(null);

  const { toast } = useToast();
  const isFirestoreAvailable = !!db;

  useEffect(() => {
    if (isTestMode || typeof window === 'undefined') {
        setIsCheckingAuth(false);
        setIsLoadingParticipationStatus(false);
        return;
    }

    const fullName = localStorage.getItem('participantFullName');
    const phoneNumber = localStorage.getItem('participantPhoneNumber');

    if (!fullName || !phoneNumber) {
      toast({
        title: "Registro Requerido",
        description: "Debes registrarte antes de poder jugar. Serás redirigido.",
        variant: "default",
        className: "bg-blue-100 border-blue-300 text-blue-700"
      });
      router.push('/register');
      // No seteamos setIsCheckingAuth(false) o setIsLoadingParticipationStatus(false)
      // porque la redirección ocurrirá
    } else {
      setIsCheckingAuth(false);
      // Ahora verificar el estado de participación si Firestore está disponible
      if (isFirestoreAvailable) {
        checkParticipationStatus(phoneNumber);
      } else {
        setIsLoadingParticipationStatus(false); // Si no hay Firestore, no podemos verificar, así que permitimos jugar
      }
    }
  }, [isTestMode, router, toast, isFirestoreAvailable]);


  const checkParticipationStatus = async (phoneNumber: string) => {
    setIsLoadingParticipationStatus(true);
    setHasActiveOrClaimedMajorPrize(false);
    setParticipationStatusMessage(null);

    try {
      const gameWinsRef = collection(db, "gameWins");
      const q = query(
        gameWinsRef,
        where("participantPhoneNumber", "==", phoneNumber)
      );
      const querySnapshot = await getDocs(q);
      let activePrizeFound = false;

      querySnapshot.forEach((doc) => {
        const gameWin = doc.data() as GameWin;
        const isMajorPrize = gameWin.prizeId && !gameWin.prizeId.startsWith('nada-') && gameWin.prizeId !== 'no_prize';

        if (isMajorPrize) {
          if (gameWin.status === 'claimed') {
            activePrizeFound = true;
            setParticipationStatusMessage(`Ya has reclamado el premio: ${gameWin.prizeName}. ¡Gracias por participar!`);
            return; // Salir del bucle forEach
          }
          if (gameWin.status === 'won') {
            const now = Timestamp.now();
            if (gameWin.validUntil && gameWin.validUntil.toMillis() >= now.toMillis()) {
              activePrizeFound = true;
              setParticipationStatusMessage(`Tienes un premio (${gameWin.prizeName}) pendiente de reclamar y aún es válido. ¡No olvides canjearlo!`);
              return; // Salir del bucle forEach
            }
          }
        }
      });

      if (activePrizeFound) {
        setHasActiveOrClaimedMajorPrize(true);
      }

    } catch (error: any) {
      console.error("Error verificando estado de participación:", error);
      if (error.code === 'permission-denied') {
        toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudo verificar tu estado de participación debido a permisos." });
      } else if (error.code === 'failed-precondition' && error.message && error.message.includes('requires an index')) {
        toast({ variant: "destructive", title: "Índice Requerido", description: "Firestore necesita un índice para esta consulta. Por favor, contacta al administrador.", duration: 10000 });
        // El admin necesitaría crear este índice: gameWins -> participantPhoneNumber (ASC)
      } else {
        toast({ variant: "destructive", title: "Error", description: "No se pudo verificar tu estado de participación." });
      }
      // En caso de error, permitir jugar para no bloquear al usuario injustamente, pero loguear el error.
    } finally {
      setIsLoadingParticipationStatus(false);
    }
  };


  const preparePrizesForRevealMechanism = useCallback((definedPrizes: Prize[]): WheelSegmentItem[] => {
    let actualPrizes = definedPrizes.filter(p => 
        p.id !== 'nada' && 
        typeof p.frequency === 'number' && p.frequency > 0 &&
        typeof p.stock === 'number' && p.stock > 0
    );
    
    const segments: WheelSegmentItem[] = actualPrizes.map(prize => ({
        ...prize,
    }));

    if (segments.length === 0) {
       segments.push({
            id: `nada-0`, 
            name: "Sigue Intentando",
            imageUrl: undefined, 
            frequency: PLACEHOLDER_PRIZE_FREQUENCY * 10, 
            stock: Infinity, 
        });
    }
    
    for (let i = segments.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [segments[i], segments[j]] = [segments[j], segments[i]];
    }

    return segments;
  }, []);


  useEffect(() => {
    if (isCheckingAuth || isLoadingParticipationStatus) return; 

    const fetchPrizesAndPrepareList = async () => {
      setIsLoadingPrizes(true);
      if (!isFirestoreAvailable) {
         toast({
          variant: "destructive",
          title: "Error de Configuración de Base de Datos",
          description: "No se pueden cargar los premios. Contacta al administrador.",
        });
        setAvailablePrizesForReveal(preparePrizesForRevealMechanism([])); 
        setIsLoadingPrizes(false);
        return;
      }
      try {
        const prizesCollection = collection(db, "prizes");
        const prizesQuery = query(prizesCollection); 
        const querySnapshot = await getDocs(prizesQuery);
        const prizesData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                stock: data.stock ?? 0 
            } as Prize;
        });

        const preparedList = preparePrizesForRevealMechanism(prizesData);
        setAvailablePrizesForReveal(preparedList);

      } catch (error: any) {
        console.error("Error cargando premios:", error);
        let errorDescription = "No se pudieron cargar los premios.";
        if (error.code === 'permission-denied') {
            errorDescription = "Error de permisos al cargar premios. Revisa las reglas de Firestore.";
        } else {
             errorDescription = `No se pudieron cargar los premios. ${error instanceof Error ? error.message : String(error)}`;
        }
        toast({
          variant: "destructive",
          title: "Error al Cargar Premios",
          description: errorDescription,
        });
        setAvailablePrizesForReveal(preparePrizesForRevealMechanism([]));
      } finally {
        setIsLoadingPrizes(false);
      }
    };

    if (!hasActiveOrClaimedMajorPrize) { // Solo cargar premios si el usuario puede jugar
        fetchPrizesAndPrepareList();
    } else {
        setIsLoadingPrizes(false); // Si no puede jugar, no necesitamos cargar premios
    }
  }, [isCheckingAuth, isLoadingParticipationStatus, hasActiveOrClaimedMajorPrize, toast, preparePrizesForRevealMechanism, isFirestoreAvailable]); 

  const handleGameWon = () => { 
    if (hasActiveOrClaimedMajorPrize) return; // Doble chequeo
    setPrizeMechanismUnlocked(true);
    setShowTriviaGame(false); 
    setSessionPrizeWon(null); 
    toast({
      title: "¡Juego de Trivia Superado!", 
      description: "¡Has desbloqueado la oportunidad de ganar un premio! ¡Prueba tu suerte!",
      className: "bg-green-600 text-white border-green-600",
      duration: 5000,
    });
  };

  const handlePrizeAwardedByMechanism = (prize: WheelSegmentItem) => {
    if (hasActiveOrClaimedMajorPrize && !(prize.id && prize.id.startsWith('nada-'))) return;

    setSessionPrizeWon(prize);
    // Si el premio ganado es real (no "Sigue Intentando"), marcamos que ya tiene un premio activo.
    if (prize.id && !prize.id.startsWith('nada-') && prize.id !== 'no_prize') {
      setHasActiveOrClaimedMajorPrize(true);
      setParticipationStatusMessage(`¡Has ganado ${prize.name}! Dirígete a la página de tu premio para obtener el QR.`);
    }
  };

  const handlePlayTriviaAgain = () => { 
    if (hasActiveOrClaimedMajorPrize) {
        // El mensaje ya debería estar seteado por checkParticipationStatus o handlePrizeAwarded
        // Si no, podemos poner uno genérico.
        toast({ title:"Participación Completa", description: participationStatusMessage || "Ya has participado y ganado/reclamado un premio.", duration: 7000});
        return;
    }
    setShowTriviaGame(true);
    setPrizeMechanismUnlocked(false);
    setSessionPrizeWon(null);
  }


  useEffect(() => {
    if (isTestMode) {
      setPrizeMechanismUnlocked(true);
      setShowTriviaGame(false); 
    } else if (!prizeMechanismUnlocked && !hasActiveOrClaimedMajorPrize) { // Solo mostrar trivia si no se ha desbloqueado la rueda Y no tiene premio mayor
        setShowTriviaGame(true); 
    } else if (hasActiveOrClaimedMajorPrize) { // Si tiene premio mayor, no mostrar ni trivia ni rueda de inmediato
        setShowTriviaGame(false);
        setPrizeMechanismUnlocked(false);
    }
  }, [prizeMechanismUnlocked, isTestMode, hasActiveOrClaimedMajorPrize]);

  if (isCheckingAuth || isLoadingParticipationStatus) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">
            {isCheckingAuth ? "Verificando registro..." : "Verificando estado de participación..."}
        </p>
      </div>
    );
  }
  
  if (hasActiveOrClaimedMajorPrize && !isTestMode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-15rem)] py-12">
        <Card className="w-full max-w-lg shadow-xl text-center">
          <CardHeader>
            <Trophy className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
            <CardTitle className="text-3xl font-headline text-primary">¡Gracias por Participar!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg text-foreground/80">
              {participationStatusMessage || "Ya has ganado o reclamado un premio en esta promoción."}
            </p>
            {sessionPrizeWon && sessionPrizeWon.id && !sessionPrizeWon.id.startsWith('nada-') && (
                 <Button asChild className="bg-green-600 hover:bg-green-700 text-white text-lg py-3 px-6 shadow-md mt-4">
                    <Link href="/prize-won">Ver mi Código QR <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
            )}
            <p className="text-sm text-muted-foreground">
              <Link href="/" className="text-primary hover:underline font-medium">Volver al inicio</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center space-y-10 py-8 md:py-12">
      <section className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">
          {isTestMode ? <>Modo Prueba: Revelar Premio <Target className="inline-block ml-2 h-8 w-8"/></> 
            : prizeMechanismUnlocked ? "¡Revela tu Premio!" : "Trivia Sansol"}
        </h1>
        <p className="mt-3 md:mt-4 text-base md:text-lg text-foreground/80 max-w-xl mx-auto">
          {prizeMechanismUnlocked ?
            (sessionPrizeWon ? `Ganaste: ${sessionPrizeWon.name}. ¡Puedes ver tu premio o jugar la trivia de nuevo!` : "¡Haz clic para revelar tu premio!")
            : "Supera la Trivia de Sansol para desbloquear la oportunidad de ganar. ¡Buena suerte!"}
        </p>
      </section>

      {showTriviaGame && !prizeMechanismUnlocked && ( 
        <section className="w-full flex justify-center px-4">
          <TriviaGame onGameWonSuccessfully={handleGameWon} />
        </section>
      )}


      {prizeMechanismUnlocked && !showTriviaGame && ( 
         <section className="w-full flex justify-center mt-2 md:mt-6 px-4">
          {isLoadingPrizes ? (
            <div className="flex flex-col items-center justify-center p-10 bg-card rounded-lg shadow-xl h-96 w-full max-w-md">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-muted-foreground">Cargando configuración de premios...</p>
            </div>
          ) : ( 
            <PrizeReveal
              onPrizeAwarded={handlePrizeAwardedByMechanism}
              isUnlocked={prizeMechanismUnlocked}
              segments={availablePrizesForReveal}
              onPlayPreGameAgain={handlePlayTriviaAgain} 
            />
          )}
        </section>
      )}

       {showTriviaGame && !prizeMechanismUnlocked && ( 
         <section className="w-full max-w-3xl mt-10 px-4 opacity-80">
            <Card className="shadow-lg bg-card border border-border/50">
                <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl font-headline flex items-center"><Sparkles className="mr-3 h-7 w-7 text-muted-foreground"/>Zona de Premios</CardTitle>
                    <Gift className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardDescription>¡Responde correctamente la trivia para tener la oportunidad de ganar emocionantes premios de Sansol!</CardDescription>
                </CardHeader>
                <CardContent>
                <Alert variant="default" className="mb-4 bg-primary/10 border-primary/30">
                    <Info className="h-5 w-5 text-primary" />
                    <AlertTitle className="text-primary">Zona de Premios Bloqueada</AlertTitle>
                    <AlertDescription className="text-primary/80">
                    Debes ganar el Juego de Trivia primero para desbloquear la oportunidad de ganar un premio.
                    </AlertDescription>
                </Alert>
                {isLoadingPrizes ? (
                     <p className="text-muted-foreground mb-4 text-sm flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2"/> Cargando información de premios...
                    </p>
                ) : availablePrizesForReveal.length > 0 ? (
                    <p className="text-muted-foreground mb-4 text-sm">
                        Hay {availablePrizesForReveal.filter(s => s.id && !s.id.startsWith('nada-') && s.stock > 0).length} premios reales con stock disponibles actualmente.
                    </p>
                ) : (
                     <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Premios Agotados</AlertTitle>
                        <AlertDescription>
                            Actualmente no hay premios disponibles. ¡Vuelve a intentarlo más tarde!
                        </AlertDescription>
                    </Alert>
                )}
                </CardContent>
            </Card>
        </section>
       )}

      <section className="text-center mt-8 md:mt-10">
        <p className="text-foreground/70">
          ¿Terminaste de jugar por ahora? <Link href="/" className="text-primary hover:underline font-medium">Volver al inicio</Link>.
        </p>
        {prizeMechanismUnlocked && sessionPrizeWon && (sessionPrizeWon.id && !sessionPrizeWon.id.startsWith('nada-')) &&
        <p className="text-xs text-muted-foreground mt-2">Si ganas un premio real, podrás verlo en la página "Mis Premios" y obtener tu código QR.</p>}
      </section>
    </div>
  );
}
