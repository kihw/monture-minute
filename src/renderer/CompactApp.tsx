import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from './hooks/useAppState';
import { GaugeId, MountStat, Tier } from '@/types/breeding';
import { STAT_LABELS, STAT_MAX, SERENITY_MIN, SERENITY_MAX } from '@/core/breedingRules';
import { startTimer, upsertEnclosureTimer, formatDuration, getRemainingSeconds, getOverdueSeconds, enclosureTimerForDisplay, enclosuresWithFinishedTimer } from '@/core/timerEngine';
import { createEnclosure, createMount, Enclosure } from '@/types/enclosure';
import { statFields, planAction } from '@/core/enclosureRules';
import { MOUNT_XP_BY_LEVEL, mountLevelForXp } from '@/core/mountExperience';
import { platform } from '@/platform';
import { evaluate, startLoopInstance, pauseLoopInstance } from '@/core/loopEngine/engine';
import { STRATEGY_CATALOG, BREEDING_STRATEGY } from '@/core/loopEngine/catalog';
import UpdateBanner from './components/UpdateBanner';
import brandIcon from '../../assets/monture-minute.png';

const MOUNT_XP_MAX = MOUNT_XP_BY_LEVEL[MOUNT_XP_BY_LEVEL.length - 1];

const electronApi = typeof window !== 'undefined' ? window.electronAPI : undefined;

const ACTIONS: { stat: MountStat; label: string; gauge: GaugeId; color: string }[] = [
  { stat: 'serenity', label: 'Sérénité', gauge: 'baffeur', color: '#a855f7' },
  { stat: 'endurance', label: 'Endurance', gauge: 'foudroyeur', color: '#f5c518' },
  { stat: 'love', label: 'Amour', gauge: 'dragofesse', color: '#fb7185' },
  { stat: 'maturity', label: 'Maturité', gauge: 'abreuvoir', color: '#38bdf8' },
  { stat: 'xp', label: 'XP', gauge: 'mangeoire', color: '#a3e635' },
];

const DEFAULT_COMPACT_TIERS: Record<MountStat, Tier> = { serenity: 1, endurance: 1, love: 1, maturity: 1, xp: 1 };
const enclosureTiers = (enclosure: Enclosure): Record<MountStat, Tier> => ({ ...DEFAULT_COMPACT_TIERS, ...enclosure.compactTiers });


const ActionIcon: React.FC<{ gauge: GaugeId; color: string }> = ({ gauge, color }) => {
  if (gauge === 'mangeoire') return <span className="action-icon action-icon--xp" style={{ color }}>XP</span>;
  if (gauge === 'baffeur') return <span className="action-icon action-icon--serenity" style={{ color }}>+/-</span>;
  const paths: Record<Exclude<GaugeId, 'mangeoire'>, React.ReactNode> = {
    baffeur: <path d="M6 12h12" />,
    caresseur: <path d="M12 6v12M6 12h12" />,
    foudroyeur: <path className="action-icon__solid" d="M13.3 2.8 5.7 13h5.5l-.6 8.2L18.4 11h-5.7z" />,
    abreuvoir: <path className="action-icon__solid" d="M12 2.8c2.7 3.4 6.1 7.5 6.1 10.9a6.1 6.1 0 1 1-12.2 0C5.9 10.3 9.3 6.2 12 2.8Z" />,
    dragofesse: <path className="action-icon__solid" d="M12 21 4.5 13.6a4.6 4.6 0 0 1 6.5-6.5l1 1 1-1a4.6 4.6 0 0 1 6.5 6.5Z" />,
  };
  return <span className="action-icon" style={{ color }}><svg viewBox="0 0 24 24" aria-hidden="true">{paths[gauge]}</svg></span>;
};

