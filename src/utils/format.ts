export function formatDuree(secondes: number | null): string {
  if (secondes === null || !Number.isFinite(secondes)) return '—';
  if (secondes <= 0) return '0 min';
  const j = Math.floor(secondes / 86400);
  const h = Math.floor((secondes % 86400) / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  if (j > 0) return `${j}j ${h}h ${String(m).padStart(2, '0')}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m} min`;
  return `${Math.ceil(secondes)} s`;
}

/** Durée très compacte pour les listes : « 1j 08h », « 2h 14m », « 12m ». */
export function formatDureeCourte(secondes: number): string {
  const s = Math.max(0, Math.ceil(secondes));
  const j = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (j > 0) return `${j}j ${String(h).padStart(2, '0')}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** Compte à rebours compact h:mm:ss (ou Xj hh:mm au-delà d'un jour). */
export function formatCompteARebours(secondes: number): string {
  const s = Math.max(0, Math.ceil(secondes));
  const j = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const deux = (n: number) => String(n).padStart(2, '0');
  if (j > 0) return `${j}j ${deux(h)}:${deux(m)}`;
  return `${h}:${deux(m)}:${deux(sec)}`;
}

export function formatNombre(n: number): string {
  return Math.round(n)
    .toLocaleString('fr-FR')
    .replace(/[  ,]/g, ' ');
}

export function formatSerenite(n: number): string {
  if (n === 0) return '0';
  return `${n > 0 ? '+' : '−'}${formatNombre(Math.abs(n))}`;
}

export function formatHeure(horodatage: number): string {
  return new Date(horodatage).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateHeure(horodatage: number): string {
  return new Date(horodatage).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Carburant lisible : « 81,8k », « 200k », « 950 ». */
export function formatCarburantCourt(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v < 1000) return String(v);
  const k = v / 1000;
  return `${(Math.round(k * 10) / 10).toLocaleString('fr-FR')}k`;
}

/** Carburant ou points en toutes lettres : « 126 000 ». */
export function formatPoints(n: number): string {
  return formatNombre(Math.max(0, n));
}

/** Durée en clair pour la V2 : « 45 s », « 46 min », « 1 h 12 », « 2 j 4 h ». */
export function formatDureeClaire(secondes: number): string {
  const t = Math.max(0, Math.ceil(secondes));
  const j = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  if (j > 0) return h > 0 ? `${j} j ${h} h` : `${j} j`;
  if (h > 0) return m > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${t} s`;
}

/** Titre d'étape lisible : « Endurance & XP » → « Endurance et XP ». */
export function titreClair(titre: string): string {
  return titre.replace(/ & /g, ' et ');
}
