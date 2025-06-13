
// src/app/admin/page.tsx
"use client";

import { useState, useEffect, ChangeEvent, useRef, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Users, ShieldAlert, Gift, PlusCircle, Edit3, Trash2, Info, Loader2, Save, Image as ImageIcon, UploadCloud, X, AlertCircle, TrendingUp, Package, Settings, CalendarDays, UserCog, KeyRound, User, BadgeCheck, ListChecks, Lock, Activity, ChevronDown, RotateCcw, AlertTriangle, LogIn, LogOut, ShieldCheck, ArrowRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, updateDoc, setDoc, getDoc, Timestamp, where, limit, writeBatch } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject, type StorageError } from "firebase/storage";
import type { Prize, PrizeWithFirestoreId } from '@/types/prize';
import type { Verifier } from '@/types/verifier';
import Image from 'next/image';
import { cn } from "@/lib/utils";
import type { ParticipantWithFirestoreId, Participant } from '@/types/participant';
import type { GameWin, GameWinWithId } from '@/types/gameWin';

const DEFAULT_PRIZE_FREQUENCY = 10;
const DEFAULT_PRIZE_STOCK = 10;
const DEFAULT_PRIZE_VALIDITY_DAYS = 7;
const RECENT_ITEMS_LIMIT = 10;

const prizeOptions = [
  { id: "auricular-con-cable", name: "Auricular con cable" },
  { id: "auricular-bt", name: "Auricular BT" },
  { id: "pelota-goma", name: "Pelota de goma" },
  { id: "parlante-chico", name: "Parlante chico" },
  { id: "estufa-dos-velas", name: "Estufa de dos velas" },
  { id: "caloventor-chico", name: "Caloventor chico" },
  { id: "descuento-10", name: "Orden de descuento del 10%" },
  { id: "descuento-20", name: "Orden de descuento del 20%" },
  { id: "premio-consuelo-1", name: "Premio consuelo 1" },
  { id: "premio-consuelo-2", name: "Premio consuelo 2" },
];

interface ParticipantActivity extends ParticipantWithFirestoreId {
  latestGameWin?: GameWinWithId;
}


