
// src/app/prize-won/page.tsx
"use client";

import { useEffect, useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CheckCircle, Download, Gift, ExternalLink, Share2, ShieldAlert, Loader2, AlertCircle, MapPin, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection, Timestamp } from "firebase/firestore";
import type { GameWinWrite } from '@/types/gameWin';
import html2canvas from 'html2canvas';
import { QRCodeCanvas } from 'qrcode.react';

interface PrizeInfoFromStorage {
  name: string;
  id: string;
  imageUrl?: string | null;
  stock?: number;
}

const DEFAULT_PRIZE_VALIDITY_DAYS = 7;

export default function PrizeWonPage() {
  const [prizeDetails, setPrizeDetails] = useState<PrizeInfoFromStorage | null>(null);
  const [qrCodeValue, setQrCodeValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [validUntilTimestamp, setValidUntilTimestamp] = useState<Timestamp | null>(null);
  const [prizeValidityDaysFetched, setPrizeValidityDaysFetched] = useState<number | null>(null);
  const [generationTimestamp, setGenerationTimestamp] = useState<number | null>(null);
  const [participantFullName, setParticipantFullName] = useState<string | null>(null);
  const [participantPhoneNumber, setParticipantPhoneNumber] = useState<string | null>(null);
  const [gameWinSaved, setGameWinSaved] = useState(false);
  const [errorSavingGameWin, setErrorSavingGameWin] = useState<string | null>(null);
  const [isGeneratingScreenshot, setIsGeneratingScreenshot] = useState(false);

  const prizeCardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const isFirestoreAvailable = !!db;

  useEffect(() => {
    const fullName = typeof window !== 'undefined' ? localStorage.getItem('participantFullName') : null;
    const phoneNumber = typeof window !== 'undefined' ? localStorage.getItem('participantPhoneNumber') : null;
    setParticipantFullName(fullName);
    setParticipantPhoneNumber(phoneNumber);

    if (!fullName || !phoneNumber) {
      console.warn("Datos del participante no encontrados en localStorage. El registro del premio ganado podría no ser completo.");
    }

    const fetchConfig = async () => {
      if (!isFirestoreAvailable) {
        console.warn("Firestore no disponible, usando validez por defecto (7 días).");
        setPrizeValidityDaysFetched(DEFAULT_PRIZE_VALIDITY_DAYS);
        return;
      }
      try {
        const configDocRef = doc(db, "settings", "promoConfig");
        const docSnap = await getDoc(configDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPrizeValidityDaysFetched(data.prizeValidityDays ?? DEFAULT_PRIZE_VALIDITY_DAYS);
        } else {
          console.log("Documento de configuración de promoción no encontrado, usando validez por defecto (7 días).");
          setPrizeValidityDaysFetched(DEFAULT_PRIZE_VALIDITY_DAYS);
        }
      } catch (error: any) {
        console.error("Error cargando configuración de validez:", error);
        if (error.code === 'permission-denied') {
          console.error("Firestore Permission Denied: Check security rules for 'settings/promoConfig' document read access.");
          toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudo cargar la configuración de validez de premios debido a permisos. Usando valor por defecto." });
        } else {
          toast({ variant: "destructive", title: "Error de Configuración", description: "No se pudo cargar la validez de los premios. Usando valor por defecto." });
        }
        setPrizeValidityDaysFetched(DEFAULT_PRIZE_VALIDITY_DAYS);
      }
    };
    fetchConfig();
  }, [isFirestoreAvailable, toast]);

  useEffect(() => {
    if (prizeValidityDaysFetched === null) {
      return;
    }

    const storedPrizeString = typeof window !== 'undefined' ? localStorage.getItem('latestPrize') : null;
    const timestamp = Date.now();
    setGenerationTimestamp(timestamp);

    if (storedPrizeString) {
      try {
        const storedPrize: PrizeInfoFromStorage = JSON.parse(storedPrizeString);
        if (storedPrize && storedPrize.name && storedPrize.id) {
          if (storedPrize.id.startsWith('nada-')) {
            setPrizeDetails({ name: "Ningún premio ganado esta vez", id: "no_prize_actual", imageUrl: null });
            setQrCodeValue("NO-ACTUAL-PRIZE");
            setValidUntil("N/A");
            setIsLoading(false);
            return;
          }
          setPrizeDetails(storedPrize);
          const uniqueQrData = `SANSOL-${storedPrize.id.toUpperCase()}-${timestamp}`;
          setQrCodeValue(uniqueQrData);

          const validUntilDateObj = new Date(timestamp + (prizeValidityDaysFetched * 24 * 60 * 60 * 1000));
          setValidUntil(validUntilDateObj.toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
          }));
          setValidUntilTimestamp(Timestamp.fromDate(validUntilDateObj));

        } else {
          throw new Error("Datos del premio inválidos en localStorage.");
        }
      } catch (error) {
        console.error("Error procesando el premio guardado:", error);
        toast({
          variant: "destructive",
          title: "Error al cargar el premio",
          description: "No se pudo encontrar tu premio. Intenta ganar uno nuevo.",
        });
        setPrizeDetails({ name: "Error al cargar premio", id: "error", imageUrl: null });
        setQrCodeValue("ERROR-NO-PRIZE-DATA");
        setValidUntil("N/A");
      }
    } else {
      toast({
        title: "No hay premio que mostrar",
        description: "Parece que llegaste aquí sin ganar un premio. ¡Ve a jugar!",
        duration: 5000,
      });
      setPrizeDetails({ name: "Ningún premio ganado aún", id: "no_prize", imageUrl: null });
      setQrCodeValue("NO-PRIZE-YET");
      setValidUntil("N/A");
    }
    setIsLoading(false);
  }, [prizeValidityDaysFetched, toast]);

  useEffect(() => {
    if (
      !isLoading &&
      prizeDetails && prizeDetails.id !== 'no_prize' && prizeDetails.id !== 'no_prize_actual' && prizeDetails.id !== 'error' &&
      participantFullName && participantPhoneNumber &&
      qrCodeValue && qrCodeValue !== "NO-ACTUAL-PRIZE" && qrCodeValue !== "NO-PRIZE-YET" && qrCodeValue !== "ERROR-NO-PRIZE-DATA" &&
      validUntilTimestamp && generationTimestamp &&
      isFirestoreAvailable && !gameWinSaved && !errorSavingGameWin
    ) {
      const saveGameWin = async () => {
        const gameWinData: GameWinWrite = {
          participantFullName,
          participantPhoneNumber,
          prizeId: prizeDetails.id,
          prizeName: prizeDetails.name,
          prizeImageUrl: prizeDetails.imageUrl,
          qrCodeValue,
          wonAt: Timestamp.fromMillis(generationTimestamp),
          validUntil: validUntilTimestamp,
          status: "won",
        };

        try {
          const docRef = await addDoc(collection(db, "gameWins"), gameWinData);
          setGameWinSaved(true);
          toast({
            title: "¡Premio Registrado!",
            description: "Tu premio se ha guardado. ¡Preséntalo en tienda!",
            className: "bg-green-600 text-white border-green-600"
          });
        } catch (error: any) {
          console.error("Error guardando GameWin en Firestore:", error);
          let firestoreErrorMsg = "No se pudo registrar tu premio en la base de datos.";
          if (error.code === 'permission-denied') {
            firestoreErrorMsg = "Error de permisos: No se pudo registrar tu premio. Contacta al administrador.";
            console.error("Firestore Permission Denied: Check security rules for 'gameWins' collection write access (addDoc).");
          }
          setErrorSavingGameWin(firestoreErrorMsg);
          toast({
            variant: "destructive",
            title: "Error al Registrar Premio",
            description: firestoreErrorMsg,
            duration: 7000,
          });
        }
      };
      saveGameWin();
    } else if (!isLoading && prizeDetails && (prizeDetails.id === 'no_prize_actual' || (qrCodeValue && qrCodeValue === "NO-ACTUAL-PRIZE"))) {
      // No action needed for 'Sigue Intentando' or no actual prize
    } else if (!isLoading && (!participantFullName || !participantPhoneNumber) && prizeDetails && prizeDetails.id !== 'no_prize' && prizeDetails.id !== 'error') {
      console.warn("No se pudo guardar GameWin porque faltan datos del participante en localStorage.");
      setErrorSavingGameWin("No se pudieron obtener los datos del participante para registrar el premio. El QR es válido pero el registro en nuestra base de datos podría estar incompleto.");
    }
  }, [isLoading, prizeDetails, participantFullName, participantPhoneNumber, qrCodeValue, validUntilTimestamp, generationTimestamp, isFirestoreAvailable, gameWinSaved, errorSavingGameWin, toast]);

  const handleDownloadScreenshot = async () => {
    const cardNode = prizeCardRef.current;
    if (!cardNode) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo encontrar el elemento de la tarjeta del premio." });
      console.error("prizeCardRef.current es null");
      return;
    }
    setIsGeneratingScreenshot(true);

    let clonedCardNode: HTMLElement | null = null;

    try {
      clonedCardNode = cardNode.cloneNode(true) as HTMLElement;
      
      clonedCardNode.style.position = 'absolute';
      clonedCardNode.style.left = '-9999px';
      clonedCardNode.style.top = '0px';
      clonedCardNode.style.width = cardNode.offsetWidth + 'px';
      clonedCardNode.style.height = cardNode.offsetHeight + 'px';
      clonedCardNode.style.zIndex = '100'; 
      clonedCardNode.style.backgroundColor = window.getComputedStyle(cardNode).backgroundColor || '#ffffff';


      document.body.appendChild(clonedCardNode);
      
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const qrCanvasOriginal = cardNode.querySelector('#qr-code-canvas-container canvas') as HTMLCanvasElement | null;
      const qrContainerInClone = clonedCardNode.querySelector('#qr-code-canvas-container');

      if (qrCanvasOriginal && qrContainerInClone) {
        const dataUrl = qrCanvasOriginal.toDataURL('image/png');
        const img = document.createElement('img');
        img.style.width = '200px'; 
        img.style.height = '200px'; 
        img.style.display = 'block'; 
        img.style.border = 'none';
        
        const imgLoadPromise = new Promise<void>((resolve, reject) => {
          img.onload = () => {
            resolve();
          };
          img.onerror = (errEvent) => {
            console.error("Error cargando DataURL en <img> temporal. Evento:", errEvent);
            reject(new Error("Error al cargar la imagen DataURL del QR."));
          };
        });
        img.src = dataUrl; 
        await imgLoadPromise; 
        
        const qrCloneContainerEl = qrContainerInClone as HTMLElement;
        qrCloneContainerEl.innerHTML = ''; 
        qrCloneContainerEl.style.display = 'flex'; 
        qrCloneContainerEl.style.justifyContent = 'center';
        qrCloneContainerEl.style.alignItems = 'center';
        qrCloneContainerEl.style.width = '100%'; 
        qrCloneContainerEl.appendChild(img);
      } else {
        if (!qrCanvasOriginal) console.warn("Canvas del QR original NO encontrado en el nodo visible.");
        if (!qrContainerInClone) console.warn("Contenedor del QR en el CLON NO encontrado.");
        throw new Error("No se pudo procesar el QR para la captura.");
      }
      
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const canvas = await html2canvas(clonedCardNode, {
        allowTaint: false, 
        useCORS: true, 
        scale: 2, 
        backgroundColor: null, 
        logging: false, // Set to true for more detailed html2canvas logs if needed
        width: clonedCardNode.scrollWidth,
        height: clonedCardNode.scrollHeight,
        x: 0,
        y: 0,
      });
      
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `Comprobante-Premio-Sansol-${prizeDetails?.id || 'premio'}.png`;
      link.href = image;
      document.body.appendChild(link); 
      link.click();
      document.body.removeChild(link); 

    } catch (err: any) {
      console.error("Error generando la captura de pantalla:", err.message || err, err.stack);
      toast({ variant: "destructive", title: "Error al Descargar", description: `No se pudo generar la imagen del comprobante. ${err.message || ''}` });
    } finally {
      if (clonedCardNode && clonedCardNode.parentElement === document.body) {
        document.body.removeChild(clonedCardNode);
      }
      setIsGeneratingScreenshot(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="text-xl mt-4 font-semibold text-foreground/80">Cargando tu premio...</p>
      </div>
    )
  }

  if (!prizeDetails || prizeDetails.id === "no_prize" || prizeDetails.id === "error" || prizeDetails.id === "no_prize_actual") {
    const titleText = prizeDetails?.id === "no_prize_actual" ? "¡Sigue Intentando!"
      : (!prizeDetails || prizeDetails.id === "error" ? "Error al Cargar Premio" : "No Hay Premio");
    const descriptionText = prizeDetails?.id === "no_prize_actual" ? "No has ganado un premio esta vez. ¡Pero puedes volver a intentarlo!"
      : (!prizeDetails || prizeDetails.id === "error"
        ? "Hubo un problema al obtener los detalles de tu premio."
        : "No hemos encontrado un premio asociado. Por favor, ¡intenta ganar uno en la página de juegos!");
    const iconClass = prizeDetails?.id === "no_prize_actual" ? "text-blue-500" : "text-destructive";

    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)] text-center py-12">
        {prizeDetails?.id === "no_prize_actual" ? <Gift className={`mx-auto h-16 w-16 ${iconClass} mb-4`} /> : <ShieldAlert className={`mx-auto h-16 w-16 ${iconClass} mb-4`} />}
        <h1 className={`text-3xl md:text-4xl font-bold font-headline ${prizeDetails?.id === "no_prize_actual" ? "text-primary" : "text-destructive"}`}>
          {titleText}
        </h1>
        <p className="mt-4 text-lg text-foreground/80 max-w-md mx-auto">
          {descriptionText}
        </p>
        <Link href="/play" className="mt-8">
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Gift className="mr-2 h-5 w-5" /> {prizeDetails?.id === "no_prize_actual" ? "Jugar de Nuevo" : "Ir a Jugar"}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-8 py-12">
      <section className="text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">¡Felicitaciones, {participantFullName || "participante"}!</h1>
        <p className="mt-4 text-lg text-foreground/80 max-w-xl mx-auto">
          ¡Has ganado <span className="font-semibold text-accent">{prizeDetails.name}</span>! Presenta el código QR a continuación en Sansol para canjearlo.
        </p>
      </section>

      <Card ref={prizeCardRef} className="w-full max-w-md shadow-xl text-center border-2 border-accent/50 bg-card">
        <CardHeader className="bg-accent/10">
          {prizeDetails.imageUrl ? (
            <div className="relative w-24 h-24 mx-auto mb-2">
              <Image
                src={prizeDetails.imageUrl}
                alt={prizeDetails.name}
                fill={true}
                style={{ objectFit: 'contain' }}
                className="rounded-md"
                data-ai-hint="prize visual"
                sizes="96px"
                crossOrigin="anonymous" 
              />
            </div>
          ) : (
            <Gift className="mx-auto h-10 w-10 text-accent mb-2" />
          )}
          <CardTitle className="text-2xl font-headline text-accent">{prizeDetails.name}</CardTitle>
          <CardDescription>Obtenido en: Sansol</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-primary">Tu Código QR Único:</h3>
            <div id="qr-code-canvas-container" className="p-3 bg-white rounded-lg inline-block shadow-md border">
              {qrCodeValue ? (
                <QRCodeCanvas value={qrCodeValue} size={200} bgColor="#ffffff" fgColor="#000000" level="L" />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center bg-muted rounded text-muted-foreground">
                  Generando QR...
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2 break-all px-4">Escanea este código en Sansol. <br />ID: {qrCodeValue}</p>
          </div>

          <div className="text-sm text-muted-foreground bg-background/50 p-3 rounded-md border">
            {validUntil ? (
              <p><strong>Válido Hasta:</strong> {validUntil}</p>
            ) : (
              <p>Calculando validez...</p>
            )}
            <p className="mt-1">Este código es de un solo uso. Guárdalo bien.</p>
            {generationTimestamp && <p className="text-xs mt-1">Generado: {new Date(generationTimestamp).toLocaleString('es-ES')}</p>}
          </div>

          <div className="text-sm text-foreground bg-secondary/30 p-4 rounded-md border border-secondary">
            <h4 className="text-md font-semibold mb-2 text-secondary-foreground flex items-center justify-center"><MapPin className="mr-2 h-5 w-5" /> Información para Canjear tu Premio</h4>
            <p><strong>Local Sansol</strong></p>
            <p>Av. Angelelli N°178</p>
            <p className="mt-2 flex items-center justify-center"><Clock className="mr-2 h-4 w-4" /><strong>Horarios de Atención:</strong></p>
            <p>Lunes a Sábado: 10:00 - 13:00 y 18:30 - 21:30</p>
          </div>

          {errorSavingGameWin && (
            <div className="text-sm text-destructive bg-red-50 p-3 rounded-md border border-destructive/50 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>{errorSavingGameWin}</span>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center pt-4 border-t bg-background/30">
          <Button
            onClick={handleDownloadScreenshot}
            variant="outline"
            className="w-full sm:w-auto border-primary text-primary hover:bg-primary/10"
            disabled={isGeneratingScreenshot || !qrCodeValue}
          >
            {isGeneratingScreenshot ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isGeneratingScreenshot ? "Generando..." : "Descargar Comprobante"}
          </Button>
        </CardFooter>
      </Card>
      <section className="text-center mt-4 space-x-4">
        <Link href="/play">
          <Button variant="link" className="text-primary text-lg">
            <Gift className="mr-2 h-5 w-5" /> ¿Jugar de Nuevo?
          </Button>
        </Link>
        <Link href="/">
          <Button variant="outline" className="text-lg">
            Ir al Inicio <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>
    </div>
  );
}
    
