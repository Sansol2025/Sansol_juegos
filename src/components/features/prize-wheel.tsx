
// src/components/features/prize-wheel.tsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Gift, RotateCcw, Loader2, Sparkles, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { WheelSegmentItem } from '@/types/prize';
import Image from 'next/image';

interface PrizeRevealProps {
  onPrizeAwarded: (prize: WheelSegmentItem) => void;
  isUnlocked: boolean;
  segments: WheelSegmentItem[]; // Estos segmentos ya vienen filtrados por stock desde play/page.tsx
  onPlayPreGameAgain: () => void;
}

const REVEAL_DELAY = 1000; 

const PrizeReveal: React.FC<PrizeRevealProps> = ({ onPrizeAwarded, isUnlocked, segments, onPlayPreGameAgain }) => {
  const [isRevealing, setIsRevealing] = useState(false);
  const [hasRevealedThisSession, setHasRevealedThisSession] = useState(false);
  const [currentPrize, setCurrentPrize] = useState<WheelSegmentItem | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const revealPrize = () => {
    if (!isUnlocked || isRevealing || hasRevealedThisSession || segments.length === 0) {
      if (segments.length === 0 && !isRevealing && !hasRevealedThisSession) { 
        toast({variant: "destructive", title: "Premios Agotados", description: "No hay premios con stock disponibles en este momento. ¡Inténtalo más tarde!"})
      }
      return;
    }

    setIsRevealing(true);
    setCurrentPrize(null);
    
    const totalFrequency = segments.reduce((sum, prize) => sum + (prize.frequency || 1), 0);
    let randomValue = Math.random() * totalFrequency;
    let winningPrizeIndex = -1;

    for (let i = 0; i < segments.length; i++) {
      randomValue -= (segments[i].frequency || 1);
      if (randomValue <= 0) {
        winningPrizeIndex = i;
        break;
      }
    }
    
    if (winningPrizeIndex === -1 && segments.length > 0) { 
        winningPrizeIndex = Math.floor(Math.random() * segments.length); 
        console.warn("[PrizeReveal] Fallback: Selección de premio aleatoria simple (todos los premios sin frecuencia o error).");
    }
    
    const wonPrize = segments[winningPrizeIndex] || segments[0]; // Fallback al primero si algo muy raro pasa

    if (!wonPrize) { 
        console.error("[PrizeReveal] Error Crítico: wonPrize es undefined después de la lógica de selección.");
        toast({ variant: "destructive", title: "Error Interno", description: "No se pudo determinar el premio. Por favor, inténtalo de nuevo." });
        setIsRevealing(false);
        return;
    }
        
    setTimeout(() => {
      setIsRevealing(false);
      setHasRevealedThisSession(true); 
      setCurrentPrize(wonPrize);
      onPrizeAwarded(wonPrize); 
      
      toast({
        title: "¡Premio Revelado!",
        description: `Ganaste: ${wonPrize.name}`,
        duration: 7000,
        className: wonPrize.id.startsWith('nada-') ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground border-primary"
      });

      if (wonPrize.id && !wonPrize.id.startsWith('nada-') && typeof window !== 'undefined') {
        try {
          const prizeInfoForStorage = { 
            name: wonPrize.name, 
            id: wonPrize.id, 
            imageUrl: wonPrize.imageUrl,
            stock: wonPrize.stock 
          };
          localStorage.setItem('latestPrize', JSON.stringify(prizeInfoForStorage));
        } catch (e) {
          console.error("[PrizeReveal] Error guardando el premio en localStorage:", e);
          toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la información del premio."})
        }
      }
    }, REVEAL_DELAY); 
  };
  
  const resetForNewAttempt = () => {
    setHasRevealedThisSession(false);
    setCurrentPrize(null);
  };
  
  useEffect(() => {
    if (isUnlocked && !hasRevealedThisSession) {
      resetForNewAttempt();
    }
    if (!isUnlocked) {
        setHasRevealedThisSession(false);
        setCurrentPrize(null);
    }
  }, [isUnlocked, hasRevealedThisSession]);

  const goToPrizePage = () => {
    router.push('/prize-won');
  };
  
  if (!isUnlocked) {
    return null; 
  }

  if (segments.length === 0 && isUnlocked && !isRevealing && !hasRevealedThisSession) {
    return (
      <Card className={cn("flex flex-col items-center space-y-6 p-4 md:p-8 rounded-xl shadow-2xl bg-card border-2 border-destructive/50 w-full max-w-md mx-auto")}>
        <CardHeader className="text-center">
          <Gift className="mx-auto h-12 w-12 text-destructive mb-2" />
          <CardTitle className="text-2xl md:text-3xl font-headline text-destructive">¡Oh no!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Parece que todos los premios están temporalmente agotados o no hay premios configurados.
            <br/> Por favor, inténtalo más tarde.
          </p>
          <Button onClick={onPlayPreGameAgain} variant="outline" className="mt-4">
              <HelpCircle className="mr-2 h-5 w-5" /> Volver al Juego de Trivia
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("flex flex-col items-center space-y-6 p-4 md:p-8 rounded-xl shadow-2xl bg-card border-2 border-primary/30 w-full max-w-md mx-auto")}>
      <CardHeader className="text-center">
        <Gift className="mx-auto h-12 w-12 text-primary mb-2" />
        <CardTitle className="text-2xl md:text-3xl font-headline">Zona de Premios</CardTitle>
        <CardDescription>
          {hasRevealedThisSession && currentPrize ? `¡Has ganado ${currentPrize.name}!` : "¡Descubre si has ganado un premio!"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col items-center justify-center w-full min-h-[150px]">
        {!hasRevealedThisSession && !isRevealing && (
          <Button
            onClick={revealPrize}
            disabled={isRevealing || segments.length === 0} 
            className="bg-accent hover:bg-accent/90 text-accent-foreground text-xl py-4 px-12 shadow-lg transition-transform hover:scale-105 focus:ring-4 ring-accent/50"
            size="lg"
          >
            <Sparkles className="mr-3 h-7 w-7" />
            ¡Revelar Premio!
          </Button>
        )}

        {isRevealing && (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">Revelando tu suerte...</p>
          </div>
        )}

        {hasRevealedThisSession && currentPrize && (
          <div className="text-center space-y-4 p-4 bg-primary/10 rounded-md border border-primary/30 w-full">
            <h3 className="text-xl md:text-2xl font-semibold">
              ¡Felicidades! Ganaste:
            </h3>
            
            {currentPrize.imageUrl && !currentPrize.id.startsWith('nada-') ? (
                <div className="relative w-32 h-32 mx-auto my-4">
                    <Image
                        src={currentPrize.imageUrl}
                        alt={currentPrize.name}
                        fill={true}
                        style={{ objectFit: 'contain' }}
                        className="rounded-md"
                        sizes="128px"
                        data-ai-hint="prize visual"
                    />
                </div>
            ) : currentPrize.id.startsWith('nada-') ? ( 
                 <p className="text-6xl my-4" role="img" aria-label="cara triste">😥</p>
            ) : ( 
                 <p className="text-6xl my-4" role="img" aria-label="regalo">🎁</p>
            )}

            <p className={cn("text-2xl md:text-3xl font-bold", currentPrize.id.startsWith('nada-') ? "text-muted-foreground" : "text-primary")}>
              {currentPrize.name}
            </p>
            
            {currentPrize.id && !currentPrize.id.startsWith('nada-') && ( 
                 <Button
                    onClick={goToPrizePage}
                    className="bg-green-600 hover:bg-green-700 text-white text-lg py-3 px-6 shadow-md mt-4"
                    size="lg"
                >
                    Ver mi Código QR <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-center w-full">
        {hasRevealedThisSession && currentPrize && ( 
            <Button onClick={onPlayPreGameAgain} variant="outline" className="mt-6 w-full max-w-xs">
                <HelpCircle className="mr-2 h-5 w-5" /> Jugar Trivia de Nuevo
            </Button>
        )}
         {hasRevealedThisSession && currentPrize && (
            <p className="text-xs text-muted-foreground pt-2 mt-2">
                Para volver a probar suerte con los premios, debes superar la trivia nuevamente.
            </p>
         )}
      </CardFooter>
    </Card>
  );
};

export default PrizeReveal;
