import React, { useLayoutEffect, useRef, useState } from 'react';
import { platform } from '@/platform';

/**
 * Largeur de référence du design : tout ce qui est écrit dans CompactApp.tsx
 * (tailles de police, paddings, hauteurs de boutons...) l'est pour cette
 * largeur-là. La hauteur de référence (500) ne sert qu'à Electron, dont la
 * fenêtre par défaut a exactement ce ratio (voir electron/main/main.ts).
 */
const DESIGN_WIDTH = 360;
const DESIGN_HEIGHT = 500;

/**
 * Sous Electron, le design garde un ratio fixe et se réduit/grossit en bloc
 * selon le plus petit des deux rapports largeur/hauteur : la fenêtre de
 * bureau est un petit utilitaire qu'on redimensionne à la souris, pas
 * question d'y faire déborder le contenu si elle devient large mais peu
 * haute.
 *
 * Ailleurs (Android, web), l'app est plein écran et n'a pas de ratio fixe à
 * respecter : le facteur d'échelle est calé sur la largeur réelle de
 * l'écran, et la hauteur de référence du canevas est recalculée à partir de
 * la hauteur réelle divisée par ce même facteur. Résultat : une fois mis à
 * l'échelle, le canevas occupe très exactement largeur ET hauteur réelles
 * — jamais de bande vide — et les éléments (police, boutons, paddings)
 * grossissent avec la largeur de l'écran au lieu de rester minuscules sur un
 * grand téléphone.
 *
 * `transform: scale`, jamais `zoom` : `zoom` n'est pas une propriété CSS
 * standard et son rendu s'est avéré peu fiable (le DOM se mesurait
 * correctement, l'affichage réel non) — `transform` est éprouvé, déjà
 * utilisé avec succès pour Electron.
 */
const AppStage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const fixedCanvas = platform.name === 'electron';
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [canvasHeight, setCanvasHeight] = useState(DESIGN_HEIGHT);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      const { width, height } = stage.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      if (fixedCanvas) {
        setScale(Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT));
        setCanvasHeight(DESIGN_HEIGHT);
      } else {
        const factor = width / DESIGN_WIDTH;
        setScale(factor);
        setCanvasHeight(height / factor);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    // Filet de sécurité : certains environnements (redimensionnement de
    // fenêtre, rotation d'écran) ne déclenchent pas toujours ResizeObserver
    // aussi fidèlement qu'un véritable événement `resize`.
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [fixedCanvas]);

  return <div ref={stageRef} className={`app-stage${fixedCanvas ? '' : ' app-stage--fill'}`}>
    <div className="app-canvas" style={{ width: DESIGN_WIDTH, height: canvasHeight, transform: `scale(${scale})` }}>
      {children}
    </div>
  </div>;
};

export default AppStage;
