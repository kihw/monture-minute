import React, { useCallback, useEffect, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

const REPOSITORY = 'kihw/monture-minute';
const CURRENT_VERSION = '1.1.0';

type Release = {
  tag_name: string;
  html_url: string;
  assets: { name: string; browser_download_url: string }[];
};

function versionParts(version: string): number[] {
  return version.replace(/^v/, '').split('.').map(part => Number.parseInt(part, 10) || 0);
}

function isNewer(candidate: string, current: string): boolean {
  const a = versionParts(candidate);
  const b = versionParts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

export const UpdateChecker: React.FC = () => {
  const [release, setRelease] = useState<Release | null>(null);
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    setMessage('');
    try {
      const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (response.status === 404) {
        setRelease(null);
        setMessage('Aucune version publiée pour le moment.');
        return;
      }
      if (!response.ok) throw new Error('Vérification indisponible.');
      const latest = await response.json() as Release;
      if (!isNewer(latest.tag_name, CURRENT_VERSION)) {
        setRelease(null);
        setMessage(`Vous utilisez la dernière version (${CURRENT_VERSION}).`);
        return;
      }
      setRelease(latest);
      setMessage(`Version ${latest.tag_name} disponible.`);
    } catch {
      setMessage('Vérification impossible. Réessayez avec une connexion Internet.');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { void check(); }, [check]);

  const download = async () => {
    if (!release) return;
    const apk = release.assets.find(asset => asset.name.toLowerCase().endsWith('.apk'));
    const url = apk?.browser_download_url ?? release.html_url;
    if (Capacitor.getPlatform() === 'android') {
      await Browser.open({ url });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span>Version {CURRENT_VERSION}</span>
      <button
        className="btn-ghost btn-sm"
        type="button"
        onClick={() => { void check(); }}
        disabled={checking}
      >
        {checking ? 'Vérification…' : 'Vérifier les mises à jour'}
      </button>
      {message && <span role="status">{message}</span>}
      {release && (
        <button className="btn-ghost btn-sm" type="button" onClick={() => { void download(); }}>
          Télécharger {release.tag_name}
        </button>
      )}
    </span>
  );
};
