
// src/app/verify/page.tsx
"use client";

import { useState, useEffect, FormEvent, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, CheckCircle, XCircle, LogIn, LogOut, UserCircle, KeyRound, ShieldAlert, UserCog, Info, Loader2, Search, Sparkles, PackageCheck, AlertCircle, CalendarX, History, Camera, Lock } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, Timestamp, runTransaction, updateDoc } from "firebase/firestore";
import type { Verifier } from '@/types/verifier';
import type { Prize, PrizeWithFirestoreId } from '@/types/prize'; 
import type { ClaimedPrizeWrite } from '@/types/claimedPrize';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from '@/lib/utils';
import { Html5Qrcode, type Html5QrcodeResult, type Html5QrcodeError, type QrDimensions, type Html5QrcodeCameraScanConfig } from 'html5-qrcode';

const DEFAULT_PRIZE_VALIDITY_DAYS = 7;
const QR_READER_ELEMENT_ID = "qr-reader-container";

interface ScannedPrizeDetails extends PrizeWithFirestoreId {
  qrTimestamp: number;
  qrCodeValue: string;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export default function VerifyPage() {
  const [isVerifierLoggedIn, setIsVerifierLoggedIn] = useState(false);
  const [verifierUsername, setVerifierUsername] = useState('');
  const [verifierPassword, setVerifierPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [isVerifyingOrClaiming, setIsVerifyingOrClaiming] = useState(false);
  const [scannedPrizeDetails, setScannedPrizeDetails] = useState<ScannedPrizeDetails | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'valid' | 'invalid_format' | 'not_found' | 'expired' | 'already_claimed' | 'no_stock' | 'error'>('idle');
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [prizeValidityDays, setPrizeValidityDays] = useState<number>(DEFAULT_PRIZE_VALIDITY_DAYS);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraInitializing, setIsCameraInitializing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppingScannerRef = useRef(false);

  const { toast } = useToast();
  const isFirestoreAvailable = !!db;

  const stopScannerInstance = useCallback(async () => {
    if (isStoppingScannerRef.current || !html5QrCodeRef.current) {
      return;
    }
    isStoppingScannerRef.current = true;
    try {
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch (err: any) {
      if (err.message && err.message.includes("Cannot transition to a new state, already under transition")) {
        console.warn("Warning: Encountered 'already under transition' error during stop. Library state issue or rapid calls? Error:", err.message);
      } else {
        console.error("Error stopping QR Scanner:", err.message || err);
      }
    } finally {
      html5QrCodeRef.current = null; 
      isStoppingScannerRef.current = false;
    }
  }, []);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    setVerificationMessage("Solicitando permiso de cámara...");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({ variant: 'destructive', title: 'Cámara no Soportada', description: 'Tu navegador no soporta el acceso a la cámara.' });
      setHasCameraPermission(false);
      setVerificationMessage("Acceso a cámara no soportado.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach(track => track.stop()); 
      setHasCameraPermission(true);
      setVerificationMessage("Permiso de cámara concedido.");
      return true;
    } catch (error) {
      console.error("Error accessing camera:", error);
      setHasCameraPermission(false);
      let description = 'Por favor, habilita los permisos de cámara en tu navegador.';
       if (error instanceof Error) {
        if (error.name === "NotAllowedError") description = "Has denegado el acceso a la cámara. Por favor, habilítalo en la configuración de tu navegador para esta página.";
        else if (error.name === "NotFoundError") description = "No se encontró una cámara compatible en tu dispositivo.";
        else if (error.name === "NotReadableError") description = "La cámara está siendo utilizada por otra aplicación o hubo un error de hardware.";
        else if (error.name === "OverconstrainedError") {
            description = "No se pudo satisfacer la restricción de cámara (ej. 'environment' no disponible). Intentando con cualquier cámara.";
            try { 
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(track => track.stop());
                setHasCameraPermission(true);
                setVerificationMessage("Permiso de cámara concedido (fallback).");
                return true;
            } catch (fallbackError) {
                 console.error("Error accessing camera (fallback):", fallbackError);
            }
        }
      }
      toast({ variant: 'destructive', title: 'Acceso a Cámara Denegado', description: description });
      setVerificationMessage("Acceso a cámara denegado.");
      return false;
    }
  }, [toast]);
  
  const handleVerifyQr = useCallback(async (codeToVerify: string): Promise<ScannedPrizeDetails | null> => {
    const currentCode = codeToVerify.trim();
    setIsVerifyingOrClaiming(true); 
    setVerificationStatus('idle'); 
    setVerificationMessage("Verificando código...");

    if (!currentCode || !isFirestoreAvailable) {
      setVerificationStatus('invalid_format');
      setVerificationMessage("Por favor, ingresa o escanea un código QR válido.");
      toast({variant: "destructive", title: "Código Inválido", description: "Por favor, ingresa o escanea un código QR válido."})
      setIsVerifyingOrClaiming(false);
      return null;
    }

    const parsedQr = parseQrCode(currentCode);

    if (!parsedQr) {
      setVerificationStatus('invalid_format');
      setVerificationMessage("Formato de código QR inválido. Debe ser 'SANSOL-IDPREMIO-TIMESTAMP'.");
      toast({variant: "destructive", title: "Formato Inválido", description: "El formato del código QR no es correcto."})
      setIsVerifyingOrClaiming(false);
      return null;
    }

    const { prizeId, timestamp: qrTimestamp } = parsedQr;
    const prizeIdForQuery = prizeId.toLowerCase(); 

    try {
      const claimedPrizesRef = collection(db, "claimedPrizes");
      const qClaimed = query(claimedPrizesRef, where("qrCodeValue", "==", currentCode));
      const claimedSnapshot = await getDocs(qClaimed);

      if (!claimedSnapshot.empty) {
        setVerificationStatus('already_claimed');
        const claimData = claimedSnapshot.docs[0].data();
        const claimDate = claimData.claimedAt instanceof Timestamp ? claimData.claimedAt.toDate().toLocaleDateString('es-ES') : 'fecha desconocida';
        setVerificationMessage("Este código QR ya fue canjeado el " + claimDate + ".");
        toast({variant: "destructive", title: "Ya Canjeado", description: "Este código QR ya fue canjeado."})
        setIsVerifyingOrClaiming(false);
        return null;
      }

      const prizesRef = collection(db, "prizes");
      const qPrize = query(prizesRef, where("id", "==", prizeIdForQuery));
      const prizeSnapshot = await getDocs(qPrize);

      if (prizeSnapshot.empty) {
        setVerificationStatus('not_found');
        setVerificationMessage("Premio con ID '" + prizeIdForQuery + "' no encontrado en la base de datos.");
        toast({variant: "destructive", title: "Premio No Encontrado", description: "El premio asociado a este código no se encontró."})
        setIsVerifyingOrClaiming(false);
        return null;
      }
      const prizeDoc = prizeSnapshot.docs[0];
      const prizeData = prizeDoc.data() as Prize;

      if (prizeData.stock <= 0) {
        setVerificationStatus('no_stock');
        setVerificationMessage("El premio \"" + prizeData.name + "\" está agotado.");
        toast({variant: "destructive", title: "Sin Stock", description: "El premio \"" + prizeData.name + "\" está agotado."})
        setIsVerifyingOrClaiming(false);
        return null;
      }

      const issueDate = new Date(qrTimestamp);
      const expiryDate = new Date(issueDate.getTime() + prizeValidityDays * 24 * 60 * 60 * 1000);
      const currentDate = new Date();

      if (currentDate > expiryDate) {
        setVerificationStatus('expired');
        setVerificationMessage("Este código QR expiró el " + expiryDate.toLocaleDateString('es-ES') + ". Válido por " + prizeValidityDays + " días desde su generación.");
        toast({variant: "destructive", title: "Código Expirado", description: "Este código QR ha expirado."})
        setIsVerifyingOrClaiming(false);
        return null;
      }
      
      const prizeDetailsToReturn: ScannedPrizeDetails = { ...prizeData, firestoreId: prizeDoc.id, qrTimestamp, qrCodeValue: currentCode };
      setScannedPrizeDetails(prizeDetailsToReturn); 
      setVerificationStatus('valid');
      setVerificationMessage("Premio válido: " + prizeData.name + ". Stock: " + prizeData.stock + ". Válido hasta: " + expiryDate.toLocaleDateString('es-ES') + ".");
      return prizeDetailsToReturn;

    } catch (error: any) {
      console.error("Error verificando QR:", error);
       if (error.code === 'permission-denied') {
        setVerificationMessage("Error de permisos al verificar el QR. Contacta al administrador.");
        toast({variant: "destructive", title: "Error de Permisos", description: "Error de permisos al verificar."})
      } else {
        setVerificationMessage("Error al verificar el código QR. Inténtalo de nuevo.");
        toast({variant: "destructive", title: "Error de Verificación", description: "Ocurrió un error al verificar el código."})
      }
      setVerificationStatus('error');
      setIsVerifyingOrClaiming(false);
      return null;
    }
  }, [isFirestoreAvailable, prizeValidityDays, toast]);
  
  const handleConfirmClaim = useCallback(async (prizeDetailsToClaim: ScannedPrizeDetails) => {
    if (!prizeDetailsToClaim || !isFirestoreAvailable) { 
      toast({variant: "destructive", title: "Error Interno", description: "No hay detalles de premio para canjear o la base de datos no está disponible."});
      setIsVerifyingOrClaiming(false); 
      return;
    }
    
    const prizeToClaimRef = doc(db, "prizes", prizeDetailsToClaim.firestoreId);

    try {
        await runTransaction(db, async (transaction) => {
            const prizeDocSnapshot = await transaction.get(prizeToClaimRef);
            if (!prizeDocSnapshot.exists()) {
                throw new Error("El documento del premio no existe.");
            }
            const currentPrizeData = prizeDocSnapshot.data() as Prize;
            if (currentPrizeData.stock <= 0) {
                throw new Error("El premio \"" + currentPrizeData.name + "\" ya no tiene stock.");
            }

            const claimedPrizesRef = collection(db, "claimedPrizes");
            // Firestore transactions require all reads to happen before writes.
            // For a robust check, this query should ideally be part of the transaction's read phase.
            // However, simple getDocs is often fine for this type of check if conflicts are rare.
            const qClaimedTx = query(claimedPrizesRef, where("qrCodeValue", "==", prizeDetailsToClaim.qrCodeValue));
            const claimedSnapshotInTx = await getDocs(qClaimedTx); // This read is outside the atomic phase of transaction.get
            
            if (!claimedSnapshotInTx.empty && claimedSnapshotInTx.docs.some(d => d.exists())) {
              throw new Error("El código QR \"" + prizeDetailsToClaim.qrCodeValue + "\" ya fue canjeado (verificado en transacción).");
            }

            const newClaimedPrize: ClaimedPrizeWrite = { 
                qrCodeValue: prizeDetailsToClaim.qrCodeValue,
                prizeId: prizeDetailsToClaim.id,
                prizeName: prizeDetailsToClaim.name,
                claimedAt: Timestamp.now(),
                verifiedBy: verifierUsername, 
                verificationTimestamp: Timestamp.now(), 
            };
            const claimedPrizeDocRef = doc(collection(db, "claimedPrizes")); 
            transaction.set(claimedPrizeDocRef, newClaimedPrize);
            transaction.update(prizeToClaimRef, { stock: currentPrizeData.stock - 1 });
        });

        try {
            const gameWinsRef = collection(db, "gameWins");
            const qGameWin = query(gameWinsRef, where("qrCodeValue", "==", prizeDetailsToClaim.qrCodeValue));
            const gameWinSnapshot = await getDocs(qGameWin);

            if (!gameWinSnapshot.empty) {
              const gameWinDocRef = gameWinSnapshot.docs[0].ref;
              await updateDoc(gameWinDocRef, {
                status: "claimed",
                claimedAt: Timestamp.now(), 
                verifiedBy: verifierUsername,
              });
            } else {
              console.warn(`No GameWin doc found for QR: ${prizeDetailsToClaim.qrCodeValue}. This might be an old QR or an issue if game wins are not being recorded for some reason.`);
            }
        } catch (gameWinUpdateError: any) {
            console.error(`Error updating GameWin doc for QR ${prizeDetailsToClaim.qrCodeValue}:`, gameWinUpdateError);
        }

        toast({ title: "¡Premio Canjeado!", description: prizeDetailsToClaim.name + " ha sido marcado como canjeado y el stock actualizado.", className: "bg-green-600 text-white border-green-600", duration: 5000 });
        setScannedPrizeDetails(null); 
        setVerificationStatus('idle'); 
        setVerificationMessage(null);

    } catch (error: any) {
        console.error("Error confirmando canje:", error);
        let userMessage = "No se pudo canjear el premio. ";
        if (error.message && error.message.includes("ya no tiene stock")) {
            userMessage += error.message; setVerificationStatus('no_stock'); setVerificationMessage(error.message);
        } else if (error.message && error.message.includes("ya fue canjeado")) {
            userMessage += error.message; setVerificationStatus('already_claimed'); setVerificationMessage(error.message);
        } else if (error.code === 'permission-denied') {
            userMessage += "Error de permisos. Contacta al administrador."; setVerificationStatus('error'); setVerificationMessage("Error de permisos al canjear.");
        } else {
            userMessage += "Por favor, inténtalo de nuevo."; setVerificationStatus('error'); setVerificationMessage("Error desconocido al canjear.");
        }
        toast({ variant: "destructive", title: "Error al Canjear", description: userMessage, duration: 7000 });
    } finally {
        setIsVerifyingOrClaiming(false); 
    }
  }, [isFirestoreAvailable, toast, verifierUsername]); 

  const parseQrCode = (code: string): { prizeId: string, timestamp: number } | null => {
    if (!code.startsWith("SANSOL-")) return null;
    const parts = code.substring(7).split('-');
    if (parts.length < 2) return null; 
    
    const timestamp = parseInt(parts[parts.length - 1], 10);
    if (isNaN(timestamp)) return null;

    const prizeId = parts.slice(0, -1).join('-');
    if (!prizeId) return null; 

    return { prizeId, timestamp };
  };
  
  const startScannerLogic = useCallback(async () => {
    if (!document.getElementById(QR_READER_ELEMENT_ID)) {
      toast({ variant: 'destructive', title: 'Error de Escáner', description: 'Elemento para escáner no encontrado. Intenta recargar.' });
      setIsCameraInitializing(false);
      setShowScanner(false); 
      return;
    }
    
    setIsCameraInitializing(true);
    setVerificationMessage("Iniciando escáner...");

    await stopScannerInstance(); 

    const newScannerInstance = new Html5Qrcode(QR_READER_ELEMENT_ID, { verbose: false }); // verbose: false for less console noise
    html5QrCodeRef.current = newScannerInstance; 

    const qrCodeSuccessCallback = async (decodedText: string, result: Html5QrcodeResult) => {
      await stopScannerInstance(); 
      setShowScanner(false); 
      toast({ title: "Código QR Escaneado", description: "Verificando y canjeando automáticamente...", duration: 3000 });
      
      const verifiedPrizeDetails = await handleVerifyQr(decodedText); 
      if (verifiedPrizeDetails) {
        await handleConfirmClaim(verifiedPrizeDetails); 
      }
    };

    const qrCodeErrorCallback = (errorMessage: string, error: Html5QrcodeError) => {
      if (errorMessage.includes("NotFoundException") || (error && error.name === "NotFoundException")) {
        return; 
      }
      // console.warn("QR Scan Error (non-critical):", errorMessage); // Keep for debugging if needed
    };
    
    const config: Html5QrcodeCameraScanConfig = { 
        fps: 5, 
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            let qrboxSize = Math.floor(minEdge * 0.7);
            qrboxSize = Math.max(50, qrboxSize); 
            return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0,
        rememberLastUsedCamera: true,
        supportedScanTypes: [], 
    };

    try {
      if (!html5QrCodeRef.current) {
        throw new Error("Scanner instance became null before start attempt.");
      }
      
      await html5QrCodeRef.current.start({ facingMode: "environment" }, config, qrCodeSuccessCallback, qrCodeErrorCallback);
      setVerificationMessage(null); 
    } catch (err: any) {
      console.error("Error starting QR Scanner with rear camera:", err.message || err);
      try {
        if (!html5QrCodeRef.current){
             throw new Error("Scanner instance became null before fallback start attempt.");
        }
        await html5QrCodeRef.current.start({ }, config, qrCodeSuccessCallback, qrCodeErrorCallback); 
        setVerificationMessage(null);
      } catch (fallbackErr: any) {
        console.error("Error starting QR Scanner with fallback camera:", fallbackErr.message || fallbackErr);
        let errorDesc = 'No se pudo iniciar el escáner QR. Intenta recargar la página o revisa los permisos de cámara.';
        if (err instanceof Error) { 
            if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
                errorDesc = 'Permiso de cámara denegado. Habilítalo en tu navegador.'; setHasCameraPermission(false);
            } else if (err.name === 'NotFoundError' || err.message.includes('Requested Htmp5QrcodeScanner with cameraFacing')) {
                errorDesc = 'No se encontró una cámara (trasera). Asegúrate de tener una cámara y que no esté en uso.';
            }
        } else if (fallbackErr instanceof Error) { 
             if (fallbackErr.name === 'NotAllowedError' || fallbackErr.message.includes('Permission denied')) {
                errorDesc = 'Permiso de cámara denegado. Habilítalo en tu navegador.'; setHasCameraPermission(false);
            } else if (fallbackErr.message.includes("Cannot transition to a new state, already under transition")) {
                errorDesc = "El escáner ya está en proceso de cambio de estado. Por favor, espera un momento.";
            } else if (fallbackErr.message.toLowerCase().includes("no media device found matching your constraints")) {
                errorDesc = "No se encontró un dispositivo de cámara que coincida con las restricciones.";
            }
        }
        toast({ variant: 'destructive', title: 'Error de Escáner', description: errorDesc });
        setShowScanner(false); 
        await stopScannerInstance(); 
      }
    } finally {
      setIsCameraInitializing(false);
    }
  }, [toast, stopScannerInstance, handleVerifyQr, handleConfirmClaim]);