const CompactValue: React.FC<{ label: string; value: number; min: number; max: number; disabled?: boolean; resetKey?: string | number; onChange: (value: number) => void }> = ({ label, value, min, max, disabled, resetKey, onChange }) => {
  const [draft, setDraft] = useState<string | null>(null);
  // Un changement externe de `value` (ex. la stratégie assistée bascule sur
  // une autre jauge) ne doit jamais laisser un brouillon obsolète affiché à
  // l'écran : sans ça, le champ prétend une valeur jamais réellement écrite.
  // `resetKey` (la jauge concernée) est nécessaire en plus de `value` : deux
  // jauges différentes peuvent coïncidemment partager la même valeur (0→0),
  // ce que `value` seul ne détecterait pas comme un changement.
  useEffect(() => setDraft(null), [value, resetKey]);
  const commit = () => {
    if (draft !== null) {
      const parsed = Number(draft);
      onChange(Number.isFinite(parsed) && draft.trim() !== '' ? parsed : value);
      setDraft(null);
    }
  };
  return <label className={`compact-value-field compact-value-field--${label.toLowerCase().replace(/\s+/g, '-')}`}>
    <span>{label}</span>
    <input
      type="number" min={min} max={max} step={100} value={draft ?? value} disabled={disabled}
      onChange={e => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw !== '' && raw !== '-' && Number.isFinite(Number(raw))) onChange(Number(raw));
      }}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
      aria-label={label}
    />
  </label>;
};

const CompactLevelInput: React.FC<{ value: number; disabled?: boolean; onChange: (value: number) => void }> = ({ value, disabled, onChange }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) && draft.trim() !== '' ? Math.max(1, Math.min(200, Math.round(parsed))) : value;
    setDraft(String(next));
    onChange(next);
  };
  return <input className="compact-level-input" type="number" min={1} max={200} step={1} value={draft} disabled={disabled} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-label="Niveau cible" />;
};

const CompactDualRange: React.FC<{ current: number; target: number; min: number; max: number; accent: string; lockTarget?: boolean; onCurrent: (value: number) => void; onTarget: (value: number) => void }> = ({ current, target, min, max, accent, lockTarget, onCurrent, onTarget }) => {
  const pct = (value: number) => `${((value - min) / (max - min)) * 100}%`;
  const trackRef = useRef<HTMLDivElement>(null);
  const draggedThumb = useRef<'current' | 'target' | null>(null);
  const low = pct(Math.min(current, target));
  const high = pct(Math.max(current, target));
  const isLocked = (thumb: 'current' | 'target') => thumb === 'target' && !!lockTarget;
  const updateAt = (clientX: number, thumb = draggedThumb.current) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !thumb) return;
    if (isLocked(thumb)) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const snapped = Math.max(min, Math.min(max, Math.round((min + ratio * (max - min)) / 100) * 100));
    (thumb === 'current' ? onCurrent : onTarget)(snapped);
  };
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-thumb]')?.dataset.thumb as 'current' | 'target' | undefined;
    const ratio = Math.max(0, Math.min(1, (event.clientX - event.currentTarget.getBoundingClientRect().left) / event.currentTarget.getBoundingClientRect().width));
    const clickedValue = min + ratio * (max - min);
    const resolved = handle ?? (Math.abs(clickedValue - current) <= Math.abs(clickedValue - target) ? 'current' : 'target');
    if (isLocked(resolved)) return;
    draggedThumb.current = resolved;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateAt(event.clientX);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggedThumb.current) updateAt(event.clientX);
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    draggedThumb.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onThumbKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, thumb: 'current' | 'target') => {
    if (isLocked(thumb)) return;
    const value = thumb === 'current' ? current : target;
    const change = thumb === 'current' ? onCurrent : onTarget;
    const step = event.shiftKey ? 1000 : 100;
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = value + step;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = value - step;
    if (event.key === 'Home') next = min;
    if (event.key === 'End') next = max;
    if (next !== null) {
      event.preventDefault();
      change(Math.max(min, Math.min(max, next)));
    }
  };
  return <div ref={trackRef} className="compact-dual-slider" style={{ '--range-current': pct(current), '--range-target': pct(target), '--range-start': low, '--range-end': high, '--range-accent': accent } as React.CSSProperties} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
    <div className="compact-dual-track" />
    <div className="compact-dual-thumb compact-dual-thumb--current" data-thumb="current" role="slider" tabIndex={0} aria-label="Valeur actuelle curseur" aria-valuemin={min} aria-valuemax={max} aria-valuenow={current} onKeyDown={e => onThumbKeyDown(e, 'current')} />
    <div className="compact-dual-thumb compact-dual-thumb--target" data-thumb="target" role="slider" tabIndex={lockTarget ? -1 : 0} aria-disabled={lockTarget} aria-label="Valeur cible curseur" aria-valuemin={min} aria-valuemax={max} aria-valuenow={target} onKeyDown={e => onThumbKeyDown(e, 'target')} />
  </div>;
};

