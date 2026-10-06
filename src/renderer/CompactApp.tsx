import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from './hooks/useAppState';
import { GaugeId, MountStat, Tier } from '@/types/breeding';
import { STAT_LABELS, TIER_EFFECT, TICK_INTERVAL_SECONDS, STAT_MAX, SERENITY_MIN, SERENITY_MAX, getAbilityMultiplier } from '@/core/breedingRules';
import { startTimer, upsertEnclosureTimer, formatDuration, getRemainingSeconds, enclosureTimer } from '@/core/timerEngine';
import { createEnclosure, createMount, Enclosure } from '@/types/enclosure';
import { statFields, statTarget, statValue } from '@/core/enclosureRules';
import { MOUNT_XP_BY_LEVEL, mountLevelForXp } from '@/core/mountExperience';
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

const CompactValue: React.FC<{ label: string; value: number; min: number; max: number; onChange: (value: number) => void }> = ({ label, value, min, max, onChange }) => {
  const [draft, setDraft] = useState<string | null>(null);
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
      type="number" min={min} max={max} step={100} value={draft ?? value}
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

const CompactLevelInput: React.FC<{ value: number; onChange: (value: number) => void }> = ({ value, onChange }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) && draft.trim() !== '' ? Math.max(1, Math.min(200, Math.round(parsed))) : value;
    setDraft(String(next));
    onChange(next);
  };
  return <input className="compact-level-input" type="number" min={1} max={200} step={1} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-label="Niveau cible" />;
};

const CompactDualRange: React.FC<{ current: number; target: number; min: number; max: number; accent: string; onCurrent: (value: number) => void; onTarget: (value: number) => void }> = ({ current, target, min, max, accent, onCurrent, onTarget }) => {
  const pct = (value: number) => `${((value - min) / (max - min)) * 100}%`;
  const trackRef = useRef<HTMLDivElement>(null);
  const draggedThumb = useRef<'current' | 'target' | null>(null);
  const low = pct(Math.min(current, target));
  const high = pct(Math.max(current, target));
  const updateAt = (clientX: number, thumb = draggedThumb.current) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !thumb) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const snapped = Math.max(min, Math.min(max, Math.round((min + ratio * (max - min)) / 100) * 100));
    (thumb === 'current' ? onCurrent : onTarget)(snapped);
  };
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-thumb]')?.dataset.thumb as 'current' | 'target' | undefined;
    const ratio = Math.max(0, Math.min(1, (event.clientX - event.currentTarget.getBoundingClientRect().left) / event.currentTarget.getBoundingClientRect().width));
    const clickedValue = min + ratio * (max - min);
    draggedThumb.current = handle ?? (Math.abs(clickedValue - current) <= Math.abs(clickedValue - target) ? 'current' : 'target');
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
    <div className="compact-dual-thumb compact-dual-thumb--target" data-thumb="target" role="slider" tabIndex={0} aria-label="Valeur cible curseur" aria-valuemin={min} aria-valuemax={max} aria-valuenow={target} onKeyDown={e => onThumbKeyDown(e, 'target')} />
  </div>;
};

