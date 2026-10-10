// Vitrine : affiche la dernière version et les notes de version depuis l'API publique GitHub.
const DEPOT = 'kihw/DoDinde';

function element(tag, texte, classe) {
  const el = document.createElement(tag);
  if (texte) el.textContent = texte;
  if (classe) el.className = classe;
  return el;
}

async function chargerVersions() {
  const etiquette = document.getElementById('version-actuelle');
  const liste = document.getElementById('liste-versions');
  try {
    const reponse = await fetch(`https://api.github.com/repos/${DEPOT}/releases?per_page=6`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!reponse.ok) throw new Error(String(reponse.status));
    const releases = (await reponse.json()).filter((r) => !r.draft);
    liste.replaceChildren();
    if (releases.length === 0) {
      etiquette.textContent = 'Première version en préparation.';
      liste.append(element('p', 'Aucune version publiée pour l’instant.', 'discret'));
      return;
    }
    const date = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    etiquette.textContent = `Dernière version : ${releases[0].tag_name} · ${date(releases[0].published_at)}`;
    for (const r of releases) {
      const carte = element('article', '', 'version');
      const entete = element('header');
      const titre = element('h3');
      const lien = element('a', r.name || r.tag_name);
      lien.href = r.html_url;
      titre.append(lien);
      const quand = element('time', date(r.published_at));
      quand.dateTime = r.published_at;
      entete.append(titre, quand);
      // Notes affichées en texte brut : jamais interprétées comme du HTML.
      carte.append(entete, element('pre', (r.body || 'Pas de notes pour cette version.').trim()));
      liste.append(carte);
    }
  } catch {
    etiquette.textContent = 'Versions disponibles sur GitHub.';
    liste.replaceChildren(element('p', 'Impossible de charger les versions. Elles sont listées sur GitHub.', 'discret'));
  }
}

chargerVersions();