const CompactApp: React.FC = () => {
  const { ready, enclosures, selectedEnclosureId, setSelectedEnclosureId, timers, setTimers, setEnclosures, settings, setSettings } = useAppState();
  const [, tick] = useState(0);
  const audioContext = useRef<AudioContext | null>(null);
  const runningTimerIds = useRef(new Set<string>());
  const index = Math.max(0, enclosures.findIndex(e => e.id === selectedEnclosureId));
  const enclosure = enclosures[index];
  const manualStat = enclosure?.compactStat ?? 'serenity';
  const tierFor = (s: MountStat): Tier => enclosure?.compactTiers?.[s] ?? 1;

  // Réévalué à chaque rendu : jamais de progression supposée, toujours l'état réel.
  const loopInstance = enclosure?.loopInstance ?? null;
  const loopResult = enclosure?.mount ? evaluate(enclosure.mount, loopInstance, STRATEGY_CATALOG, tierFor) : null;
  // La stratégie pilote la jauge/cible tant qu'elle tourne et a une action à proposer ;
  // en pause, terminée ou sans monture, l'utilisateur garde la main entière.
  const assisted = loopInstance?.status === 'running' && !!loopResult?.decision.action;
  const isAssistedOn = loopInstance?.status === 'running';
  const strategyStatusText = (() => {
    if (!loopResult || loopInstance === null) return null;
    switch (loopResult.decision.reason) {
      case 'objectif-non-atteint': return `🧭 Conseillé : ${loopResult.decision.stepLabel}`;
      case 'boucle-terminee': return '✓ Stratégie terminée';
      case 'boucle-en-pause': return 'En pause';
      case 'boucle-interrompue': return 'Interrompue';
      case 'donnees-manquantes': return 'Stratégie indisponible';
    }
  })();
  const stat = assisted ? loopResult!.decision.action!.stat : manualStat;
  const tier = tierFor(stat);
  const requestedAction = ACTIONS.find(item => item.stat === stat) ?? ACTIONS[0];

  useEffect(() => {
    if (ready && enclosure && !enclosure.mount) {
      setEnclosures(prev => prev.map((item, i) => item.id === enclosure.id ? { ...item, mount: createMount(`Monture ${i + 1}`) } : item));
    }
  }, [ready, enclosure?.id, enclosure?.mount, setEnclosures]);

  const timer = enclosure ? enclosureTimerForDisplay(timers, enclosure.id) : null;
  const finishedTimerEnclosureIds = enclosuresWithFinishedTimer(timers);
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => tick(n => n + 1), 500);
    return () => clearInterval(id);
  }, [timer?.id, timer?.endAt]);

  const unlockTimerSound = () => {
    if (typeof window === 'undefined' || !window.AudioContext) return;
    try {
      audioContext.current ??= new window.AudioContext();
      if (audioContext.current.state === 'suspended') void audioContext.current.resume();
    } catch { /* Le minuteur reste utilisable si le périphérique audio est indisponible. */ }
  };

  useEffect(() => {
    const previousRunning = runningTimerIds.current;
    if (settings.timerSound && audioContext.current?.state === 'running') {
      const justFinished = timers.filter(item => item.status === 'finished' && previousRunning.has(item.id));
      if (justFinished.length > 0) {
        const context = audioContext.current;
        justFinished.forEach((_item, index) => {
          const startAt = context.currentTime + index * 0.62;
          [659.25, 783.99, 987.77].forEach((frequency, note) => {
            const oscillator = context.createOscillator();
            const volume = context.createGain();
            const noteAt = startAt + note * 0.14;
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, noteAt);
            volume.gain.setValueAtTime(0.0001, noteAt);
            volume.gain.exponentialRampToValueAtTime(0.12, noteAt + 0.025);
            volume.gain.exponentialRampToValueAtTime(0.0001, noteAt + 0.48);
            oscillator.connect(volume);
            volume.connect(context.destination);
            oscillator.start(noteAt);
            oscillator.stop(noteAt + 0.5);
          });
        });
      }
    }
    runningTimerIds.current = new Set(timers.filter(item => item.status === 'running').map(item => item.id));
  }, [timers, settings.timerSound]);

  if (!ready) return <div className="compact-loading">Chargement…</div>;
  if (!enclosure) return <div className="compact-loading">Aucun enclos disponible.</div>;

  const mount = enclosure.mount;
  const manualPlan = mount ? planAction(mount, stat, tier) : null;
  // En mode assisté, la décision du moteur fait foi pour l'affichage (elle
  // peut viser une cible différente de celle saisie à la main, ex. le
  // plancher -5 000 d'une régulation de sérénité) ; sinon, le plan manuel habituel.
  const direction = assisted ? loopResult!.decision.action!.direction : manualPlan?.direction;
  const current = assisted ? (loopResult!.decision.currentValue ?? 0) : (manualPlan?.current ?? 0);
  const target = assisted ? (loopResult!.decision.targetValue ?? 0) : (manualPlan?.target ?? 0);
  const action = stat === 'serenity'
    ? { ...requestedAction, gauge: direction === 'decrease' ? 'baffeur' as const : 'caresseur' as const, label: direction === 'decrease' ? 'Sérénité −' : 'Sérénité +' }
    : requestedAction;
  const min = stat === 'serenity' ? SERENITY_MIN : 0;
  const max = stat === 'serenity' ? SERENITY_MAX : stat === 'xp' ? MOUNT_XP_MAX : STAT_MAX;
  const currentLevel = stat === 'xp' ? mountLevelForXp(current) : 1;
  const targetLevel = stat === 'xp' ? mountLevelForXp(target) : 1;
  const directionOkay = assisted ? true : (manualPlan?.directionOkay ?? false);
  const duration = assisted ? loopResult!.decision.estimatedDurationSeconds : (manualPlan?.durationSeconds ?? 0);
  const remaining = timer ? getRemainingSeconds(timer) : duration;
  const overdue = timer?.status === 'finished' ? getOverdueSeconds(timer) : 0;
  const selected = action;
  const setStatValue = (field: 'current' | 'target', raw: number) => {
    if (!mount) return;
    const key = statFields(stat)[field === 'current' ? 'value' : 'target'];
    const next = Math.max(min, Math.min(max, Math.round(raw / 100) * 100));
    setEnclosures(prev => prev.map(item => item.id === enclosure.id ? { ...item, mount: { ...mount, [key]: next } } : item));
  };
  /** Le tier reflète l'équipement réel : réglable dans les deux modes, y compris en Assisté. */
  const setTier = (nextTier: Tier) => {
    setEnclosures(prev => prev.map(current => current.id === enclosure.id ? { ...current, compactTiers: { ...enclosureTiers(current), [stat]: nextTier } } : current));
  };
  /** Déclaratif, jamais déduit d'un seuil : au joueur de dire si cette monture n'a plus besoin de régulation. */
  const setSerenityEquilibrated = (value: boolean) => {
    if (!mount) return;
    setEnclosures(prev => prev.map(item => item.id === enclosure.id && item.mount ? { ...item, mount: { ...item.mount, serenityEquilibrated: value } } : item));
  };
  /**
   * Toujours modifiable, même en mode assisté verrouillé sur une autre
   * jauge : la sérénité réelle peut dériver en jeu pendant que la stratégie
   * travaille Endurance/Maturité/Amour, et le joueur doit pouvoir la tenir à
   * jour sans d'abord devoir déverrouiller quoi que ce soit.
   */
  const setSerenityCurrent = (raw: number) => {
    if (!mount) return;
    const next = Math.max(SERENITY_MIN, Math.min(SERENITY_MAX, Math.round(raw / 100) * 100));
    setEnclosures(prev => prev.map(item => item.id === enclosure.id && item.mount ? { ...item, mount: { ...item.mount, serenity: next } } : item));
  };
  const setXpTargetLevel = (level: number) => {
    if (!mount) return;
    const key = statFields('xp').target;
    setEnclosures(prev => prev.map(item => item.id === enclosure.id ? { ...item, mount: { ...mount, [key]: MOUNT_XP_BY_LEVEL[Math.max(1, Math.min(200, level)) - 1] } } : item));
  };
  const setXpTargetFromSlider = (xp: number) => {
    let closestLevel = 1;
    for (let i = 1; i < MOUNT_XP_BY_LEVEL.length; i++) {
      if (Math.abs(MOUNT_XP_BY_LEVEL[i] - xp) < Math.abs(MOUNT_XP_BY_LEVEL[closestLevel - 1] - xp)) closestLevel = i + 1;
    }
    setXpTargetLevel(closestLevel);
  };
  const addEnclosure = () => {
    const id = `enclos-${Date.now().toString(36)}`;
    const next = createEnclosure(`Enclos ${enclosures.length + 1}`, id, Date.now());
    next.mount = createMount(`Monture ${enclosures.length + 1}`);
    setEnclosures(prev => [...prev, next]);
    setSelectedEnclosureId(id);
  };
  const removeEnclosure = () => {
    if (enclosures.length <= 1) return;
    const removedTimer = timer;
    const nextList = enclosures.filter(item => item.id !== enclosure.id);
    setEnclosures(nextList);
    setSelectedEnclosureId(nextList[Math.max(0, index - 1)].id);
    setTimers(prev => prev.filter(item => item.enclosureId !== enclosure.id));
    if (removedTimer) platform.timers.cancel(removedTimer.id);
  };
  /**
   * « Lancer » : si la stratégie recommande une action, on commit d'abord sa
   * jauge/cible (comme si l'utilisateur venait de les choisir à la main),
   * puis on démarre le minuteur normalement — un seul geste, jamais un
   * « Suivant » séparé à cliquer avant de pouvoir lancer quoi que ce soit.
   */
  const start = () => {
    if (assisted && loopResult?.decision.action && mount) {
      const { action, targetValue } = loopResult.decision;
      const fields = statFields(action.stat);
      setEnclosures(prev => prev.map(item => item.id === enclosure.id && item.mount
        ? { ...item, compactStat: action.stat, loopInstance: loopResult.instance, mount: { ...item.mount, [fields.target]: targetValue ?? item.mount[fields.target] } }
        : item));
    }
    const next = startTimer({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      enclosureId: enclosure.id,
      title: selected.label,
      description: `${STAT_LABELS[selected.stat]} · Tier ${tier}`,
      durationSeconds: duration,
    });
    setTimers(prev => upsertEnclosureTimer(prev, next));
    platform.timers.schedule(next);
  };
  const stop = () => {
    if (!timer) return;
    setTimers(prev => prev.filter(item => item.id !== timer.id));
    platform.timers.cancel(timer.id);
  };

  /**
   * Bascule explicite : jamais de retour silencieux au manuel sur simple
   * édition d'une valeur. Avant de reprendre, on sonde ce que donnerait la
   * reprise (statut forcé à « running ») : une instance dont la référence
   * est devenue invalide (catalogue modifié) ou déjà terminée ne doit jamais
   * laisser l'utilisateur bloqué sur « Stratégie indisponible » sans issue —
   * on repart alors d'une instance fraîche plutôt que de la reprendre telle quelle.
   */
  const enableAssist = () => {
    const current = enclosure.loopInstance;
    const probe = mount && current ? evaluate(mount, { ...current, status: 'running' }, STRATEGY_CATALOG, tierFor) : null;
    const resumable = probe && probe.decision.reason !== 'donnees-manquantes' && probe.decision.reason !== 'boucle-terminee';
    const next = resumable ? probe!.instance : startLoopInstance(BREEDING_STRATEGY);
    setEnclosures(prev => prev.map(item => item.id === enclosure.id ? { ...item, loopInstance: next } : item));
  };
  const disableAssist = () => {
    if (!enclosure.loopInstance) return;
    const paused = pauseLoopInstance(enclosure.loopInstance);
    setEnclosures(prev => prev.map(item => item.id === enclosure.id ? { ...item, loopInstance: paused } : item));
  };

  return <div className="compact-app" onPointerDownCapture={unlockTimerSound} style={{ '--compact-accent': selected.color } as React.CSSProperties}>
    <header className="compact-titlebar">
      <img className="compact-brand-mark" src={brandIcon} alt="" />
      <span className="compact-title">{enclosure.name}</span>
      <UpdateBanner settings={settings} setSettings={setSettings} />
      <button className={`compact-sound-toggle${settings.timerSound ? ' is-enabled' : ''}`} onClick={() => setSettings(prev => ({ ...prev, timerSound: !prev.timerSound }))} aria-label={settings.timerSound ? 'Désactiver la sonnerie' : 'Activer la sonnerie'} title={settings.timerSound ? 'Sonnerie activée — cliquer pour couper' : 'Sonnerie désactivée — cliquer pour activer'} aria-pressed={settings.timerSound}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l5 4V6l-5 4H4Z" /><path className="compact-sound-wave" d="M16 9a4 4 0 0 1 0 6m2-9a7 7 0 0 1 0 12" />{!settings.timerSound && <path className="compact-sound-slash" d="m16 9 5 6m0-6-5 6" />}</svg>
      </button>
      {electronApi && <button className="compact-window-control" onClick={() => electronApi.window.minimize()} aria-label="Réduire" title="Réduire">−</button>}
      {electronApi && <button className="compact-close" onClick={() => electronApi.window.hide()} aria-label="Masquer">×</button>}
    </header>

    <div className="compact-content">
      <div className="compact-enclosure-select" role="tablist" aria-label="Choisir un enclos">
        <span className="compact-caption">ENCLOS</span>
        <div className="compact-enclosures">
          {enclosures.map((item, i) => <button key={item.id} role="tab" aria-selected={item.id === enclosure.id} className={item.id === enclosure.id ? 'is-selected' : ''} onClick={() => setSelectedEnclosureId(item.id)} title={item.name}>
            {i + 1}
            {item.id !== enclosure.id && finishedTimerEnclosureIds.has(item.id) && <span className="compact-enclosure-dot" aria-label="Minuteur terminé" title="Minuteur terminé" />}
          </button>)}
        </div>
        <div className="compact-enclosure-tools">
          <button onClick={addEnclosure} aria-label="Ajouter un enclos" title="Ajouter un enclos">+</button>
          <button onClick={removeEnclosure} disabled={enclosures.length <= 1} aria-label="Supprimer l’enclos sélectionné" title="Supprimer l’enclos sélectionné">−</button>
        </div>
      </div>

      <div className="compact-assist">
        <div className="compact-assist-toggle" role="tablist" aria-label="Mode d'élevage">
          <button role="tab" aria-selected={!isAssistedOn} onClick={disableAssist}>Manuel</button>
          <button role="tab" aria-selected={isAssistedOn} onClick={enableAssist}>Assisté</button>
        </div>
        {strategyStatusText && <span className="compact-assist-status">{strategyStatusText}</span>}
      </div>

      {mount && (isAssistedOn || stat !== 'serenity') && <div className="compact-serenity-quick">
        {/* La sérénité a déjà son propre éditeur de valeur plus bas quand la
            jauge active EN EST une (mode manuel, ou assisté avec une action en
            cours) — ce champ ne fait alors que doublonner. Mais une fois la
            stratégie terminée/indisponible, ce panneau de valeurs ne
            s'affiche plus du tout : sans ce champ, la sérénité resterait
            totalement illisible et non modifiable dans cet état. */}
        {!(stat === 'serenity' && (!isAssistedOn || assisted)) && <CompactValue label="Sérénité actuelle" value={mount.serenity} min={SERENITY_MIN} max={SERENITY_MAX} onChange={setSerenityCurrent} />}
        {/* Déclaratif pour la stratégie assistée uniquement : en mode manuel,
            aucune régulation de sérénité n'est pilotée, la case n'aurait
            aucun effet et n'a donc rien à faire là. */}
        {isAssistedOn && <label className="compact-equilibrated">
          <input type="checkbox" checked={mount.serenityEquilibrated} onChange={e => setSerenityEquilibrated(e.target.checked)} />
          Sérénité déjà équilibrée (plus besoin de régulation)
        </label>}
      </div>}

      {isAssistedOn ? <section className="compact-strategy-card">
        {loopResult?.decision.reason === 'objectif-non-atteint' && loopResult.decision.action ? <>
          <div className="compact-strategy-head">
            <ActionIcon gauge={action.gauge} color={action.color} />
            <span>{loopResult.decision.stepLabel}</span>
          </div>
          <div className="compact-strategy-values">
            <CompactValue label="Actuel" value={current} min={min} max={max} resetKey={stat} onChange={value => setStatValue('current', value)} />
            <span className="compact-strategy-target" title="Cible déterminée par la stratégie">{target.toLocaleString('fr-FR')}</span>
          </div>
          <CompactDualRange current={current} target={target} min={min} max={max} accent={selected.color} lockTarget onCurrent={value => setStatValue('current', value)} onTarget={() => {}} />
          <div className="compact-strategy-tier">
            <span className="compact-caption">TIER</span>
            <div className="compact-strategy-tier-buttons">
              {([1, 2, 3, 4] as Tier[]).map(value => <button key={value} className={tier === value ? 'is-selected' : ''} onClick={() => setTier(value)}>T{value}</button>)}
            </div>
          </div>
        </> : <div className="compact-strategy-done">
          <span>{loopResult?.decision.reason === 'boucle-terminee' ? '✓ Stratégie terminée' : 'Stratégie indisponible'}</span>
          <button onClick={enableAssist}>Relancer</button>
          {/* Terminée ne veut pas dire « plus rien à régler » : le panneau du
              bas affiche toujours une durée prévisionnelle pour la dernière
              jauge/tier manuels retenus, qui doit donc rester ajustable ici
              sans avoir à quitter le mode Assisté. */}
          <div className="compact-strategy-tier">
            <span className="compact-caption">TIER</span>
            <div className="compact-strategy-tier-buttons">
              {([1, 2, 3, 4] as Tier[]).map(value => <button key={value} className={tier === value ? 'is-selected' : ''} onClick={() => setTier(value)}>T{value}</button>)}
            </div>
          </div>
        </div>}
      </section> : mount && <>
        <div className="compact-block">
          <div className="compact-caption">JAUGE</div>
          <div className="compact-actions">
            {ACTIONS.map(item => <button key={item.gauge} className={`compact-action${item.stat === action.stat ? ' is-selected' : ''}`} style={{ '--action-color': item.color } as React.CSSProperties} onClick={() => setEnclosures(prev => prev.map(current => current.id === enclosure.id ? { ...current, compactStat: item.stat } : current))} title={item.label} aria-label={item.label} aria-pressed={item.stat === action.stat}><ActionIcon gauge={item.gauge} color={item.color} /></button>)}
          </div>
        </div>

        <div className="compact-block compact-tier-block">
          <div className="compact-caption">TIER DE L’ÉQUIPEMENT</div>
          <div className="compact-tier-slider">
            <input type="range" min={1} max={4} step={1} value={tier} onChange={e => setTier(Number(e.target.value) as Tier)} aria-label={`Tier de ${requestedAction.label}`} />
            <div className="compact-tier-labels">{([1, 2, 3, 4] as Tier[]).map(value => <span key={value} className={tier === value ? 'is-selected' : ''}>T{value}</span>)}</div>
          </div>
        </div>

        <section className="compact-values">
          <div className="compact-caption">{stat === 'xp' ? 'XP ACTUELLE' : 'VALEUR ACTUELLE'} <span>→</span> {stat === 'xp' ? 'NIVEAU CIBLE' : 'CIBLE'}</div>
          {stat === 'xp' ? <div className="compact-xp-target">
            <div className="compact-values-pair">
              <CompactValue label="XP actuelle" value={current} min={0} max={MOUNT_XP_MAX} onChange={value => setStatValue('current', value)} />
              <label className="compact-value-field compact-value-field--cible">
                <span>Niveau cible</span><CompactLevelInput value={targetLevel} onChange={setXpTargetLevel} />
              </label>
            </div>
            <CompactDualRange current={current} target={target} min={0} max={MOUNT_XP_MAX} accent={selected.color} onCurrent={value => setStatValue('current', value)} onTarget={setXpTargetFromSlider} />
            <div className="compact-xp-levels"><span>Niveau actuel {currentLevel}</span><span>XP requise {target.toLocaleString('fr-FR')}</span></div>
          </div> : <>
            <div className="compact-values-pair">
              <CompactValue label="Actuel" value={current} min={min} max={max} resetKey={stat} onChange={value => setStatValue('current', value)} />
              <CompactValue label="Cible" value={target} min={min} max={max} resetKey={stat} onChange={value => setStatValue('target', value)} />
            </div>
            <CompactDualRange current={current} target={target} min={min} max={max} accent={selected.color} onCurrent={value => setStatValue('current', value)} onTarget={value => setStatValue('target', value)} />
          </>}
        </section>
      </>}

      <section className={`compact-timer${timer ? ' compact-timer--running' : ''}${timer?.status === 'finished' ? ' compact-timer--finished' : ''}`}>
        {timer?.status === 'finished' ? <>
          <div className="compact-caption">MINUTEUR TERMINÉ</div>
          <div className="compact-time">+{formatDuration(overdue)}</div>
          <div className="compact-status">{timer.title} · en retard depuis {new Date(timer.endAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
        </> : timer ? <>
          <div className="compact-timer-reading">
            <div className="compact-caption">TEMPS RESTANT</div>
            <div className="compact-time">{formatDuration(remaining)}</div>
            <div className="compact-status">{timer.title} · fin à {new Date(timer.endAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div className="compact-timer-reading compact-timer-reading--forecast">
            <div className="compact-caption">PRÉVISIONNEL</div>
            <div className="compact-forecast-time">{formatDuration(duration)}</div>
            <div className="compact-status">{!directionOkay ? 'Cible à ajuster' : `${selected.label} · T${tier}`}</div>
          </div>
        </> : <>
          <div className="compact-caption">DURÉE PRÉVISIONNELLE</div>
          <div className="compact-time">{formatDuration(duration)}</div>
          <div className="compact-status">{!directionOkay ? stat === 'xp' ? 'Choisir un niveau supérieur au niveau actuel' : 'Choisir une cible différente' : duration ? `${selected.label} · T${tier}` : 'Cible déjà atteinte'}</div>
        </>}
      </section>

      <button className={`compact-start${timer ? ' is-stopping' : ''}`} disabled={!timer && !duration} onClick={timer ? stop : start}>
        {timer?.status === 'finished' ? 'Minuteur terminé — Stopper' : timer ? 'Stopper le minuteur' : 'Lancer le minuteur'}
      </button>
    </div>
  </div>;
};

export default CompactApp;
