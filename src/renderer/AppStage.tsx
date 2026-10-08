import React, { useLayoutEffect, useRef, useState } from 'react';
import { platform } from '@/platform';

/**
 * Taille de référence de l'interface Electron — celle de la fenêtre par
 * défaut (voir electron/main/main.ts). N'a de sens que pour une fenêtre
 * de bureau, redimensionnable à la souris, pensée comme un petit utilitaire
 * compact : c'est pour ce cas précis que le design reste figé et mis à
 * l'échelle en bloc plutôt que de remplir l'espace disponible.
 */
const DESIGN_WIDTH = 360;
const DESIGN_HEIGHT = 500;

/**
 * Ancre le design de taille fixe dans la fenêtre réelle et l'agrandit ou le
 * réduit en bloc (`transform: scale`), jamais de reflow — mais uniquement
 * sous Electron. Une application Android plein écran n'est pas une fenêtre
 * qu'on redimensionne : un design figé y laisserait de larges bandes vides
 * dès que le ratio de l'écran s'éloigne de celui du design (quasiment
 * toujours, un téléphone étant bien plus allongé que 360×500). Android (et
 * le web) remplissent donc simplement tout l'espace disponible, comme avant
 * l'introduction de cette mise à l'échelle.
 */
const AppStage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const fixedCanvas = platform.name === 'electron';
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (!fixedCanvas) return;
    const stage = stageRef.current;
    if (!stage) return;

    const applyScale = () => {
      const { width, height } = stage.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setScale(Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT));
    };

    applyScale();
    const observer = new ResizeObserver(applyScale);
    observer.observe(stage);
    // Filet de sécurité : certains environnements (redimensionnement de
    // fenêtre, rotation d'écran) ne déclenchent pas toujours ResizeObserver
    // aussi fidèlement qu'un véritable événement `resize`.
    window.addEventListener('resize', applyScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', applyScale);
    };
  }, [fixedCanvas]);

  if (!fixedCanvas) {
    return <div className="app-stage app-stage--fill">{children}</div>;
  }

  return <div ref={stageRef} className="app-stage">
    <div className="app-canvas" style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})` }}>
      {children}
    </div>
  </div>;
};

export default AppStage;