  useEffect(() => {
    if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
    }

    if (showScanner) {
      if (hasCameraPermission === null) {
        requestCameraPermission(); 
      } else if (hasCameraPermission === true) {
        timeoutIdRef.current = setTimeout(() => {
          startScannerLogic(); 
          timeoutIdRef.current = null; 
        }, 50); 
      } else { 
        setShowScanner(false); 
      }
    } else { 
      stopScannerInstance();
    }

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null; 
      }
      stopScannerInstance();
    };
  }, [showScanner, hasCameraPermission, requestCameraPermission, startScannerLogic, stopScannerInstance]);


  useEffect(() => {
    if (isVerifierLoggedIn) {
      const fetchConfig = async () => {
        if (!isFirestoreAvailable) {
          toast({ variant: "destructive", title: "Error de Configuración", description: "Firestore no disponible. Usando validez por defecto." });
          setPrizeValidityDays(DEFAULT_PRIZE_VALIDITY_DAYS);
          setIsLoadingConfig(false);
          return;
        }
        setIsLoadingConfig(true);
        try {
          const configDocRef = doc(db, "settings", "promoConfig");
          const docSnap = await getDoc(configDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setPrizeValidityDays(data.prizeValidityDays ?? DEFAULT_PRIZE_VALIDITY_DAYS);
          } else {
            setPrizeValidityDays(DEFAULT_PRIZE_VALIDITY_DAYS);
          }
        } catch (error: any) {
          console.error("Error cargando configuración de promoción:", error);
          if (error.code === 'permission-denied') {
            toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudo cargar la configuración de validez debido a permisos. Usando valor por defecto." });
          } else {
            toast({ variant: "destructive", title: "Error al Cargar Configuración", description: "No se pudo cargar la validez de los premios. Usando valor por defecto." });
          }
          setPrizeValidityDays(DEFAULT_PRIZE_VALIDITY_DAYS);
        } finally {
          setIsLoadingConfig(false);
        }
      };
      fetchConfig();
    }
  }, [isVerifierLoggedIn, toast, isFirestoreAvailable]);


  const handleVerifierLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    if (!isFirestoreAvailable) {
      const errorMsg = "Error de configuración: La base de datos no está disponible.";
      setLoginError(errorMsg);
      toast({ variant: 'destructive', title: 'Error de Configuración', description: errorMsg });
      setIsLoggingIn(false);
      return;
    }

    try {
      const verifiersCollection = collection(db, "verifiers");
      const q = query(verifiersCollection, where("username", "==", verifierUsername.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setLoginError("Usuario o contraseña incorrectos.");
        setIsLoggingIn(false);
        return;
      }

      let foundVerifierDoc: Verifier | null = null;
      let storedHash: string | undefined = undefined;

      querySnapshot.forEach((doc) => {
        const data = doc.data() as Verifier;
        foundVerifierDoc = data;
        storedHash = data.password;
      });

      if (foundVerifierDoc && storedHash) {
        const enteredPasswordHash = await hashPassword(verifierPassword);
        if (enteredPasswordHash === storedHash) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('verifierUsername', foundVerifierDoc.username);
          }
          setIsVerifierLoggedIn(true);
          setVerifierPassword(''); 
          toast({ title: 'Inicio de Sesión Exitoso', description: "Bienvenido, " + foundVerifierDoc.username + "!" });
        } else {
          setLoginError("Usuario o contraseña incorrectos.");
        }
      } else {
        setLoginError("Usuario o contraseña incorrectos.");
      }
    } catch (error: any) {
      console.error("Error al iniciar sesión del verificador:", error);
      if (error.code === 'permission-denied') {
        setLoginError("Error de permisos al verificar credenciales. Contacta al administrador.");
        toast({ variant: 'destructive', title: 'Error de Permisos', description: 'No se pudo verificar tu cuenta debido a permisos. Revisa las reglas de Firestore.' });
      } else {
        setLoginError("Error al intentar iniciar sesión. Inténtalo de nuevo.");
        toast({ variant: 'destructive', title: 'Error de Inicio de Sesión', description: 'Ocurrió un problema al verificar tus credenciales.' });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerifierLogout = useCallback(() => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('verifierUsername');
    }
    setIsVerifierLoggedIn(false);
    setVerifierUsername('');
    setVerifierPassword(''); 
    setScannedPrizeDetails(null);
    setVerificationStatus("idle");
    setVerificationMessage(null);
    
    setShowScanner(false); 
    setHasCameraPermission(null); 
    
    stopScannerInstance(); 
    
    toast({ title: 'Sesión Cerrada', description: 'Has cerrado sesión como verificador.' });
  }, [toast, stopScannerInstance]); 
  
  const toggleScannerView = useCallback(() => {
    const newShowScannerState = !showScanner;
    
    if (newShowScannerState) { 
        setVerificationStatus('idle');
        setVerificationMessage(null);
        setScannedPrizeDetails(null);
        if (hasCameraPermission === false) { 
            setHasCameraPermission(null); 
        }
    }
    setShowScanner(newShowScannerState); 
  }, [showScanner, hasCameraPermission]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const storedUsername = localStorage.getItem('verifierUsername');
        if (storedUsername) {
        setVerifierUsername(storedUsername); 
        setIsVerifierLoggedIn(true);
        }
    }
    setIsCheckingAuth(false);
  }, []);

  if (isCheckingAuth || (isVerifierLoggedIn && isLoadingConfig)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <p className="ml-4 text-lg">{isCheckingAuth ? "Verificando sesión..." : "Cargando configuración..."}</p>
      </div>
    );
  }

  if (!isVerifierLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <UserCog className="mx-auto h-12 w-12 text-primary mb-4" />
            <CardTitle className="text-3xl font-headline">Acceso Verificador</CardTitle>
            <CardDescription>Inicia sesión para verificar premios.</CardDescription>
            {!isFirestoreAvailable && (
                 <Alert variant="destructive" className="mt-4 text-left">
                    <Info className="h-5 w-5" />
                    <AlertTitle>Error de Conexión</AlertTitle>
                    <AlertDescription>
                        No se puede conectar a la base de datos. El inicio de sesión no funcionará.
                    </AlertDescription>
                </Alert>
            )}
          </CardHeader>
          <form onSubmit={handleVerifierLogin}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="verifierUsernameInput" className="flex items-center gap-2"><UserCircle className="w-4 h-4 text-primary"/>Nombre de Usuario</Label>
                <Input
                  id="verifierUsernameInput"
                  type="text"
                  placeholder="usuario.verificador"
                  value={verifierUsername}
                  onChange={(e) => setVerifierUsername(e.target.value)}
                  required
                  disabled={!isFirestoreAvailable || isLoggingIn}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="verifierPasswordInput" className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary"/>Contraseña</Label>
                <Input
                  id="verifierPasswordInput"
                  type="password"
                  placeholder="••••••••"
                  value={verifierPassword}
                  onChange={(e) => setVerifierPassword(e.target.value)}
                  required
                  disabled={!isFirestoreAvailable || isLoggingIn}
                />
              </div>
              {loginError && <p className="text-sm font-medium text-destructive">{loginError}</p>}
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg py-6" disabled={isLoggingIn || !isFirestoreAvailable}>
                {isLoggingIn ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
                {isLoggingIn ? "Ingresando..." : "Ingresar"}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-8 py-12">
      <section className="w-full max-w-xl text-center">
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl md:text-4xl font-bold font-headline text-primary">Verificar Código QR</h1>
            <Button variant="outline" onClick={handleVerifierLogout} size="sm">
                <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión ({verifierUsername})
            </Button>
        </div>
        <p className="mt-2 text-lg text-foreground/80">
          Usa el escáner para validar códigos QR. La verificación y el canje son automáticos.
        </p>
      </section>

      <div className="w-full max-w-md space-y-4">
         <Button 
            onClick={toggleScannerView} 
            variant="outline" 
            className="w-full flex items-center justify-center text-lg py-6 border-accent text-accent hover:bg-accent/10 hover:text-accent"
            disabled={(showScanner && isCameraInitializing) || isVerifyingOrClaiming}
        >
            <Camera className="mr-2 h-5 w-5" />
            {isVerifyingOrClaiming ? "Procesando..." : (showScanner && isCameraInitializing ? "Iniciando Cámara..." : (showScanner ? "Desactivar Escáner QR" : "Activar Escáner QR"))}
        </Button>
        
        <div 
            id={QR_READER_ELEMENT_ID} 
            className={cn(
                "w-full rounded-md overflow-hidden border bg-muted relative min-h-[250px] md:min-h-[300px]", 
                { 'hidden': !showScanner || hasCameraPermission === false } 
            )}
        >
             {showScanner && hasCameraPermission === true && isCameraInitializing && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white z-10 p-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p>{verificationMessage || "Iniciando escáner..."}</p>
                </div>
            )}
        </div>
        
        {showScanner && hasCameraPermission === false && !isCameraInitializing && (
            <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>Acceso a Cámara Denegado</AlertTitle>
                <AlertDescription>
                Para usar el escáner, necesitas permitir el acceso a la cámara en la configuración de tu navegador para esta página. Recarga la página después de cambiar los permisos si es necesario.
                </AlertDescription>
            </Alert>
        )}
      </div>
      
      { verificationStatus !== 'idle' && !isVerifyingOrClaiming && (!showScanner || hasCameraPermission === false || (showScanner && hasCameraPermission === true && !isCameraInitializing) ) && ( 
        <Card className={cn(
            "w-full max-w-md shadow-md mt-6", 
            verificationStatus === 'valid' && "border-green-500 bg-green-50",
            (verificationStatus === 'invalid_format' || verificationStatus === 'not_found' || verificationStatus === 'expired' || verificationStatus === 'already_claimed' || verificationStatus === 'no_stock' || verificationStatus === 'error') && "border-destructive bg-red-50"
        )}>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
                {verificationStatus === 'valid' && <CheckCircle className="h-8 w-8 text-green-600" />}
                {verificationStatus === 'expired' && <CalendarX className="h-8 w-8 text-destructive" />}
                {verificationStatus === 'already_claimed' && <History className="h-8 w-8 text-destructive" />}
                {verificationStatus === 'no_stock' && <PackageCheck className="h-8 w-8 text-destructive" />}
                {(verificationStatus === 'invalid_format' || verificationStatus === 'not_found' || verificationStatus === 'error') && <AlertCircle className="h-8 w-8 text-destructive" />}
                
                <div className="flex-1">
                    <CardTitle className={cn(
                        "text-xl",
                        verificationStatus === 'valid' && "text-green-700",
                        (verificationStatus !== 'valid' && verificationStatus !== 'idle') && "text-destructive"
                    )}>
                        {verificationStatus === 'valid' && "Código Válido"}
                        {verificationStatus === 'expired' && "Código Expirado"}
                        {verificationStatus === 'already_claimed' && "Código Ya Canjeado"}
                        {verificationStatus === 'no_stock' && "Premio Agotado"}
                        {verificationStatus === 'invalid_format' && "Formato Inválido"}
                        {verificationStatus === 'not_found' && "Premio No Encontrado"}
                        {verificationStatus === 'error' && "Error de Verificación"}
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <p className={cn(verificationStatus === 'valid' ? "text-green-700" : "text-destructive-foreground")}>{verificationMessage}</p>
                {scannedPrizeDetails && verificationStatus === 'valid' && (
                    <div className="mt-4 space-y-1 text-sm text-green-700">
                        <p><strong>Premio:</strong> {scannedPrizeDetails.name}</p>
                        <p><strong>ID Premio (en BD):</strong> {scannedPrizeDetails.id}</p>
                        <p><strong>Stock Actual (antes de este canje si es nuevo):</strong> {scannedPrizeDetails.stock}</p>
                        <p><strong>Generado el:</strong> {new Date(scannedPrizeDetails.qrTimestamp).toLocaleString('es-ES')}</p>
                    </div>
                )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}

    
