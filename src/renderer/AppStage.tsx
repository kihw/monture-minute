import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * Taille de référence de l'interface — celle de la fenêtre Electron par
 * défaut (voir electron/main/main.ts). Tout le reste de l'UI est écrit pour
 * cette taille exacte ; ici, on ne fait que la mettre à l'échelle.
 */
const DESIGN_WIDTH = 360;
const DESIGN_HEIGHT = 500;

/**
 * Ancre un design de taille fixe dans la fenêtre réelle et l'agrandit ou le
 * réduit en bloc (`transform: scale`) selon l'espace disponible — jamais de
 * reflow : aucun élément ne se déplace ni ne se réorganise, tout rétrécit ou
 * grossit ensemble. Nécessaire aussi bien pour une fenêtre Electron
 * redimensionnée que pour les tailles d'écran Android, très variables.
 */
const AppStage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
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
  }, []);

  return <div ref={stageRef} className="app-stage">
    <div className="app-canvas" style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})` }}>
      {children}
    </div>
  </div>;
};

export default AppStage;
