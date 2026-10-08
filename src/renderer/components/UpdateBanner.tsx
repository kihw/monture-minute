import React, { useEffect, useRef, useState } from 'react';
import { platform } from '@/platform';
import { CURRENT_VERSION } from '@/core/version';
import { decideUpdate, releaseNotesLines, findAsset, UpdateCheckResult } from '@/core/updateEngine';
import { AppSettings } from '@/types/enclosure';

interface UpdateBannerProps {
  settings: AppSettings;
  setSettings: (updater: (prev: AppSettings) => AppSettings) => void;
}

type ViewState = 'idle' | 'checking' | 'up-to-date' | 'available' | 'opening' | 'error';

/**
 * Vit dans la barre de titre : une icône discrète (avec un point quand une
 * mise à jour est réellement disponible) qui déplie un panneau de détail au
 * clic, sans jamais pousser le contenu de l'enclos.
 *
 * Indépendant du moteur de boucles d'élevage : un échec ici n'affecte jamais
 * l'élevage, et réciproquement. Pas d'installation silencieuse — la
 * plateforme ouvre l'asset via le mécanisme du système, l'utilisateur
 * termine lui-même l'installation.
 */
const UpdateBanner: React.FC<UpdateBannerProps> = ({ settings, setSettings }) => {
  const [view, setView] = useState<ViewState>('idle');
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [open, setOpen] = useState(false);
  const checkedOnMount = useRef(false);

  const check = async (manual: boolean) => {
    setView('checking');
    const release = await platform.updates.fetchLatestRelease();
    const decision = decideUpdate(CURRENT_VERSION, release);
    setResult(decision);

    if (decision.reason === 'mise-a-jour-disponible') {
      // Déjà reportée pour cette version précise : ne pas re-déranger à
      // chaque lancement, mais une version plus récente encore repasse devant.
      if (!manual && settings.dismissedUpdateVersion === decision.latestVersion) {
        setView('idle');
        return;
      }
      setView('available');
      setOpen(true); // une vraie nouveauté mérite d'être signalée, pas juste le point
      return;
    }

    if (decision.reason === 'a-jour' || decision.reason === 'version-installee-plus-recente') {
      setView(manual ? 'up-to-date' : 'idle');
      if (manual) setOpen(true);
      return;
    }

    // 'release-invalide' / 'erreur-reseau' : jamais imposé au lancement silencieux.
    setView(manual ? 'error' : 'idle');
    if (manual) setOpen(true);
  };

  useEffect(() => {
    if (!platform.updates.supported || checkedOnMount.current) return;
    checkedOnMount.current = true;
    void check(false);
  }, []);

  if (!platform.updates.supported) return null;

  const dismiss = () => {
    if (result?.latestVersion) {
      const dismissed = result.latestVersion;
      setSettings(prev => ({ ...prev, dismissedUpdateVersion: dismissed }));
    }
    setView('idle');
    setOpen(false);
  };

  const openUpdate = () => {
    if (!result?.release) return;
    const asset = findAsset(result.release, name => name.endsWith('.exe')) ?? findAsset(result.release, name => name.endsWith('.apk'));
    if (!asset) {
      setView('error');
      return;
    }
    setView('opening');
    platform.updates.openAsset(asset);
    window.setTimeout(() => setView('available'), 1_200);
  };

  const toggle = () => {
    if (view === 'idle') { void check(true); return; }
    setOpen(o => !o);
  };

  const hasAlert = view === 'available';

  return <div className="compact-update-wrap">
    <button
      className={`compact-update-trigger${hasAlert ? ' has-update' : ''}`}
      onClick={toggle}
      disabled={view === 'checking'}
      aria-label="Vérifier les mises à jour"
      title="Vérifier les mises à jour"
      aria-expanded={open}
    >
      ⟳{hasAlert && <span className="compact-update-dot" aria-hidden="true" />}
    </button>

    {open && view === 'up-to-date' && <div className="compact-update-panel compact-update--ok">
      <span>✓ Vous utilisez la dernière version.</span>
      <button onClick={() => setOpen(false)} aria-label="Fermer">×</button>
    </div>}

    {open && view === 'error' && <div className="compact-update-panel compact-update--error">
      <span>Impossible d’effectuer la vérification. Vous pouvez continuer à utiliser l’application.</span>
      <div className="compact-update-actions">
        <button onClick={() => void check(true)}>Réessayer</button>
        <button onClick={() => setOpen(false)}>Fermer</button>
      </div>
    </div>}

    {open && (view === 'available' || view === 'opening') && result?.release && <div className="compact-update-panel compact-update--available">
      <div className="compact-update-title">🚀 Nouvelle version disponible</div>
      <div className="compact-update-versions">{result.currentVersion} → {result.latestVersion}</div>
      {releaseNotesLines(result.release).slice(0, 3).length > 0 && <ul className="compact-update-notes">
        {releaseNotesLines(result.release).slice(0, 3).map((line, i) => <li key={i}>{line}</li>)}
      </ul>}
      <div className="compact-update-actions">
        <button className="compact-update-primary" onClick={openUpdate} disabled={view === 'opening'}>
          {view === 'opening' ? 'Ouverture…' : 'Mettre à jour'}
        </button>
        <button onClick={dismiss}>Plus tard</button>
      </div>
    </div>}
  </div>;
};

export default UpdateBanner;