async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export default function AdminPage() {
  // Admin Auth States
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsernameInput, setAdminUsernameInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [isCheckingAdminAuth, setIsCheckingAdminAuth] = useState(true);
  const [isProcessingAdminLogin, setIsProcessingAdminLogin] = useState(false);


  // Existing states
  const [currentPrizes, setCurrentPrizes] = useState<PrizeWithFirestoreId[]>([]);
  const [newPrizeName, setNewPrizeName] = useState('');
  const [newPrizeType, setNewPrizeType] = useState(prizeOptions[0].id);
  const [newPrizeImageFile, setNewPrizeImageFile] = useState<File | null>(null);
  const [newPrizeImagePreview, setNewPrizeImagePreview] = useState<string | null>(null);
  const [newPrizeFrequency, setNewPrizeFrequency] = useState<number>(DEFAULT_PRIZE_FREQUENCY);
  const [newPrizeStock, setNewPrizeStock] = useState<number>(DEFAULT_PRIZE_STOCK);

  const [isLoadingPrizes, setIsLoadingPrizes] = useState(true);
  const [isSubmittingPrize, setIsSubmittingPrize] = useState(false);

  const [editingPrize, setEditingPrize] = useState<PrizeWithFirestoreId | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedPrizeName, setEditedPrizeName] = useState("");
  const [editedPrizeType, setEditedPrizeType] = useState(prizeOptions[0].id);
  const [editedPrizeFrequency, setEditedPrizeFrequency] = useState<number>(DEFAULT_PRIZE_FREQUENCY);
  const [editedPrizeStock, setEditedPrizeStock] = useState<number>(DEFAULT_PRIZE_STOCK);
  const [editedPrizeImageFile, setEditedPrizeImageFile] = useState<File | null>(null);
  const [editedPrizeImagePreview, setEditedPrizeImagePreview] = useState<string | null>(null);
  const [isSavingEditedPrize, setIsSavingEditedPrize] = useState(false);

  const [prizeValidityDays, setPrizeValidityDays] = useState<number>(DEFAULT_PRIZE_VALIDITY_DAYS);
  const [isLoadingValidityDays, setIsLoadingValidityDays] = useState(true);
  const [isSavingValidityDays, setIsSavingValidityDays] = useState(false);

  const [totalParticipants, setTotalParticipants] = useState(0);
  const [isLoadingTotalParticipants, setIsLoadingTotalParticipants] = useState(true);

  const [claimedPrizesCount, setClaimedPrizesCount] = useState(0);
  const [isLoadingClaimedPrizes, setIsLoadingClaimedPrizes] = useState(true);

  const [fraudAlertsCount, setFraudAlertsCount] = useState(0);
  const [isLoadingFraudAlerts, setIsLoadingFraudAlerts] = useState(true);

  const [newVerifierUsername, setNewVerifierUsername] = useState('');
  const [newVerifierPassword, setNewVerifierPassword] = useState('');
  const [isCreatingVerifier, setIsCreatingVerifier] = useState(false);
  const [verifiers, setVerifiers] = useState<Verifier[]>([]);
  const [isLoadingVerifiers, setIsLoadingVerifiers] = useState(true);

  const [recentActivity, setRecentActivity] = useState<ParticipantActivity[]>([]);
  const [isLoadingRecentActivity, setIsLoadingRecentActivity] = useState(true);
  const [isExportingData, setIsExportingData] = useState(false);

  const [isResetPromotionDialogOpen, setIsResetPromotionDialogOpen] = useState(false);
  const [resetConfirmationInput, setResetConfirmationInput] = useState("");
  const [isResettingPromotion, setIsResettingPromotion] = useState(false);


  const newPrizeFileInputRef = useRef<HTMLInputElement>(null);
  const editPrizeFileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const isFirestoreAvailable = !!db;
  const isStorageAvailable = !!storage;

  // Admin Auth Check on Mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const adminSession = localStorage.getItem('isAdminLoggedIn');
      if (adminSession === 'true') {
        setIsAdminLoggedIn(true);
      }
    }
    setIsCheckingAdminAuth(false);
  }, []);

  const handleAdminLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAdminLoginError(null);
    setIsProcessingAdminLogin(true);

    const configuredAdminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME;
    const configuredAdminPasswordHash = process.env.NEXT_PUBLIC_ADMIN_PASSWORD_HASH;

    if (!configuredAdminUsername || !configuredAdminPasswordHash || configuredAdminPasswordHash === "TU_HASH_SHA256_DE_CONTRASENA_AQUI" || configuredAdminPasswordHash === "Chuflo14") {
        setAdminLoginError("La configuración de credenciales de administrador no está completa o es incorrecta. Revisa las variables de entorno y asegúrate de que la contraseña esté hasheada.");
        toast({ variant: 'destructive', title: 'Error de Configuración', description: "Credenciales de administrador no configuradas correctamente en el servidor." });
        setIsProcessingAdminLogin(false);
        return;
    }

    if (adminUsernameInput.trim() === configuredAdminUsername) {
        const enteredPasswordHash = await hashPassword(adminPasswordInput);
        if (enteredPasswordHash === configuredAdminPasswordHash) {
            if (typeof window !== 'undefined') {
                localStorage.setItem('isAdminLoggedIn', 'true');
            }
            setIsAdminLoggedIn(true);
            setAdminPasswordInput(''); 
            toast({ title: 'Inicio de Sesión de Admin Exitoso', description: "Bienvenido, Administrador." });
        } else {
            setAdminLoginError("Usuario o contraseña de administrador incorrectos.");
        }
    } else {
        setAdminLoginError("Usuario o contraseña de administrador incorrectos.");
    }
    setIsProcessingAdminLogin(false);
  };

  const handleAdminLogout = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('isAdminLoggedIn');
    }
    setIsAdminLoggedIn(false);
    setAdminUsernameInput('');
    setAdminPasswordInput('');
    setAdminLoginError(null);
    toast({ title: 'Sesión de Admin Cerrada', description: 'Has cerrado sesión como administrador.' });
  };


  useEffect(() => {
    if (!isEditDialogOpen) {
      setEditingPrize(null);
      setEditedPrizeName("");
      setEditedPrizeType(prizeOptions[0].id);
      setEditedPrizeFrequency(DEFAULT_PRIZE_FREQUENCY);
      setEditedPrizeStock(DEFAULT_PRIZE_STOCK);
      setEditedPrizeImageFile(null);
      setEditedPrizeImagePreview(null);
      if (editPrizeFileInputRef.current) {
        editPrizeFileInputRef.current.value = "";
      }
    }
  }, [isEditDialogOpen]);

  const uploadImage = (file: File, prizeId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!isStorageAvailable) {
        const errorMessage = "Firebase Storage no está disponible. No se puede subir la imagen.";
        toast({ variant: "destructive", title: "Error de Configuración de Storage", description: errorMessage });
        reject(new Error(errorMessage));
        return;
      }
      const fileExtension = file.name.split('.').pop();
      const fileName = `prize-${prizeId}-${Date.now()}.${fileExtension}`;
      const imageRef = storageRef(storage, `prizes/${fileName}`);
      const uploadTask = uploadBytesResumable(imageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {},
        (error: StorageError) => {
          let userMessage = "Error al subir la imagen.";
          switch (error.code) {
            case 'storage/unauthorized': userMessage = "Error de permisos: No estás autorizado para subir archivos. Revisa las reglas de Firebase Storage."; break;
            case 'storage/canceled': userMessage = "La subida de la imagen fue cancelada."; break;
            case 'storage/unknown': userMessage = "Ocurrió un error desconocido durante la subida de la imagen."; break;
            case 'storage/object-not-found': userMessage = "El archivo de imagen no se encontró (raro durante subida)."; break;
            case 'storage/quota-exceeded': userMessage = "Se ha excedido la cuota de almacenamiento. Contacta al administrador."; break;
            case 'storage/unauthenticated': userMessage = "No estás autenticado. Se requiere autenticación para esta operación."; break;
            case 'storage/retry-limit-exceeded': userMessage = "Se excedió el límite de reintentos para la subida. Verifica tu conexión."; break;
            default: userMessage = `Error desconocido de Storage: ${error.message} (código: ${error.code})`;
          }
          toast({ variant: "destructive", title: "Error de Subida de Imagen", description: userMessage });
          reject(error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            resolve(downloadURL);
          }).catch((downloadError: any) => {
            toast({ variant: "destructive", title: "Error de Subida", description: "La imagen se subió pero no se pudo obtener la URL."})
            reject(downloadError);
          });
        }
      );
    });
  };

  const deleteImageFromStorage = async (imageUrl: string | undefined | null) => {
    if (!imageUrl || !isStorageAvailable) {
      if (!isStorageAvailable) console.warn("Storage no disponible, no se puede eliminar imagen.");
      return;
    }
    if (!imageUrl.startsWith("https://firebasestorage.googleapis.com/")) {
        return;
    }
    try {
      const imageRef = storageRef(storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error: any) {
      if (error.code === 'storage/object-not-found') {
        console.warn("Imagen no encontrada en Storage al intentar eliminar:", imageUrl);
      } else {
         toast({ variant: "destructive", title: "Error Eliminando Imagen", description: `No se pudo eliminar la imagen de Storage. Código: ${error.code}` });
      }
    }
  };


  const fetchPromoConfig = async () => {
    setIsLoadingValidityDays(true);
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error de Configuración", description: "Firestore no disponible. No se puede cargar la configuración de la promoción." });
      setIsLoadingValidityDays(false);
      return;
    }
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
       if (error.code === 'permission-denied') {
        toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudo cargar la configuración de validez debido a permisos. Revisa las reglas de Firestore." });
      } else {
        toast({ variant: "destructive", title: "Error al Cargar Configuración", description: "No se pudo cargar la validez de los premios." });
      }
      setPrizeValidityDays(DEFAULT_PRIZE_VALIDITY_DAYS);
    } finally {
      setIsLoadingValidityDays(false);
    }
  };

  const handleSavePromoConfig = async () => {
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error de Configuración", description: "Firestore no disponible. No se puede guardar la configuración." });
      return;
    }
    if (prizeValidityDays <= 0) {
        toast({ variant: "destructive", title: "Error de Validación", description: "Los días de validez deben ser un número positivo." });
        return;
    }
    setIsSavingValidityDays(true);
    try {
      const configDocRef = doc(db, "settings", "promoConfig");
      await setDoc(configDocRef, { prizeValidityDays: prizeValidityDays });
      toast({ title: "Éxito", description: "Configuración de la promoción guardada." });
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudo guardar la configuración debido a permisos. Revisa las reglas de Firestore." });
      } else {
        toast({ variant: "destructive", title: "Error al Guardar", description: "No se pudo guardar la configuración." });
      }
    } finally {
      setIsSavingValidityDays(false);
    }
  };

  const fetchTotalParticipants = async () => {
    setIsLoadingTotalParticipants(true);
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error de Configuración", description: "Firestore no disponible. No se puede cargar el total de participantes." });
      setIsLoadingTotalParticipants(false);
      return;
    }
    try {
      const participantsCollection = collection(db, "participants");
      const querySnapshot = await getDocs(participantsCollection);
      setTotalParticipants(querySnapshot.size);
    } catch (error: any)
     {
      if (error.code === 'permission-denied') {
        toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudo cargar el total de participantes debido a permisos. Revisa las reglas de Firestore." });
      } else {
        toast({ variant: "destructive", title: "Error al Cargar Participantes", description: "No se pudo obtener el total de participantes." });
      }
      setTotalParticipants(0);
    } finally {
      setIsLoadingTotalParticipants(false);
    }
  };

  const fetchClaimedPrizesCount = async () => {
    setIsLoadingClaimedPrizes(true);
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error de Configuración", description: "Firestore no disponible. No se puede cargar el total de premios reclamados." });
      setIsLoadingClaimedPrizes(false);
      return;
    }
    try {
      const claimedPrizesCollection = collection(db, "claimedPrizes");
      const querySnapshot = await getDocs(claimedPrizesCollection);
      setClaimedPrizesCount(querySnapshot.size);
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudo cargar el total de premios reclamados debido a permisos. Revisa las reglas de Firestore." });
      } else {
        toast({ variant: "destructive", title: "Error al Cargar Premios Reclamados", description: "No se pudo obtener el total de premios reclamados." });
      }
      setClaimedPrizesCount(0);
    } finally {
      setIsLoadingClaimedPrizes(false);
    }
  };

  const fetchFraudAlertsCount = async () => {
    setIsLoadingFraudAlerts(true);
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error de Configuración", description: "Firestore no disponible. No se puede cargar el total de alertas de fraude." });
      setIsLoadingFraudAlerts(false);
      return;
    }
    try {
      const fraudAlertsCollection = collection(db, "fraudAlerts");
      const querySnapshot = await getDocs(fraudAlertsCollection);
      setFraudAlertsCount(querySnapshot.size);
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudo cargar el total de alertas de fraude debido a permisos. Revisa las reglas de Firestore." });
      } else {
        toast({ variant: "destructive", title: "Error al Cargar Alertas de Fraude", description: "No se pudo obtener el total de alertas de fraude." });
      }
      setFraudAlertsCount(0);
    } finally {
      setIsLoadingFraudAlerts(false);
    }
  };


  const fetchVerifiers = async () => {
    setIsLoadingVerifiers(true);
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error de Configuración", description: "Firestore no disponible. No se pueden cargar los verificadores." });
      setIsLoadingVerifiers(false);
      return;
    }
    try {
      const verifiersCollection = collection(db, "verifiers");
      const q = query(verifiersCollection, orderBy("username"));
      const querySnapshot = await getDocs(q);
      const verifiersData = querySnapshot.docs.map(doc => ({
        firestoreId: doc.id,
        ...doc.data()
      } as Verifier));
      setVerifiers(verifiersData);
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudieron cargar los verificadores debido a permisos. Revisa las reglas de Firestore." });
      } else {
        toast({ variant: "destructive", title: "Error al Cargar Verificadores", description: "No se pudieron cargar las cuentas de verificador." });
      }
    } finally {
      setIsLoadingVerifiers(false);
    }
  };

  const fetchRecentActivity = async () => {
    setIsLoadingRecentActivity(true);
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error de Configuración", description: "Firestore no disponible." });
      setIsLoadingRecentActivity(false);
      return;
    }
    try {
      const participantsCol = collection(db, "participants");
      const participantsQuery = query(participantsCol, orderBy("registeredAt", "desc"), limit(RECENT_ITEMS_LIMIT));
      const participantsSnapshot = await getDocs(participantsQuery);
      const participantsData = participantsSnapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() } as ParticipantWithFirestoreId));

      const activityPromises = participantsData.map(async (participant) => {
        const gameWinsCol = collection(db, "gameWins");
        const gameWinsQuery = query(
          gameWinsCol, 
          where("participantPhoneNumber", "==", participant.phoneNumber), 
          orderBy("wonAt", "desc"), 
          limit(1)
        );
        const gameWinsSnapshot = await getDocs(gameWinsQuery);
        let latestGameWin: GameWinWithId | undefined = undefined;
        if (!gameWinsSnapshot.empty) {
          latestGameWin = { firestoreId: gameWinsSnapshot.docs[0].id, ...gameWinsSnapshot.docs[0].data() } as GameWinWithId;
        }
        return { ...participant, latestGameWin };
      });

      const combinedActivity = await Promise.all(activityPromises);
      setRecentActivity(combinedActivity);

    } catch (error: any) {
      if (error.code === 'permission-denied') {
         toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudo cargar la actividad reciente debido a permisos." });
      } else if (error.code === 'failed-precondition' && error.message && error.message.includes('requires an index')) {
        toast({ variant: "destructive", title: "Índice Requerido", description: "Firestore necesita un índice para esta consulta. Por favor, crea el índice como se indica en la consola de Firebase.", duration: 10000 });
      } else {
        toast({ variant: "destructive", title: "Error", description: "No se pudo cargar la actividad reciente." });
      }
    } finally {
      setIsLoadingRecentActivity(false);
    }
  };


  useEffect(() => {
    const fetchPrizes = async () => {
      setIsLoadingPrizes(true);
      if (!isFirestoreAvailable) {
        toast({ variant: "destructive", title: "Error de Configuración de Firebase", description: "Firestore (base de datos) no está disponible. Verifica la conexión y configuración de Firebase en tu proyecto y las variables de entorno." });
        setIsLoadingPrizes(false);
        return;
      }
      try {
        const prizesCollection = collection(db, "prizes");
        const prizesQuery = query(prizesCollection, orderBy("name"));
        const querySnapshot = await getDocs(prizesQuery);
        const prizesData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                firestoreId: doc.id,
                ...data,
                stock: data.stock ?? 0
            } as PrizeWithFirestoreId
        });
        setCurrentPrizes(prizesData);
      } catch (error: any) {
        let description = "No se pudieron cargar los premios.";
        if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
          description = "Error de permisos al leer de Firestore (collection 'prizes'). Verifica las reglas de seguridad de Firestore.";
        } else if (error.code === 'unavailable') {
          description = "Firestore no disponible o problema de conexión. Verifica tu conexión a internet y el estado del servicio de Firebase.";
        } else {
          description = `Detalles: ${error.message || String(error)}`;
        }
        toast({ variant: "destructive", title: "Error al Cargar Premios", description });
      } finally {
        setIsLoadingPrizes(false);
      }
    };

    if (isAdminLoggedIn) { 
        if (isFirestoreAvailable) {
            fetchPrizes();
            fetchPromoConfig();
            fetchTotalParticipants();
            fetchClaimedPrizesCount();
            fetchFraudAlertsCount();
            fetchVerifiers();
            fetchRecentActivity();
        } else {
            toast({ variant: "destructive", title: "Error de Configuración de Firebase", description: "Firestore (base de datos) no está disponible. No se pueden cargar datos." });
            setIsLoadingPrizes(false);
            setIsLoadingValidityDays(false);
            setIsLoadingTotalParticipants(false);
            setIsLoadingClaimedPrizes(false);
            setIsLoadingFraudAlerts(false);
            setIsLoadingVerifiers(false);
            setIsLoadingRecentActivity(false);
        }
    }
  }, [isAdminLoggedIn, toast, isFirestoreAvailable]); 

  const handleNewPrizeImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewPrizeImageFile(file);
      setNewPrizeImagePreview(URL.createObjectURL(file));
    } else {
      setNewPrizeImageFile(null);
      setNewPrizeImagePreview(null);
    }
  };

  const handleNewPrizeTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setNewPrizeType(e.target.value);
  };

  const handleEditPrizeImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditedPrizeImageFile(file);
      setEditedPrizeImagePreview(URL.createObjectURL(file));
    } else {
      setEditedPrizeImageFile(null);
      setEditedPrizeImagePreview(editingPrize?.imageUrl || null);
    }
  };

  const handleAddPrize = async () => {
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error de Configuración", description: "Firestore (base de datos) no está disponible. No se puede añadir el premio." });
      return;
    }
    if (newPrizeImageFile && !isStorageAvailable) {
        toast({ variant: "destructive", title: "Error de Configuración", description: "Firebase Storage no está disponible. No se puede subir la imagen del premio." });
        return;
    }
    setIsSubmittingPrize(true);

    if (!newPrizeName.trim()) {
      toast({ variant: "destructive", title: "Error de Validación", description: "Nombre del premio es obligatorio." });
      setIsSubmittingPrize(false);
      return;
    }
    if (newPrizeFrequency <= 0) {
      toast({ variant: "destructive", title: "Error de Validación", description: "La frecuencia debe ser un número positivo." });
      setIsSubmittingPrize(false);
      return;
    }
    if (newPrizeStock < 0) {
      toast({ variant: "destructive", title: "Error de Validación", description: "El stock no puede ser negativo." });
      setIsSubmittingPrize(false);
      return;
    }
     if (currentPrizes.some(p => p.id === newPrizeType.trim())) {
      toast({ variant: "destructive", title: "ID Duplicado", description: "Ya existe un premio con este ID." });
      setIsSubmittingPrize(false);
      return;
    }
    if (currentPrizes.filter(p => p.id !== 'nada').length >= 10) {
      toast({ variant: "destructive", title: "Límite Alcanzado", description: "Solo se pueden definir hasta 10 premios reales para la ruleta." });
      setIsSubmittingPrize(false);
      return;
    }

    let imageUrlToStore: string | null = null;

    try {
      if (newPrizeImageFile) {
        imageUrlToStore = await uploadImage(newPrizeImageFile, newPrizeType);
      }

      const prizeDataForFirestore: Omit<Prize, 'firestoreId'> = {
        name: newPrizeName.trim(),
        id: newPrizeType.trim(),
        imageUrl: imageUrlToStore,
        frequency: newPrizeFrequency,
        stock: newPrizeStock,
      };
      const docRef = await addDoc(collection(db, "prizes"), prizeDataForFirestore);

      setCurrentPrizes(prev => [...prev, { firestoreId: docRef.id, ...prizeDataForFirestore, imageUrl: prizeDataForFirestore.imageUrl ?? undefined }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewPrizeName('');
      setNewPrizeType(prizeOptions[0].id);
      setNewPrizeFrequency(DEFAULT_PRIZE_FREQUENCY);
      setNewPrizeStock(DEFAULT_PRIZE_STOCK);
      setNewPrizeImageFile(null);
      setNewPrizeImagePreview(null);
      if (newPrizeFileInputRef.current) newPrizeFileInputRef.current.value = "";
      toast({ title: "Éxito", description: "Premio añadido correctamente a Firestore." });

    } catch (error: any) {
      if (error.code === 'permission-denied') {
        toast({ variant: "destructive", title: "Error de Permisos", description: `No se pudo añadir el premio debido a permisos. Revisa las reglas de Firestore. ${error.message}` });
      } else {
        toast({ variant: "destructive", title: "Error al Guardar Premio", description: `No se pudo añadir el premio. ${error.message || String(error)}` });
      }
    } finally {
      setIsSubmittingPrize(false);
    }
  };

  const handleDeletePrize = async (prizeToDelete: PrizeWithFirestoreId) => {
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error de Configuración", description: "Firestore no disponible. No se puede eliminar." });
      return;
    }
    try {
      if (prizeToDelete.imageUrl && isStorageAvailable) {
        await deleteImageFromStorage(prizeToDelete.imageUrl);
      } else if (prizeToDelete.imageUrl && !isStorageAvailable) {
      }
      await deleteDoc(doc(db, "prizes", prizeToDelete.firestoreId));
      setCurrentPrizes(prev => prev.filter(p => p.firestoreId !== prizeToDelete.firestoreId));
      toast({ title: "Éxito", description: "Premio eliminado correctamente de Firestore." });
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        toast({ variant: "destructive", title: "Error de Permisos", description: `No se pudo eliminar el premio debido a permisos. Revisa las reglas de Firestore. ${error.message}` });
      } else {
        toast({ variant: "destructive", title: "Error al Eliminar", description: `No se pudo eliminar el premio. ${error.message || String(error)}` });
      }
    }
  };

  const handleOpenEditDialog = (prize: PrizeWithFirestoreId) => {
      setEditingPrize(prize); 
      setEditedPrizeName(prize.name);
      setEditedPrizeType(prize.id);
      setEditedPrizeFrequency(prize.frequency || DEFAULT_PRIZE_FREQUENCY);
      setEditedPrizeStock(prize.stock ?? 0);
      setEditedPrizeImageFile(null); 
      setEditedPrizeImagePreview(prize.imageUrl || null);
      setIsEditDialogOpen(true);
  };

  const handleSaveChangesToPrize = async () => {
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error de Configuración", description: "Firestore no disponible. No se pueden guardar los cambios." });
      return;
    }
    if (editedPrizeImageFile && !isStorageAvailable) {
        toast({ variant: "destructive", title: "Error de Configuración", description: "Firebase Storage no está disponible. No se puede subir la nueva imagen." });
        return;
    }
    if (!editingPrize) { 
      toast({ variant: "destructive", title: "Error Interno", description: "No hay premio seleccionado para editar." });
      return;
    }
    setIsSavingEditedPrize(true);

    if (!editedPrizeName.trim()) {
      toast({ variant: "destructive", title: "Error de Validación", description: "El nombre del premio no puede estar vacío." });
      setIsSavingEditedPrize(false);
      return;
    }
    if (editedPrizeFrequency <= 0) {
      toast({ variant: "destructive", title: "Error de Validación", description: "La frecuencia debe ser un número positivo." });
      setIsSavingEditedPrize(false);
      return;
    }
    if (editedPrizeStock < 0) {
      toast({ variant: "destructive", title: "Error de Validación", description: "El stock no puede ser negativo." });
      setIsSavingEditedPrize(false);
      return;
    }

    let newImageUrlToStore: string | null = editingPrize.imageUrl || null;
    const oldImageUrl = editingPrize.imageUrl;

    try {
      if (editedPrizeImageFile) {
        newImageUrlToStore = await uploadImage(editedPrizeImageFile, editingPrize.id);
        if (oldImageUrl && oldImageUrl !== newImageUrlToStore && isStorageAvailable) {
          await deleteImageFromStorage(oldImageUrl);
        }
      } else if (editedPrizeImagePreview === null && oldImageUrl && isStorageAvailable) { 
         await deleteImageFromStorage(oldImageUrl);
         newImageUrlToStore = null;
      }


      const prizeRef = doc(db, "prizes", editingPrize.firestoreId);
      const updatedPrizeDataForFirestore: Partial<Prize> = {
        name: editedPrizeName.trim(),
        id: editedPrizeType, 
        imageUrl: newImageUrlToStore,
        frequency: editedPrizeFrequency,
        stock: editedPrizeStock,
      };
      await updateDoc(prizeRef, updatedPrizeDataForFirestore);

      setCurrentPrizes(prev =>
        prev.map(p =>
          p.firestoreId === editingPrize.firestoreId ? { ...p, ...updatedPrizeDataForFirestore, imageUrl: updatedPrizeDataForFirestore.imageUrl ?? undefined } : p
        ).sort((a, b) => a.name.localeCompare(b.name))
      );
      toast({ title: "Éxito", description: "Premio actualizado correctamente en Firestore." });
      setIsEditDialogOpen(false); 

    } catch (error: any) {
      if (error.code === 'permission-denied') {
        toast({ variant: "destructive", title: "Error de Permisos", description: `No se pudo actualizar el premio debido a permisos. Revisa las reglas de Firestore. ${error.message}` });
      } else {
        toast({ variant: "destructive", title: "Error al Guardar Cambios", description: `No se pudo actualizar el premio. ${error.message || String(error)}` });
      }
    } finally {
      setIsSavingEditedPrize(false);
    }
  };

  const handleEditedPrizeTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setEditedPrizeType(e.target.value);
  };

  const handleCreateVerifier = async () => {
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error de Configuración", description: "Firestore no disponible." });
      return;
    }
    if (!newVerifierUsername.trim() || !newVerifierPassword.trim()) {
      toast({ variant: "destructive", title: "Error de Validación", description: "Nombre de usuario y contraseña son obligatorios." });
      return;
    }
    setIsCreatingVerifier(true);
    try {
      const verifiersCollectionRef = collection(db, "verifiers");
      const q = query(verifiersCollectionRef, where("username", "==", newVerifierUsername.trim()));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        toast({ variant: "destructive", title: "Error", description: "El nombre de usuario del verificador ya existe." });
        setIsCreatingVerifier(false);
        return;
      }

      const hashedPassword = await hashPassword(newVerifierPassword);

      const verifierData: Omit<Verifier, 'firestoreId'> = {
        username: newVerifierUsername.trim(),
        password: hashedPassword, 
        createdAt: new Date(),
      };
      const docRef = await addDoc(verifiersCollectionRef, verifierData);
      setVerifiers(prev => [...prev, { ...verifierData, firestoreId: docRef.id }].sort((a,b) => a.username.localeCompare(b.username)));
      setNewVerifierUsername('');
      setNewVerifierPassword('');
      toast({ title: "Éxito", description: "Cuenta de verificador creada con contraseña hasheada." });
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudo crear la cuenta de verificador debido a permisos. Revisa las reglas de Firestore." });
      } else {
        toast({ variant: "destructive", title: "Error", description: "No se pudo crear la cuenta." });
      }
    } finally {
      setIsCreatingVerifier(false);
    }
  };

   const handleDeleteVerifier = async (verifierToDelete: Verifier) => {
    if (!isFirestoreAvailable || !verifierToDelete.firestoreId) {
      toast({ variant: "destructive", title: "Error", description: "No se puede eliminar (datos incompletos o Firestore no disponible)." });
      return;
    }
    try {
      await deleteDoc(doc(db, "verifiers", verifierToDelete.firestoreId));
      setVerifiers(prev => prev.filter(v => v.firestoreId !== verifierToDelete.firestoreId));
      toast({ title: "Éxito", description: "Cuenta de verificador eliminada." });
    } catch (error: any) {
       if (error.code === 'permission-denied') {
        toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudo eliminar la cuenta de verificador debido a permisos. Revisa las reglas de Firestore." });
      } else {
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la cuenta." });
      }
    }
  };

  const formatFirestoreTimestamp = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getPrizeStatusBadge = (gameWin?: GameWinWithId): JSX.Element => {
    if (!gameWin) {
      return <Badge variant="outline">No ha jugado</Badge>;
    }
    if (gameWin.prizeId && (gameWin.prizeId.includes('nada-') || gameWin.prizeId.includes('no_prize'))) {
         return <Badge variant="secondary">Jugó (Sin premio)</Badge>;
    }

    switch (gameWin.status) {
      case 'won':
        if (gameWin.validUntil && gameWin.validUntil.toDate() < new Date()) {
          return <Badge variant="destructive" className="bg-orange-500 text-white">Expirado (Sin canjear)</Badge>;
        }
        return <Badge className="bg-yellow-500 text-black">Ganado (Pendiente)</Badge>;
      case 'claimed':
        return <Badge className="bg-green-600 text-white">Canjeado</Badge>;
      case 'expired_unclaimed':
         return <Badge variant="destructive" className="bg-red-700 text-white">Expirado (Sin canjear)</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const escapeCsvField = (field: string | number | boolean | null | undefined): string => {
    if (field === null || field === undefined) {
      return '""';
    }
    const stringField = String(field);
    if (stringField.includes('"') || stringField.includes(',') || stringField.includes('\n') || stringField.includes('\r')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return `"${stringField}"`;
  };

  const handleExportParticipantsToCSV = async () => {
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error", description: "Firestore no disponible." });
      return;
    }
    setIsExportingData(true);
    toast({ title: "Exportando...", description: "Generando CSV de participantes..." });

    try {
      const participantsCollection = collection(db, "participants");
      const participantsQuery = query(participantsCollection, orderBy("registeredAt", "desc"));
      const querySnapshot = await getDocs(participantsQuery);
      
      const participantsData: Participant[] = querySnapshot.docs.map(doc => doc.data() as Participant);

      if (participantsData.length === 0) {
        toast({ variant: "default", title: "Sin Datos", description: "No hay participantes para exportar." });
        setIsExportingData(false);
        return;
      }

      const headers = ["Nombre Completo", "Numero de Telefono", "Fecha de Registro", "Consentimiento"];
      const csvRows = [headers.join(",")];

      participantsData.forEach(participant => {
        const registeredAt = participant.registeredAt instanceof Timestamp 
          ? participant.registeredAt.toDate().toISOString()
          : "N/A";
        const consentGiven = participant.consentGiven ? "Si" : "No";

        const row = [
          escapeCsvField(participant.fullName),
          escapeCsvField(participant.phoneNumber),
          escapeCsvField(registeredAt),
          escapeCsvField(consentGiven),
        ];
        csvRows.push(row.join(","));
      });

      const csvString = csvRows.join("\n");
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "participantes_sansol.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "¡Exportación Exitosa!", description: `${participantsData.length} participantes exportados a CSV.` });

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Exportación", description: `No se pudieron exportar los participantes. ${error.message}` });
    } finally {
      setIsExportingData(false);
    }
  };

  const handleOpenResetDialog = () => {
    setResetConfirmationInput("");
    setIsResetPromotionDialogOpen(true);
  };

  const deleteCollectionInBatches = async (collectionName: string) => {
    if (!isFirestoreAvailable) {
      toast({ variant: "destructive", title: "Error", description: "Firestore no disponible."});
      return;
    }
    const collectionRef = collection(db, collectionName);
    let querySnapshot;
    do {
      querySnapshot = await getDocs(query(collectionRef, limit(50)));
      if (querySnapshot.empty) break;

      const batch = writeBatch(db);
      querySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      toast({ title: `Lote eliminado de ${collectionName}`, description: `${querySnapshot.size} documentos eliminados.`, duration: 2000 });
    } while (!querySnapshot.empty);
  };

  const handleConfirmResetPromotion = async () => {
    if (resetConfirmationInput !== "REINICIAR") {
      toast({ variant: "destructive", title: "Error de Confirmación", description: "Debes escribir 'REINICIAR' para confirmar."});
      return;
    }
    setIsResettingPromotion(true);
    toast({ title: "Iniciando Reinicio", description: "Eliminando datos de la promoción...", duration: 5000});

    try {
      await deleteCollectionInBatches("participants");
      await deleteCollectionInBatches("gameWins");
      await deleteCollectionInBatches("claimedPrizes");
      await deleteCollectionInBatches("fraudAlerts");

      toast({ title: "¡Reinicio Completo!", description: "Todos los datos de participación han sido eliminados.", className: "bg-green-600 text-white", duration: 7000});
      
      fetchTotalParticipants();
      fetchClaimedPrizesCount();
      fetchFraudAlertsCount();
      fetchRecentActivity();

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error en el Reinicio", description: `No se pudieron eliminar todos los datos. ${error.message}` });
    } finally {
      setIsResettingPromotion(false);
      setIsResetPromotionDialogOpen(false);
      setResetConfirmationInput("");
    }
  };

  if (isCheckingAdminAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <p className="ml-4 text-lg">Verificando acceso de administrador...</p>
      </div>
    );
  }

  if (!isAdminLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen py-12 bg-background">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-primary mb-4" />
            <CardTitle className="text-3xl font-headline">Acceso de Administrador</CardTitle>
            <CardDescription>Por favor, inicia sesión para gestionar la promoción.</CardDescription>
            
          </CardHeader>
          <form onSubmit={handleAdminLogin}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="adminUsernameInput" className="flex items-center gap-2"><User className="w-4 h-4 text-primary"/>Usuario Admin</Label>
                <Input
                  id="adminUsernameInput"
                  type="text"
                  placeholder="admin.user"
                  value={adminUsernameInput}
                  onChange={(e) => setAdminUsernameInput(e.target.value)}
                  required
                  disabled={isProcessingAdminLogin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPasswordInput" className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary"/>Contraseña Admin</Label>
                <Input
                  id="adminPasswordInput"
                  type="password"
                  placeholder="••••••••"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  required
                  disabled={isProcessingAdminLogin}
                />
              </div>
              {adminLoginError && <p className="text-sm font-medium text-destructive">{adminLoginError}</p>}
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg py-6" disabled={isProcessingAdminLogin}>
                {isProcessingAdminLogin ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
                {isProcessingAdminLogin ? "Ingresando..." : "Ingresar como Admin"}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-8 py-8">
      <section className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold font-headline text-primary">Panel de Administración</h1>
          <p className="mt-2 text-lg text-foreground/80">
            Gestiona participantes, premios, visualiza reclamos y monitorea la actividad.
          </p>
        </div>
        <div className="flex items-center gap-4">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isExportingData}>
                {isExportingData ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
                {isExportingData ? "Exportando..." : "Exportar Datos"}
                <ChevronDown className="ml-2 h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportParticipantsToCSV} disabled={isExportingData || !isFirestoreAvailable}>
                <Users className="mr-2 h-4 w-4" />
                Exportar Participantes (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                <Gift className="mr-2 h-4 w-4" />
                Exportar Premios Reclamados (Próximamente)
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={handleAdminLogout} size="sm">
                <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
            </Button>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Participantes</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingTotalParticipants ? (
                <div className="flex items-center pt-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
                </div>
            ) : (
                <div className="text-2xl font-bold">{totalParticipants}</div>
            )}
            <p className="text-xs text-muted-foreground">Recuento real de la base de datos.</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Premios Reclamados</CardTitle>
            <BadgeCheck className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoadingClaimedPrizes ? (
                <div className="flex items-center pt-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
                </div>
            ) : (
                <div className="text-2xl font-bold">{claimedPrizesCount}</div>
            )}
            <p className="text-xs text-muted-foreground">Total de premios canjeados.</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas de Fraude</CardTitle>
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingFraudAlerts ? (
                <div className="flex items-center pt-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
                </div>
            ) : (
                <div className="text-2xl font-bold">{fraudAlertsCount}</div>
            )}
            <p className="text-xs text-muted-foreground">Total de envíos marcados como fraude.</p>
          </CardContent>
        </Card>
      </section>
      
      <section>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center gap-2">
                <Activity className="h-7 w-7 text-primary" />
                Actividad Reciente de Participantes
            </CardTitle>
            <CardDescription>
                Visualiza los últimos participantes y su actividad en el juego.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRecentActivity ? (
              <div className="flex items-center justify-center h-60">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-3 text-lg text-muted-foreground">Cargando actividad...</p>
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="max-h-[500px] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre Completo</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Premio Ganado</TableHead>
                      <TableHead>Registrado</TableHead>
                      <TableHead>Fecha Ganado</TableHead>
                      <TableHead>Válido Hasta</TableHead>
                      <TableHead>Canjeado</TableHead>
                      <TableHead>Verificado Por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentActivity.map((activity) => (
                      <TableRow key={activity.firestoreId}>
                        <TableCell className="font-medium">{activity.fullName}</TableCell>
                        <TableCell>{activity.phoneNumber}</TableCell>
                        <TableCell>{getPrizeStatusBadge(activity.latestGameWin)}</TableCell>
                        <TableCell>
                          {activity.latestGameWin?.prizeId?.includes('nada-') || activity.latestGameWin?.prizeId?.includes('no_prize')
                            ? <span className="text-muted-foreground italic">Sigue Intentando</span>
                            : activity.latestGameWin?.prizeName || <span className="text-muted-foreground italic">No ha jugado</span>
                          }
                        </TableCell>
                        <TableCell>{formatFirestoreTimestamp(activity.registeredAt)}</TableCell>
                        <TableCell>
                          {activity.latestGameWin ? formatFirestoreTimestamp(activity.latestGameWin.wonAt) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {activity.latestGameWin && !(activity.latestGameWin.prizeId?.includes('nada-') || activity.latestGameWin.prizeId?.includes('no_prize'))
                            ? formatFirestoreTimestamp(activity.latestGameWin.validUntil) 
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {activity.latestGameWin?.status === 'claimed' 
                            ? formatFirestoreTimestamp(activity.latestGameWin.claimedAt) 
                            : 'N/A'}
                        </TableCell>
                        <TableCell>{activity.latestGameWin?.status === 'claimed' ? activity.latestGameWin.verifiedBy : 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-10">
                {!isFirestoreAvailable ? "No se puede mostrar la actividad (Firestore no disponible)." : "No hay actividad reciente de participantes para mostrar."}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-headline flex items-center gap-2"><Settings className="h-7 w-7 text-primary"/>Configuración de la Promoción</CardTitle>
                <CardDescription>Define parámetros globales para la promoción.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoadingValidityDays && (
                    <div className="flex items-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                        <span>Cargando configuración...</span>
                    </div>
                )}
                {!isLoadingValidityDays && isFirestoreAvailable && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div>
                            <Label htmlFor="prizeValidityDays" className="flex items-center gap-1"><CalendarDays className="h-4 w-4"/> Días de Validez de Premios</Label>
                            <Input
                                id="prizeValidityDays"
                                type="number"
                                min="1"
                                value={prizeValidityDays}
                                onChange={(e) => setPrizeValidityDays(Math.max(1, parseInt(e.target.value, 10) || DEFAULT_PRIZE_VALIDITY_DAYS))}
                                disabled={isSavingValidityDays || !isFirestoreAvailable}
                                className="mt-1"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Número de días que un premio es válido después de ser ganado y generado el QR.</p>
                        </div>
                        <Button
                            onClick={handleSavePromoConfig}
                            disabled={isSavingValidityDays || !isFirestoreAvailable || prizeValidityDays <= 0}
                            className="w-full md:w-auto bg-primary hover:bg-primary/90"
                        >
                            {isSavingValidityDays ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Save className="mr-2 h-5 w-5" />}
                            Guardar Configuración
                        </Button>
                    </div>
                )}
                 {!isFirestoreAvailable && (
                    <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-5 w-5" />
                        <AlertTitle>Firestore No Disponible</AlertTitle>
                        <AlertDescription>La configuración no se puede cargar ni guardar.</AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
      </section>

      <section>
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-headline flex items-center gap-2"><UserCog className="h-7 w-7 text-primary"/>Gestionar Cuentas de Verificadores</CardTitle>
                <CardDescription>Crea y administra cuentas para el personal que verificará los códigos QR.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 {!isFirestoreAvailable && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-5 w-5" />
                        <AlertTitle>Firestore No Disponible</AlertTitle>
                        <AlertDescription>La gestión de verificadores no funcionará.</AlertDescription>
                    </Alert>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-3 text-foreground/90">Cuentas de Verificador Existentes</h3>
                        {isLoadingVerifiers && (
                            <div className="flex items-center justify-center h-32">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="ml-2 text-muted-foreground">Cargando verificadores...</p>
                            </div>
                        )}
                        {!isLoadingVerifiers && verifiers.length > 0 && isFirestoreAvailable ? (
                            <div className="max-h-80 overflow-y-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Usuario</TableHead>
                                            <TableHead>Creado</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {verifiers.map(verifier => (
                                            <TableRow key={verifier.firestoreId}>
                                                <TableCell className="font-medium">{verifier.username}</TableCell>
                                                <TableCell>{verifier.createdAt ? new Date(verifier.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteVerifier(verifier)} disabled={!isFirestoreAvailable}>
                                                        <Trash2 className="h-4 w-4" />
                                                        <span className="sr-only">Eliminar Verificador</span>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            !isLoadingVerifiers &&
                            <p className="text-muted-foreground text-center py-4">
                                {!isFirestoreAvailable ? "No se pueden mostrar (Firestore no disponible)." : "No hay cuentas de verificador."}
                            </p>
                        )}
                    </div>
                    <Card className="shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg font-headline flex items-center gap-2"><PlusCircle className="h-5 w-5 text-accent" />Crear Nuevo Verificador</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="newVerifierUsername" className="flex items-center gap-1"><User className="h-4 w-4"/>Nombre de Usuario</Label>
                                <Input id="newVerifierUsername" value={newVerifierUsername} onChange={e => setNewVerifierUsername(e.target.value)} disabled={isCreatingVerifier || !isFirestoreAvailable} />
                            </div>
                            <div>
                                <Label htmlFor="newVerifierPassword" className="flex items-center gap-1"><KeyRound className="h-4 w-4"/>Contraseña</Label>
                                <Input id="newVerifierPassword" type="password" value={newVerifierPassword} onChange={e => setNewVerifierPassword(e.target.value)} disabled={isCreatingVerifier || !isFirestoreAvailable} />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full bg-accent hover:bg-accent/90" onClick={handleCreateVerifier} disabled={isCreatingVerifier || !isFirestoreAvailable || !newVerifierUsername.trim() || !newVerifierPassword.trim()}>
                                {isCreatingVerifier ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlusCircle className="mr-2 h-5 w-5" />}
                                Crear Verificador
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </CardContent>
        </Card>
      </section>
      
      <section>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center gap-2">
              <RotateCcw className="h-7 w-7 text-destructive" />
              Mantenimiento de la Promoción
            </CardTitle>
            <CardDescription>
              Acciones para reiniciar o mantener los datos de la promoción. Usar con precaución.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <h3 className="text-lg font-semibold text-foreground/90">Reiniciar Datos de la Promoción</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Esta acción eliminará todos los participantes registrados, los premios ganados, los premios reclamados y las alertas de fraude.
                  Los premios definidos y las cuentas de verificador NO se eliminarán. <strong>Esta acción es irreversible.</strong>
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={handleOpenResetDialog}
                disabled={isResettingPromotion || !isFirestoreAvailable}
                className="w-full md:w-auto"
              >
                <AlertTriangle className="mr-2 h-5 w-5" />
                Reiniciar Todos los Datos de Participación
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center gap-2"><Gift className="h-7 w-7 text-primary" />Gestión de Premios</CardTitle>
            <CardDescription>Define los premios disponibles (máx. 10), su frecuencia (peso) y stock. La frecuencia indica qué tan probable es que salga el premio (mayor número = más frecuente).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isFirestoreAvailable && (
              <Alert variant="destructive">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>Error Crítico: Firestore No Disponible</AlertTitle>
                <AlertDescription>
                  La conexión con la base de datos (Firestore) no se ha podido establecer. La gestión de premios no funcionará.
                  Por favor, revisa tu configuración de Firebase (variables de entorno, reglas de Firestore) y la conexión a internet.
                </AlertDescription>
              </Alert>
            )}
             {!isStorageAvailable && isFirestoreAvailable && (
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-5 w-5" />
                    <AlertTitle>Error Crítico: Firebase Storage No Disponible</AlertTitle>
                    <AlertDescription>
                    La conexión con el almacenamiento de archivos (Firebase Storage) no se ha podido establecer. No podrás subir ni gestionar imágenes para los premios.
                    Por favor, revisa tu configuración de Firebase (especialmente NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET en .env y las reglas de Storage).
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-foreground/90">Lista de Premios Actuales ({currentPrizes.filter(p => p.id !== 'nada').length}/10)</h3>
                {isLoadingPrizes && (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Cargando premios...</p>
                  </div>
                )}
                {!isLoadingPrizes && currentPrizes.length > 0 && isFirestoreAvailable ? (
                  <div className="max-h-96 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Imagen</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Tipo (ID)</TableHead>
                          <TableHead>Frec.</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentPrizes.map((prize) => (
                          <TableRow key={prize.firestoreId}>
                            <TableCell>
                              {prize.imageUrl ? (
                                <div className="w-10 h-10 relative">
                                  <Image src={prize.imageUrl} alt={prize.name} fill={true} style={{ objectFit: 'contain' }} className="rounded" data-ai-hint="prize visual" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 flex items-center justify-center bg-muted rounded">
                                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{prize.name}</TableCell>
                            <TableCell>{prizeOptions.find(o => o.id === prize.id)?.name || prize.id}</TableCell>
                            <TableCell>{prize.frequency}</TableCell>
                            <TableCell className={cn(prize.stock === 0 && "text-destructive font-semibold")}>
                              {prize.stock}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="mr-1 text-muted-foreground hover:text-primary" onClick={() => handleOpenEditDialog(prize)} disabled={!isFirestoreAvailable || isSavingEditedPrize}>
                                <Edit3 className="h-4 w-4" />
                                <span className="sr-only">Editar</span>
                              </Button>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeletePrize(prize)} disabled={!isFirestoreAvailable || isSavingEditedPrize}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Eliminar</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  !isLoadingPrizes &&
                  <p className="text-muted-foreground text-center py-4">
                    {!isFirestoreAvailable ? "No se pueden mostrar premios (Firestore no disponible)." : "No hay premios definidos. ¡Añade el primero!"}
                  </p>
                )}
              </div>
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-headline flex items-center gap-2"><PlusCircle className="h-5 w-5 text-accent" />Añadir Nuevo Premio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="newPrizeName">Nombre del Premio</Label>
                    <Input id="newPrizeName" name="name" placeholder="Ej: 15% Descuento" value={newPrizeName} onChange={(e) => setNewPrizeName(e.target.value)} disabled={isSubmittingPrize || !isFirestoreAvailable} />
                  </div>
                  <div>
                    <Label htmlFor="newPrizeType">Tipo de Premio (ID Único)</Label>
                    <select id="newPrizeType" name="newPrizeType" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={newPrizeType} onChange={handleNewPrizeTypeChange} disabled={isSubmittingPrize || !isFirestoreAvailable}>
                        {prizeOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.name} ({option.id})</option>
                        ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">Este ID identifica unívocamente el premio.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="newPrizeFrequency">Frecuencia (Peso)</Label>
                      <Input id="newPrizeFrequency" name="frequency" type="number" min="1" placeholder={`Ej: ${DEFAULT_PRIZE_FREQUENCY}`} value={newPrizeFrequency} onChange={(e) => setNewPrizeFrequency(Math.max(1, parseInt(e.target.value, 10) || DEFAULT_PRIZE_FREQUENCY))} disabled={isSubmittingPrize || !isFirestoreAvailable} />
                      <p className="text-xs text-muted-foreground mt-1">Mayor = más frecuente.</p>
                    </div>
                    <div>
                      <Label htmlFor="newPrizeStock">Stock Inicial</Label>
                      <Input id="newPrizeStock" name="stock" type="number" min="0" placeholder={`Ej: ${DEFAULT_PRIZE_STOCK}`} value={newPrizeStock} onChange={(e) => setNewPrizeStock(Math.max(0, parseInt(e.target.value, 10) || DEFAULT_PRIZE_STOCK))} disabled={isSubmittingPrize || !isFirestoreAvailable} />
                       <p className="text-xs text-muted-foreground mt-1">Cantidad disponible.</p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="newPrizeImage">Imagen del Premio (Opcional)</Label>
                    <Input
                      id="newPrizeImage"
                      type="file"
                      accept="image/*"
                      ref={newPrizeFileInputRef}
                      onChange={handleNewPrizeImageChange}
                      className="file:text-primary file:font-medium"
                      disabled={isSubmittingPrize || !isFirestoreAvailable || !isStorageAvailable}
                    />
                    {newPrizeImagePreview && (
                      <div className="mt-2 relative w-24 h-24 border rounded-md p-1 aspect-square">
                        <Image src={newPrizeImagePreview} alt="Vista previa de nueva imagen" fill={true} style={{ objectFit: 'contain' }} data-ai-hint="prize visual"/>
                         <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 bg-destructive/80 hover:bg-destructive text-destructive-foreground rounded-full"
                            onClick={() => {
                                setNewPrizeImageFile(null);
                                setNewPrizeImagePreview(null);
                                if(newPrizeFileInputRef.current) newPrizeFileInputRef.current.value = "";
                            }}
                            disabled={isSubmittingPrize || !isFirestoreAvailable || !isStorageAvailable}
                          >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Eliminar imagen seleccionada</span>
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Sube una imagen para el premio.</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full bg-accent hover:bg-accent/90"
                    onClick={handleAddPrize}
                    disabled={
                      isSubmittingPrize ||
                      !isFirestoreAvailable ||
                      (newPrizeImageFile && !isStorageAvailable) ||
                      !newPrizeName.trim() ||
                      newPrizeFrequency <= 0 ||
                      newPrizeStock < 0 ||
                      currentPrizes.filter(p => p.id !== 'nada').length >= 10
                    }>
                    {isSubmittingPrize ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />}
                    {isSubmittingPrize ? "Añadiendo..." : "Añadir Premio"}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </CardContent>
        </Card>
      </section>

      <AlertDialog open={isResetPromotionDialogOpen} onOpenChange={setIsResetPromotionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              ¿Estás ABSOLUTAMENTE seguro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es <strong>irreversible</strong>. Se eliminarán todos los datos de los participantes,
              incluyendo registros, premios ganados, premios reclamados y alertas de fraude.
              <br /><br />
              Las definiciones de premios y las cuentas de verificador NO serán afectadas.
              <br /><br />
              Por favor, escribe <strong className="text-destructive">REINICIAR</strong> en el campo de abajo para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              id="resetConfirmation"
              value={resetConfirmationInput}
              onChange={(e) => setResetConfirmationInput(e.target.value)}
              placeholder="Escribe REINICIAR aquí"
              className={cn(resetConfirmationInput !== "REINICIAR" && "border-destructive focus-visible:ring-destructive")}
            />
            {resetConfirmationInput && resetConfirmationInput !== "REINICIAR" && (
              <p className="text-xs text-destructive mt-1">Debes escribir "REINICIAR" para habilitar el botón.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResettingPromotion}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmResetPromotion}
              disabled={isResettingPromotion || resetConfirmationInput !== "REINICIAR"}
              className={cn(
                "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
                (isResettingPromotion || resetConfirmationInput !== "REINICIAR") && "opacity-50 cursor-not-allowed"
              )}
            >
              {isResettingPromotion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {isResettingPromotion ? "Reiniciando..." : "Sí, Reiniciar Promoción"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Editar Premio</DialogTitle>
                <DialogDescription>
                    Modifica el nombre, tipo, frecuencia, stock y la imagen del premio.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editPrizeType" className="text-right">Tipo (ID)</Label>
                 <select id="editPrizeType" name="editPrizeType" className="col-span-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={editedPrizeType} onChange={handleEditedPrizeTypeChange} disabled={isSavingEditedPrize || !isFirestoreAvailable}>
                    {prizeOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.name} ({option.id})</option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editPrizeName" className="text-right">
                  Nombre
                </Label>
                <Input
                  id="editPrizeName"
                  value={editedPrizeName}
                  onChange={(e) => setEditedPrizeName(e.target.value)}
                  className="col-span-3"
                  disabled={isSavingEditedPrize || !isFirestoreAvailable}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editPrizeFrequency" className="text-right flex items-center gap-1"><TrendingUp className="h-4 w-4" />Frec.</Label>
                <Input
                  id="editPrizeFrequency"
                  type="number"
                  min="1"
                  value={editedPrizeFrequency}
                  onChange={(e) => setEditedPrizeFrequency(Math.max(1, parseInt(e.target.value, 10) || DEFAULT_PRIZE_FREQUENCY))}
                  className="col-span-3"
                  disabled={isSavingEditedPrize || !isFirestoreAvailable}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editPrizeStock" className="text-right flex items-center gap-1"><Package className="h-4 w-4" />Stock</Label>
                <Input
                  id="editPrizeStock"
                  type="number"
                  min="0"
                  value={editedPrizeStock}
                  onChange={(e) => setEditedPrizeStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="col-span-3"
                  disabled={isSavingEditedPrize || !isFirestoreAvailable}
                />
              </div>
               <div className="grid grid-cols-4 items-start gap-4">
                 <Label htmlFor="editPrizeImage" className="text-right pt-2">
                  Imagen
                </Label>
                <div className="col-span-3 space-y-2">
                  <Input
                    id="editPrizeImage"
                    type="file"
                    accept="image/*"
                    ref={editPrizeFileInputRef}
                    onChange={handleEditPrizeImageChange}
                    className="file:text-primary file:font-medium"
                    disabled={isSavingEditedPrize || !isFirestoreAvailable || !isStorageAvailable}
                  />
                  {editedPrizeImagePreview ? (
                    <div className="mt-2 relative w-24 h-24 border rounded-md p-1 aspect-square">
                      <Image src={editedPrizeImagePreview} alt="Vista previa de imagen editada" fill={true} style={{ objectFit: 'contain' }} data-ai-hint="prize visual"/>
                       <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 bg-destructive/80 hover:bg-destructive text-destructive-foreground rounded-full"
                        onClick={() => {
                            setEditedPrizeImageFile(null);
                            setEditedPrizeImagePreview(null);
                            if(editPrizeFileInputRef.current) editPrizeFileInputRef.current.value = "";
                        }}
                        disabled={isSavingEditedPrize || !isFirestoreAvailable || !isStorageAvailable}
                        >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Eliminar imagen</span>
                    </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No hay imagen o se eliminará.</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Sube una nueva imagen o elimina la actual.</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSavingEditedPrize}>Cancelar</Button>
              </DialogClose>
              <Button
                type="button"
                onClick={handleSaveChangesToPrize}
                disabled={
                  isSavingEditedPrize ||
                  !isFirestoreAvailable ||
                  (editedPrizeImageFile && !isStorageAvailable) ||
                  !editedPrizeName.trim() ||
                  editedPrizeFrequency <= 0 ||
                  editedPrizeStock < 0
                }>
                {isSavingEditedPrize ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}


    

    