const CompactApp: React.FC = () => {
  const { ready, enclosures, selectedEnclosureId, setSelectedEnclosureId, timers, setTimers, setEnclosures, settings, setSettings } = useAppState();
  const [, tick] = useState(0);
  const audioContext = useRef<AudioContext | null>(null);
  const runningTimerIds = useRef(new Set<string>());
  const index = Math.max(0, enclosures.findIndex(e => e.id === selectedEnclosureId));
  const enclosure = enclosures[index];
  const selectedStat = enclosure?.compactStat ?? 'serenity';
  const tier = enclosure?.compactTiers?.[selectedStat] ?? 1;
  const requestedAction = ACTIONS.find(item => item.stat === selectedStat) ?? ACTIONS[0];

  useEffect(() => {
    if (ready && enclosure && !enclosure.mount) {
      setEnclosures(prev => prev.map((item, i) => item.id === enclosure.id ? { ...item, mount: createMount(`Monture ${i + 1}`) } : item));
    }
  }, [ready, enclosure?.id, enclosure?.mount, setEnclosures]);

  const timer = enclosure ? enclosureTimer(timers, enclosure.id) : null;
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
  const stat = requestedAction.stat;
  const current = mount ? statValue(mount, stat) : 0;
  const target = mount ? statTarget(mount, stat) : 0;
  const action = stat === 'serenity'
    ? { ...requestedAction, gauge: target < current ? 'baffeur' as const : 'caresseur' as const, label: target < current ? 'Sérénité −' : 'Sérénité +' }
    : requestedAction;
  const min = stat === 'serenity' ? SERENITY_MIN : 0;
  const max = stat === 'serenity' ? SERENITY_MAX : stat === 'xp' ? MOUNT_XP_MAX : STAT_MAX;
  const currentLevel = stat === 'xp' ? mountLevelForXp(current) : 1;
  const targetLevel = stat === 'xp' ? mountLevelForXp(target) : 1;
  const multiplier = mount ? getAbilityMultiplier(mount.ability, stat) : 1;
  const directionOkay = stat === 'xp'
    ? target > current
    : stat === 'serenity' ? target !== current : true;
  const delta = Math.abs(target - current);
  const duration = directionOkay && delta > 0
    ? Math.ceil(delta / (TIER_EFFECT[tier] * multiplier)) * TICK_INTERVAL_SECONDS
    : 0;
  const remaining = timer ? getRemainingSeconds(timer) : duration;
  const selected = action;
  const setStatValue = (field: 'current' | 'target', raw: number) => {
    if (!mount) return;
    const key = statFields(stat)[field === 'current' ? 'value' : 'target'];
    const next = Math.max(min, Math.min(max, Math.round(raw / 100) * 100));
    setEnclosures(prev => prev.map(item => item.id === enclosure.id ? { ...item, mount: { ...mount, [key]: next } } : item));
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
    const nextList = enclosures.filter(item => item.id !== enclosure.id);
    setEnclosures(nextList);
    setSelectedEnclosureId(nextList[Math.max(0, index - 1)].id);
    setTimers(prev => prev.filter(item => item.enclosureId !== enclosure.id));
  };
  const start = () => {
    const next = startTimer({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      enclosureId: enclosure.id,
      title: selected.label,
      description: `${STAT_LABELS[selected.stat]} · Tier ${tier}`,
      durationSeconds: duration,
    });
    setTimers(prev => upsertEnclosureTimer(prev, next));
  };
  const stop = () => {
    if (!timer) return;
    setTimers(prev => prev.filter(item => item.id !== timer.id));
  };

  return <div className="compact-app" onPointerDownCapture={unlockTimerSound} style={{ '--compact-accent': selected.color } as React.CSSProperties}>
    <header className="compact-titlebar">
      <img className="compact-brand-mark" src={brandIcon} alt="" />
      <span className="compact-title">{enclosure.name}</span>
      <button className={`compact-sound-toggle${settings.timerSound ? ' is-enabled' : ''}`} onClick={() => setSettings(prev => ({ ...prev, timerSound: !prev.timerSound }))} aria-label={settings.timerSound ? 'Désactiver la sonnerie' : 'Activer la sonnerie'} title={settings.timerSound ? 'Sonnerie activée — cliquer pour couper' : 'Sonnerie désactivée — cliquer pour activer'} aria-pressed={settings.timerSound}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l5 4V6l-5 4H4Z" /><path className="compact-sound-wave" d="M16 9a4 4 0 0 1 0 6m2-9a7 7 0 0 1 0 12" />{!settings.timerSound && <path className="compact-sound-slash" d="m16 9 5 6m0-6-5 6" />}</svg>
      </button>
      <button className="compact-window-control" onClick={() => electronApi?.window.minimize()} aria-label="Réduire" title="Réduire">−</button>
      <button className="compact-close" onClick={() => electronApi?.window.hide()} aria-label="Masquer">×</button>
    </header>

    <div className="compact-content">
      <div className="compact-enclosure-select" role="tablist" aria-label="Choisir un enclos">
        <span className="compact-caption">ENCLOS</span>
        <div className="compact-enclosures">
          {enclosures.map((item, i) => <button key={item.id} role="tab" aria-selected={item.id === enclosure.id} className={item.id === enclosure.id ? 'is-selected' : ''} onClick={() => setSelectedEnclosureId(item.id)} title={item.name}>{i + 1}</button>)}
        </div>
        <div className="compact-enclosure-tools">
          <button onClick={addEnclosure} aria-label="Ajouter un enclos" title="Ajouter un enclos">+</button>
          <button onClick={removeEnclosure} disabled={enclosures.length <= 1} aria-label="Supprimer l’enclos sélectionné" title="Supprimer l’enclos sélectionné">−</button>
        </div>
      </div>

      <div className="compact-block">
        <div className="compact-caption">JAUGE</div>
        <div className="compact-actions">
          {ACTIONS.map(item => <button key={item.gauge} className={`compact-action${item.stat === action.stat ? ' is-selected' : ''}`} style={{ '--action-color': item.color } as React.CSSProperties} onClick={() => setEnclosures(prev => prev.map(current => current.id === enclosure.id ? { ...current, compactStat: item.stat } : current))} title={item.label} aria-label={item.label} aria-pressed={item.stat === action.stat}><ActionIcon gauge={item.gauge} color={item.color} /></button>)}
        </div>
      </div>

      <div className="compact-block compact-tier-block">
        <div className="compact-caption">TIER DE L’ÉQUIPEMENT</div>
        <div className="compact-tier-slider">
          <input type="range" min={1} max={4} step={1} value={tier} onChange={e => {
            const nextTier = Number(e.target.value) as Tier;
            setEnclosures(prev => prev.map(current => current.id === enclosure.id ? { ...current, compactTiers: { ...enclosureTiers(current), [selectedStat]: nextTier } } : current));
          }} aria-label={`Tier de ${requestedAction.label}`} />
          <div className="compact-tier-labels">{([1, 2, 3, 4] as Tier[]).map(value => <span key={value} className={tier === value ? 'is-selected' : ''}>T{value}</span>)}</div>
        </div>
      </div>

      {mount && <section className="compact-values">
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
            <CompactValue label="Actuel" value={current} min={min} max={max} onChange={value => setStatValue('current', value)} />
            <CompactValue label="Cible" value={target} min={min} max={max} onChange={value => setStatValue('target', value)} />
          </div>
          <CompactDualRange current={current} target={target} min={min} max={max} accent={selected.color} onCurrent={value => setStatValue('current', value)} onTarget={value => setStatValue('target', value)} />
        </>}
      </section>}

      <section className={`compact-timer${timer ? ' compact-timer--running' : ''}`}>
        {timer ? <>
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

      <button className={`compact-start${timer ? ' is-stopping' : ''}`} disabled={!timer && !duration} onClick={timer ? stop : start}>{timer ? 'Stopper le minuteur' : 'Lancer le minuteur'}</button>
    </div>
  </div>;
};

export default CompactApp;
