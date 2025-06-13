// src/app/login/page.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, KeyRound, UserCircle } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-headline">¡Bienvenido de Nuevo!</CardTitle>
          <CardDescription>Inicia sesión para acceder a tu cuenta y continuar tu aventura en Sansol.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2"><UserCircle className="w-4 h-4 text-primary"/>Correo Electrónico o Usuario</Label>
            <Input id="email" type="email" placeholder="tu@ejemplo.com" disabled />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary"/>Contraseña</Label>
              <Link href="#" className="text-sm text-primary hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <Input id="password" type="password" placeholder="••••••••" disabled />
          </div>
           <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg py-6" disabled>
            Iniciar Sesión (Próximamente)
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <p className="text-sm text-muted-foreground">
            ¿No tienes una cuenta?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Regístrate aquí
            </Link>
          </p>
           <p className="text-xs text-muted-foreground pt-4">
            La funcionalidad de inicio de sesión se implementará con acceso basado en roles.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
