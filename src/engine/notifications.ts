// Notifications locales, courtes et actionnables : un titre (enclos + événement), une ligne utile,
// et une réponse rapide selon le cas (voir messages.ts) :
//   fin d'étape   → « Jauges activées » lance la suite avec le carburant habituel, « Plus tard » ;
//   jauge vide    → « C'est rechargé », « Plus tard » ;
//   ralentit/vide → « C'est rechargé », « Ignorer » ;
//   cycle terminé → « Nouveau cycle », « Voir ».
// Android : expo-notifications. Windows : la coquille Electron (voir bureau.ts), qui affiche des
// notifications système (un clic ouvre l'enclos) tant que l'app tourne.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { JaugeType } from '../types/domain';
import { pontBureau } from './bureau';
import { ActionRapide, CategorieNotif, MessageNotif } from './messages';

const CANAL = 'fin-etape';
const ACTION_IGNORER = 'ignorer';
const ACTION_VOIR = 'voir';
export const DELAI_RAPPEL_MS = 30 * 60 * 1000;

const natif = Platform.OS !== 'web';

// Pas de « - » ni de « : » dans les identifiants de catégorie et d'action (contrainte expo-notifications).
const BOUTONS: Record<CategorieNotif, { id: ActionRapide | typeof ACTION_IGNORER | typeof ACTION_VOIR; titre: string; ouvre: boolean }[]> = {
  finetape: [
    { id: 'lancer', titre: 'Jauges activées', ouvre: true },
    { id: 'plustard', titre: 'Plus tard', ouvre: false },
  ],
  pause: [
    { id: 'recharger', titre: 'C’est rechargé', ouvre: true },
    { id: 'plustard', titre: 'Plus tard', ouvre: false },
  ],
  recharge: [
    { id: 'recharger', titre: 'C’est rechargé', ouvre: true },
    { id: ACTION_IGNORER, titre: 'Ignorer', ouvre: false },
  ],
  cycle: [
    { id: 'cycle', titre: 'Nouveau cycle', ouvre: true },
    { id: ACTION_VOIR, titre: 'Voir', ouvre: true },
  ],
};

export function configurerNotifications() {
  if (!natif) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  for (const [categorie, boutons] of Object.entries(BOUTONS)) {
    Notifications.setNotificationCategoryAsync(
      categorie,
      boutons.map((b) => ({ identifier: b.id, buttonTitle: b.titre, options: { opensAppToForeground: b.ouvre } }))
    ).catch(() => {});
  }
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Élevage',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {});
  }
}

export async function demanderPermission(): Promise<boolean> {
  if (pontBureau()) return true;
  if (!natif) return false;
  try {
    const actuelle = await Notifications.getPermissionsAsync();
    if (actuelle.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Ce qu'une réponse rapide doit savoir pour agir sans ouvrir de saisie. */
export interface ContexteNotif {
  enclosId: string;
  /** Jauge à recharger et niveau proposé (« C'est rechargé »). */
  jauge?: JaugeType;
  niveau?: number;
}

/** Programme une notification sur la plateforme courante ; renvoie son identifiant. */
export async function programmer(message: MessageNotif, contexte: ContexteNotif, quand: number, son: boolean): Promise<string | undefined> {
  if (quand <= Date.now()) return undefined;
  const url = `/enclos/${contexte.enclosId}`;
  const bureau = pontBureau();
  if (bureau) {
    const id = `notif-${quand}-${Math.random().toString(36).slice(2, 8)}`;
    bureau.notifier({ id, titre: message.titre, corps: message.corps, quand, url });
    return id;
  }
  if (!natif || !(await demanderPermission())) return undefined;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: message.titre,
        body: message.corps,
        sound: son ? 'default' : undefined,
        categoryIdentifier: message.categorie,
        data: { url, ...contexte },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: quand, channelId: CANAL },
    });
  } catch {
    return undefined;
  }
}

export function annulerNotifications(ids?: string[]) {
  if (!ids) return;
  const bureau = pontBureau();
  if (bureau) {
    for (const id of ids) bureau.annulerNotification(id);
    return;
  }
  if (!natif) return;
  for (const id of ids) Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/**
 * Réagit aux notifications : une réponse rapide est exécutée (`agir`), puis l'enclos s'ouvre ;
 * un simple appui ouvre l'enclos ; « Ignorer » ne fait rien.
 */
export function ecouterReponses(handlers: {
  ouvrir: (url: string) => void;
  agir: (action: ActionRapide, contexte: ContexteNotif) => void;
}): () => void {
  const bureau = pontBureau();
  if (bureau) return bureau.onOuvrir(handlers.ouvrir);
  if (!natif) return () => {};
  const abonnement = Notifications.addNotificationResponseReceivedListener((reponse) => {
    const data = (reponse.notification.request.content.data ?? {}) as Partial<ContexteNotif> & { url?: string };
    const action = reponse.actionIdentifier;
    if (action === ACTION_IGNORER) return;
    if (typeof data.enclosId === 'string' && ['lancer', 'recharger', 'cycle', 'plustard'].includes(action)) {
      handlers.agir(action as ActionRapide, { enclosId: data.enclosId, jauge: data.jauge, niveau: data.niveau });
      if (action === 'plustard') return;
    }
    if (typeof data.url === 'string') handlers.ouvrir(data.url);
  });
  return () => abonnement.remove();
}
