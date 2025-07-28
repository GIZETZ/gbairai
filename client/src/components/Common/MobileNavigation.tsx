import { Link, useLocation } from "wouter";
import { MapPin, MessageSquare, Search, User, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useState, useEffect } from "react";

interface MobileNavigationProps {
  hideWhenCommentsOpen?: boolean;
}

export function MobileNavigation({ hideWhenCommentsOpen }: MobileNavigationProps) {
  const [location] = useLocation();
  const { theme } = useTheme();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Détecter l'ouverture du clavier virtuel avec une approche plus robuste
  useEffect(() => {
    let initialViewportHeight = window.visualViewport?.height || window.innerHeight;
    let timeoutId: NodeJS.Timeout;

    const handleViewportChange = () => {
      // Réinitialiser la hauteur de référence si nécessaire
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDifference = initialViewportHeight - currentHeight;
      
      // Délai pour éviter les faux positifs lors du redimensionnement
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Si la hauteur a diminué de plus de 100px, considérer que le clavier est ouvert
        setIsKeyboardOpen(heightDifference > 100);
      }, 100);
    };

    const handleFocusIn = (e: FocusEvent) => {
      // Si un élément de saisie reçoit le focus, considérer que le clavier va s'ouvrir
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        setTimeout(() => setIsKeyboardOpen(true), 300);
      }
    };

    const handleFocusOut = () => {
      // Délai avant de considérer que le clavier est fermé
      setTimeout(() => {
        const currentHeight = window.visualViewport?.height || window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        setIsKeyboardOpen(heightDifference > 100);
      }, 300);
    };

    // Utiliser visualViewport si disponible (plus précis sur mobile)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    } else {
      // Fallback pour les navigateurs plus anciens
      window.addEventListener('resize', handleViewportChange);
    }

    // Écouter les événements de focus pour détecter l'ouverture/fermeture du clavier
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      clearTimeout(timeoutId);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      } else {
        window.removeEventListener('resize', handleViewportChange);
      }
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // Ne pas afficher la navigation si hideWhenCommentsOpen est true OU si le clavier est ouvert
  if (hideWhenCommentsOpen || isKeyboardOpen) {
    return null;
  }

  // Vérifier si les commentaires sont ouverts en regardant les éléments DOM
  const commentsOpen = document.querySelector('.comments-overlay') || 
                      document.querySelector('.comment-form-overlay') ||
                      document.querySelector('.comments-card');
  
  if (commentsOpen) {
    return null;
  }

  const navItems = [
    { 
      href: "/", 
      icon: MessageSquare, 
      label: "Accueil", 
      active: location === "/" 
    },
    { 
      href: "/map", 
      icon: MapPin, 
      label: "Carte", 
      active: location === "/map" 
    },
    { 
      href: "/create", 
      icon: Plus, 
      label: "Publier", 
      active: location === "/create",
      isCreate: true
    },
    { 
      href: "/search", 
      icon: Search, 
      label: "Chercher", 
      active: location === "/search" 
    },
    { 
      href: "/profile", 
      icon: User, 
      label: "Profil", 
      active: location === "/profile" 
    },
  ];

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 border-t safe-area-pb mobile-nav-hide-on-keyboard",
      theme === "light" 
        ? "bg-white border-gray-200" 
        : "bg-gray-900 border-gray-700"
    )}>
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex flex-col items-center gap-1 h-auto py-2 px-3 transition-colors",
                  item.isCreate && "bg-blue-500 text-white hover:bg-blue-600 rounded-full",
                  item.active && !item.isCreate && "text-blue-500",
                  !item.active && !item.isCreate && (theme === "light" ? "text-gray-600" : "text-gray-300")
                )}
              >
                <Icon className={cn("w-5 h-5", item.isCreate && "text-white")} />
                <span className={cn(
                  "text-xs font-medium",
                  item.isCreate && "text-white"
                )}>
                  {item.label}
                </span>
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}