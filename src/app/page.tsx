
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Gift, Users } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] py-12">
      <section className="text-center">
        <h1 className="text-5xl md:text-6xl font-bold font-headline tracking-tight">
          ¡Bienvenido a <span className="text-primary">Sansol</span>!
        </h1>
        <p className="mt-6 text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto">
          Prepárate para jugar emocionantes juegos, superar la trivia y ganar premios increíbles de tu tienda favorita, Sansol.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-transform hover:scale-105">
            <Link href="/register">
              <Users className="mr-2 h-5 w-5" /> Comenzar
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="text-primary border-primary hover:bg-primary/10 shadow-lg transition-transform hover:scale-105">
            <Link href="/play">
              <Gamepad2 className="mr-2 h-5 w-5" /> Jugar
            </Link>
          </Button>
        </div>
      </section>

      <section className="mt-20 w-full max-w-4xl">
        <h2 className="text-3xl font-bold text-center mb-10 font-headline">Cómo Funciona</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="items-center text-center">
              <div className="p-3 rounded-full bg-accent/20 text-accent mb-3">
                <Users className="h-8 w-8" />
              </div>
              <CardTitle className="font-headline">1. Regístrate</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription>
                Regístrate rápidamente con tu nombre y número de teléfono para unirte a la diversión.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="items-center text-center">
               <div className="p-3 rounded-full bg-accent/20 text-accent mb-3">
                <Gamepad2 className="h-8 w-8" />
              </div>
              <CardTitle className="font-headline">2. Juega Trivia y Revela</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription>
                Pon a prueba tus conocimientos en nuestra Trivia Sansol y luego revela tu premio para tener la oportunidad de ganar.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="items-center text-center">
              <div className="p-3 rounded-full bg-accent/20 text-accent mb-3">
                <Gift className="h-8 w-8" />
              </div>
              <CardTitle className="font-headline">3. Gana Premios</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription>
                Gana premios emocionantes y canjéalos en Sansol usando un código QR único.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
