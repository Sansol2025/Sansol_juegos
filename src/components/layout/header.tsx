// src/components/layout/header.tsx
"use client";

import Link from 'next/link';
import { Gamepad2, Home, LayoutDashboard, LogIn, ScanLine, UserPlus, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/register', label: 'Registrarse', icon: UserPlus },
  { href: '/play', label: 'Jugar', icon: Gamepad2 },
  { href: '/verify', label: 'Verificar QR', icon: ScanLine },
  { href: '/admin', label: 'Admin', icon: LayoutDashboard },
  { href: '/login', label: 'Acceder', icon: LogIn },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const NavLink = ({ href, label, icon: Icon, onClick }: { href: string, label: string, icon: React.ElementType, onClick?: () => void }) => {
    const isActive = pathname === href;

    return (
      <Link href={href} passHref legacyBehavior>
        <a
          onClick={onClick}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            "hover:bg-primary/10 hover:text-primary",
            isActive
              ? "text-primary font-semibold bg-primary/10"
              : "text-foreground/80"
          )}
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </a>
      </Link>
    );
  };

  return (
    <header className="bg-background/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" passHref>
            <span className="text-2xl font-bold font-headline text-primary cursor-pointer">
              Sansol
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <NavLink key={item.label} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </nav>

          {/* Mobile Navigation Trigger */}
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Abrir menú</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] bg-background p-4 flex flex-col">
                <SheetHeader className="mb-4">
                  <div className="flex justify-between items-center">
                    <SheetTitle asChild>
                      <Link href="/" passHref>
                        <span className="text-xl font-bold font-headline text-primary cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                          Sansol
                        </span>
                      </Link>
                    </SheetTitle>
                    <SheetClose asChild>
                       <Button variant="ghost" size="icon">
                          <X className="h-6 w-6" />
                          <span className="sr-only">Cerrar menú</span>
                        </Button>
                    </SheetClose>
                  </div>
                  <SheetDescription className="text-left text-xs text-muted-foreground">
                    Menú de navegación principal.
                  </SheetDescription>
                </SheetHeader>
                <nav className="flex flex-col space-y-2 flex-grow">
                  {navItems.map((item) => (
                    <NavLink key={item.label} href={item.href} label={item.label} icon={item.icon} onClick={() => setMobileMenuOpen(false)} />
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
