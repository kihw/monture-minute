// Notifications locales : une notification programmée à la fin de chaque étape,
// avec deux actions « Plus tard » (rappel dans 30 min) et « Voir » (ouvre l'enclos).
// Android : expo-notifications. Windows : la coquille Electron (voir bureau.ts),
// qui affiche des notifications système tant que l'app tourne.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { pontBureau } from './bureau';

const CANAL = 'fin-etape';
// Pas de « - » ni de « : » dans un identifiant de catégorie (contrainte expo-notifications).
const CATEGORIE = 'finetape';
const ACTION_VOIR = 'voir';
const ACTION_PLUS_TARD = 'plustard';
export const DELAI_RAPPEL_MS = 30 * 60 * 1000;

const natif = Platform.OS !== 'web';

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
  Notifications.setNotificationCategoryAsync(CATEGORIE, [
    { identifier: ACTION_PLUS_TARD, buttonTitle: 'Plus tard', options: { opensAppToForeground: false } },
    { identifier: ACTION_VOIR, buttonTitle: 'Voir', options: { opensAppToForeground: true } },
  ]).catch(() => {});
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CANAL, {
      name: "Fin d'étape",
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

/** Programme une notification sur la plateforme courante ; renvoie son identifiant. */
async function planifier(n: {
  enclosId: string;
  titre: string;
  corps: string;
  quand: number;
  son: boolean;
  avecActions?: boolean;
}): Promise<string | undefined> {
  if (n.quand <= Date.now()) return undefined;
  const url = `/enclos/${n.enclosId}`;
  const bureau = pontBureau();
  if (bureau) {
    const id = `notif-${n.quand}-${Math.random().toString(36).slice(2, 8)}`;
    bureau.notifier({ id, titre: n.titre, corps: n.corps, quand: n.quand, url });
    return id;
  }
  if (!natif || !(await demanderPermission())) return undefined;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: n.titre,
        body: n.corps,
        sound: n.son ? 'default' : undefined,
        categoryIdentifier: n.avecActions ? CATEGORIE : undefined,
        data: { url, enclosId: n.enclosId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.quand, channelId: CANAL },
    });
  } catch {
    return undefined;
  }
}

export function programmerFinEtape(params: {
  enclosId: string;
  enclosNom: string;
  numeroEtape: number;
  derniere: boolean;
  /** Jauges vidées qui arrêtent l'étape avant son objectif. */
  jaugesVides: string[];
  finAt: number;
  son: boolean;
}): Promise<string | undefined> {
  const nom = params.enclosNom.toLowerCase();
  return planifier({
    enclosId: params.enclosId,
    titre: params.jaugesVides.length ? `Étape ${params.numeroEtape} : jauge vide` : `Étape ${params.numeroEtape} terminée !`,
    corps: params.jaugesVides.length
      ? `L’${nom} n’a plus de carburant (${params.jaugesVides.join(', ')}). Recharge pour continuer.`
      : params.derniere
        ? `L’${nom} a atteint tous les objectifs.`
        : `L’${nom} a atteint les objectifs. Passe à l’étape ${params.numeroEtape + 1} ?`,
    quand: params.finAt,
    son: params.son,
    avecActions: true,
  });
}

/** Alerte ponctuelle pendant une étape (changement de palier, jauge vide). */
export function programmerAlerte(params: {
  enclosId: string;
  titre: string;
  corps: string;
  quand: number;
  son: boolean;
}): Promise<string | undefined> {
  return planifier(params);
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

/** Réagit aux notifications : « Voir » ou un appui ouvre l'enclos, « Plus tard » demande un rappel. */
export function ecouterReponses(handlers: { ouvrir: (url: string) => void; reporter: (enclosId: string) => void }): () => void {
  const bureau = pontBureau();
  if (bureau) return bureau.onOuvrir(handlers.ouvrir);
  if (!natif) return () => {};
  const abonnement = Notifications.addNotificationResponseReceivedListener((reponse) => {
    const data = reponse.notification.request.content.data ?? {};
    if (reponse.actionIdentifier === ACTION_PLUS_TARD) {
      if (typeof data.enclosId === 'string') handlers.reporter(data.enclosId);
      return;
    }
    if (typeof data.url === 'string') handlers.ouvrir(data.url);
  });
  return () => abonnement.remove();
}
