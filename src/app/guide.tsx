// Guide de prise en main : dix pages illustrées avec les vrais éléments de l'app, de l'idée d'enclos
// jusqu'à la fin du parcours. Proposé d'office après la création du premier enclos, puis depuis
// les réglages. `?ensuite=` indique où aller en le terminant.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Monture from "../components/Monture";
import {
  BoutonContour,
  BoutonPrincipal,
  Ecran,
  IconeJauge,
} from "../components/ui";
import { JAUGE_MAX, TIERS_CARBURANT } from "../data/constants";
import { s } from "../echelle";
import { useEleveurStore } from "../store/useStore";
import { couleurs, esp, rayon } from "../theme";
import { FAMILLE_LISTE, FAMILLES, INFO_JAUGE, JAUGES } from "../types/domain";

interface Page {
  titre: string;
  texte: string;
  points?: string[];
  illustration: ReactNode;
}

function Bande({
  couleur,
  debut,
  fin,
  libelle,
}: {
  couleur: string;
  debut: number;
  fin: number;
  libelle: string;
}) {
  return (
    <View style={styles.bandeLigne}>
      <Text style={[styles.bandeLibelle, { color: couleur }]}>{libelle}</Text>
      <View style={styles.bandePiste}>
        <View
          style={[
            styles.bandeZone,
            {
              left: `${debut}%`,
              width: `${fin - debut}%`,
              backgroundColor: couleur,
            },
          ]}
        />
      </View>
    </View>
  );
}

function Etiquette({
  texte,
  couleur = couleurs.texteAttenue,
}: {
  texte: string;
  couleur?: string;
}) {
  return (
    <View style={styles.etiquette}>
      <Text style={[styles.etiquetteTexte, { color: couleur }]}>{texte}</Text>
    </View>
  );
}

/** Pages du guide (fonction : les illustrations utilisent les styles définis plus bas). */
function creerPages(): Page[] {
  return [
    {
      titre: "Bienvenue dans Monture Minute",
      texte:
        "L’app calcule pour toi le meilleur parcours d’élevage de chaque enclos, du premier jour jusqu’aux montures fécondables, et te prévient au bon moment.",
      points: [
        "Dragodindes, muldos et volkornes",
        "Aucun suivi monture par monture",
        "Tout se fait en quelques touches",
      ],
      illustration: (
        <View style={styles.trio}>
          {FAMILLE_LISTE.map((f, i) => (
            <View key={f} style={styles.trioMonture}>
              <Monture
                famille={f}
                robe={[2, 5, 3][i]}
                taille={s(78)}
                fond={false}
              />
              <Text style={styles.trioNom}>{FAMILLES[f].nom}</Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      titre: "Un enclos, un lot",
      texte:
        "Tu ne suis pas chaque monture : un enclos décrit le lot qu’il contient. À sa création, choisis la famille et la robe, la sérénité de départ et les niveaux.",
      points: [
        "Sérénité « unifiée » : toutes au même niveau",
        "Sérénité « variable » : indique la plus haute, on unifie d’abord",
        "Niveau actuel et niveau cible du lot",
      ],
      illustration: (
        <View style={styles.lot}>
          <Monture famille="volkorne" robe={3} taille={s(84)} />
          <View style={{ gap: s(6) }}>
            <Text style={styles.lotNom}>Enclos 1</Text>
            <View style={styles.etiquettes}>
              <Etiquette texte="Volkorne Indigo" couleur={couleurs.texte} />
              <Etiquette texte="Sérénité −5 000" />
              <Etiquette texte="Niv. 1 → 100" />
            </View>
          </View>
        </View>
      ),
    },
    {
      titre: "La sérénité décide de tout",
      texte:
        "Chaque caractéristique ne monte que dans sa zone de sérénité. Les jauges − et + déplacent la sérénité du lot pour passer d’une zone à l’autre.",
      points: [
        "Endurance : sérénité négative",
        "Maturité : entre −2 000 et +2 000",
        "Amour : sérénité positive",
      ],
      illustration: (
        <View style={styles.bandes}>
          <Bande
            couleur={couleurs.endurance}
            debut={0}
            fin={50}
            libelle="Endurance"
          />
          <Bande
            couleur={couleurs.maturite}
            debut={30}
            fin={70}
            libelle="Maturité"
          />
          <Bande
            couleur={couleurs.amour}
            debut={50}
            fin={100}
            libelle="Amour"
          />
          <View style={styles.axe}>
            <Text style={styles.axeTexte}>−5 000</Text>
            <Text style={styles.axeTexte}>0</Text>
            <Text style={styles.axeTexte}>+5 000</Text>
          </View>
        </View>
      ),
    },
    {
      titre: "Les six jauges de l’enclos",
      texte:
        "Comme en jeu : − et + pour la sérénité, éclair pour l’endurance, goutte pour la maturité, cœur pour l’amour, XP pour le niveau. Deux jauges tournent à la fois.",
      points: [
        "Endurance, maturité et amour montent jusqu’à 20 000",
        "L’XP mène le lot au niveau cible",
        "L’app choisit toujours la meilleure paire",
      ],
      illustration: (
        <View style={styles.jauges}>
          {JAUGES.map((j) => (
            <View key={j} style={styles.jauge}>
              <IconeJauge type={j} taille={s(38)} />
              <Text style={styles.jaugeNom}>
                {INFO_JAUGE[j].nom.replace("Sérénité ", "")}
              </Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      titre: "Le carburant fait la vitesse",
      texte:
        "Une jauge contient jusqu’à 200 000 points. Toutes les 10 secondes, elle donne autant de points que son palier, et son carburant baisse d’autant.",
      points: [
        "Extrait jusqu’à 80 000 : ×10",
        "Philtre jusqu’à 140 000 : ×20",
        "Potion jusqu’à 180 000 : ×30",
        "Élixir au-delà : ×40",
      ],
      illustration: (
        <View style={{ gap: s(6) }}>
          <View style={styles.paliers}>
            {TIERS_CARBURANT.map((t, i) => (
              <View
                key={t.nom}
                style={[
                  styles.palier,
                  {
                    flex: (t.plafond - t.seuil) / JAUGE_MAX,
                    backgroundColor: `rgba(242,201,76,${0.22 + i * 0.22})`,
                  },
                ]}
              >
                <Text style={styles.palierTexte}>×{t.palier}</Text>
              </View>
            ))}
          </View>
          <View style={styles.axe}>
            <Text style={styles.axeTexte}>0</Text>
            <Text style={styles.axeTexte}>80k</Text>
            <Text style={styles.axeTexte}>140k</Text>
            <Text style={styles.axeTexte}>180k</Text>
            <Text style={styles.axeTexte}>200k</Text>
          </View>
        </View>
      ),
    },
    {
      titre: "Un parcours en étapes",
      texte:
        "L’app enchaîne les étapes dans le bon ordre et calcule la durée de chacune d’après ton carburant. Tu vois toujours la suite.",
      points: [
        "Unification si le lot est variable",
        "Puis endurance, cap de sérénité, maturité et amour",
        "Et l’XP finale jusqu’au niveau cible",
      ],
      illustration: (
        <View style={styles.frise}>
          {[
            "Unification",
            "Endurance & XP",
            "Cap +500",
            "Maturité & Amour",
            "XP finale",
          ].map((e, i) => (
            <View key={e} style={styles.friseLigne}>
              <View style={[styles.frisePuce, i < 2 && styles.frisePuceFaite]}>
                {i < 2 ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={s(12)}
                    color={couleurs.surAccent}
                  />
                ) : (
                  <Text style={styles.friseNumero}>{i + 1}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.friseTexte,
                  i === 2 && { color: couleurs.accent },
                ]}
              >
                {e}
              </Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      titre: "Lancer une étape",
      texte:
        "Les jauges à activer clignotent en or. Active-les en jeu, puis touche-les ici et indique le carburant que tu y as mis : le minuteur démarre.",
      points: [
        "Raccourcis Élixir, Potion, Philtre, Extrait",
        "La durée de l’étape s’affiche avant de valider",
      ],
      illustration: (
        <View style={styles.lancer}>
          <View style={styles.tube}>
            <View
              style={[
                styles.tubeNiveau,
                { height: "70%", backgroundColor: couleurs.endurance },
              ]}
            />
          </View>
          <MaterialCommunityIcons
            name="gesture-tap"
            size={s(30)}
            color={couleurs.accent}
          />
          <View style={styles.bouton}>
            <Text style={styles.boutonTexte}>Jauge activée</Text>
          </View>
        </View>
      ),
    },
    {
      titre: "Suivre en temps réel",
      texte:
        "Pendant l’étape, chaque jauge descend en direct. L’app compare « recharger » et « laisser filer » et te dit si une recharge fait vraiment gagner du temps.",
      points: [
        "Touche une jauge : options de recharge chiffrées",
        "Appui long : recaler sur la valeur lue en jeu",
        "Une jauge vide bloque l’étape : l’app te prévient avant",
      ],
      illustration: (
        <View style={{ gap: s(8) }}>
          <View style={styles.conseil}>
            <MaterialCommunityIcons
              name="flask-outline"
              size={s(16)}
              color={couleurs.accent}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.conseilTitre}>Recharge Amour à 85,2k</Text>
              <Text style={styles.conseilDetail}>
                Fin 16:58 au lieu de 17:26 (−28 min)
              </Text>
            </View>
          </View>
          <View style={styles.reservoir}>
            <View style={styles.reservoirTete}>
              <IconeJauge type="amour" taille={s(22)} />
              <Text style={styles.reservoirNom}>Amour</Text>
              <Text style={styles.reservoirNiveau}>81,8k</Text>
            </View>
            <View style={styles.reservoirPiste}>
              <View style={[styles.reservoirRemplissage, { width: "41%" }]} />
            </View>
            <Text style={styles.reservoirEcheance}>Passe ×10 dans 15m</Text>
          </View>
        </View>
      ),
    },
    {
      titre: "Les alertes au bon moment",
      texte:
        "Une notification arrive avant chaque baisse de palier ou jauge vide, et à la fin de l’étape. Règle le délai d’avance dans les réglages.",
      points: [
        "« Plus tard » repousse le rappel de 30 min",
        "Sur Windows, l’app peut rester au premier plan sur le jeu",
      ],
      illustration: (
        <View style={styles.notif}>
          <MaterialCommunityIcons
            name="bell-ring-outline"
            size={s(22)}
            color={couleurs.accent}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.notifTitre}>Amour passe ×10 dans 5 min</Text>
            <Text style={styles.notifTexte}>
              Enclos 1 : recharge Amour au-dessus de 80k pour garder un palier
              plus rapide.
            </Text>
          </View>
        </View>
      ),
    },
    {
      titre: "Valider et continuer",
      texte:
        "Quand l’étape est finie, valide-la : l’app applique la progression et propose la suivante. Si le jeu ne correspond pas, ajuste le lot depuis le menu de l’enclos.",
      points: [
        "« Terminer maintenant » compte le temps déjà passé",
        "À la fin : tes montures sont fécondables",
      ],
      illustration: (
        <View style={styles.fin}>
          <Monture famille="dragodinde" robe={2} taille={s(96)} />
          <View style={[styles.bouton, { alignSelf: "stretch" }]}>
            <Text style={styles.boutonTexte}>Étape suivante</Text>
          </View>
        </View>
      ),
    },
  ];
}

export default function Guide() {
  const { ensuite } = useLocalSearchParams<{ ensuite?: string }>();
  const marquerVu = useEleveurStore((s) => s.modifierReglages);
  const PAGES = useMemo(() => creerPages(), []);
  const [page, setPage] = useState(0);
  const apparition = useMemo(() => new Animated.Value(1), []);

  // La page glisse à chaque changement, et seulement à ce moment-là.
  useEffect(() => {
    apparition.setValue(0);
    Animated.timing(apparition, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [page, apparition]);

  const terminer = () => {
    marquerVu({ guideVu: true });
    if (ensuite) router.replace(ensuite as never);
    else if (router.canGoBack()) router.back();
    else router.replace("/enclos");
  };

  const p = PAGES[page];
  const derniere = page === PAGES.length - 1;
  return (
    <Ecran
      entete={
        <View style={styles.entete}>
          <Text style={styles.compteur}>
            {page + 1} / {PAGES.length}
          </Text>
          <Pressable onPress={terminer} hitSlop={8} accessibilityRole="button">
            <Text style={styles.passer}>{derniere ? "Fermer" : "Passer"}</Text>
          </Pressable>
        </View>
      }
      basDePage={
        <View style={{ gap: esp.md }}>
          <View style={styles.points}>
            {PAGES.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => setPage(i)}
                hitSlop={6}
                accessibilityLabel={`Page ${i + 1}`}
              >
                <View style={[styles.point, i === page && styles.pointActif]} />
              </Pressable>
            ))}
          </View>
          <View style={styles.boutons}>
            {page > 0 && (
              <View style={{ flex: 1 }}>
                <BoutonContour
                  label="Précédent"
                  onPress={() => setPage(page - 1)}
                />
              </View>
            )}
            <View style={{ flex: 1.6 }}>
              <BoutonPrincipal
                label={derniere ? "C’est parti" : "Suivant"}
                icone={derniere ? "check" : "arrow-right"}
                onPress={() => (derniere ? terminer() : setPage(page + 1))}
              />
            </View>
          </View>
        </View>
      }
    >
      <Animated.View
        style={{
          gap: esp.xl,
          opacity: apparition,
          transform: [
            {
              translateY: apparition.interpolate({
                inputRange: [0, 1],
                outputRange: [s(12), 0],
              }),
            },
          ],
        }}
      >
        <View style={styles.illustration}>{p.illustration}</View>
        <View style={{ gap: esp.md }}>
          <Text style={styles.titre}>{p.titre}</Text>
          <Text style={styles.texte}>{p.texte}</Text>
          {p.points && (
            <View style={{ gap: esp.sm }}>
              {p.points.map((pt) => (
                <View key={pt} style={styles.puce}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={s(15)}
                    color={couleurs.accent}
                  />
                  <Text style={styles.puceTexte}>{pt}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  entete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: esp.lg,
    paddingVertical: esp.md,
  },
  compteur: {
    color: couleurs.texteFaible,
    fontSize: s(12),
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  passer: { color: couleurs.texteAttenue, fontSize: s(13), fontWeight: "700" },
  illustration: {
    minHeight: s(190),
    justifyContent: "center",
    padding: esp.xl,
    borderRadius: rayon.xl,
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.liseret,
  },
  titre: {
    color: couleurs.texte,
    fontSize: s(21),
    fontWeight: "800",
    letterSpacing: s(-0.4),
  },
  texte: { color: couleurs.texteAttenue, fontSize: s(14), lineHeight: s(20) },
  puce: { flexDirection: "row", alignItems: "flex-start", gap: esp.sm },
  puceTexte: {
    flex: 1,
    color: couleurs.texte,
    fontSize: s(13),
    lineHeight: s(18),
  },
  points: { flexDirection: "row", justifyContent: "center", gap: s(6) },
  point: {
    width: s(6),
    height: s(6),
    borderRadius: s(3),
    backgroundColor: couleurs.liseretVif,
  },
  pointActif: { width: s(18), backgroundColor: couleurs.accent },
  boutons: { flexDirection: "row", gap: esp.sm },
  trio: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
  },
  trioMonture: { alignItems: "center", gap: s(6) },
  trioNom: { color: couleurs.texte, fontSize: s(12), fontWeight: "700" },
  lot: { flexDirection: "row", alignItems: "center", gap: esp.lg },
  lotNom: { color: couleurs.texte, fontSize: s(16), fontWeight: "800" },
  etiquettes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: s(5),
    maxWidth: s(190),
  },
  etiquette: {
    paddingHorizontal: s(7),
    paddingVertical: s(3),
    borderRadius: s(5),
    backgroundColor: couleurs.surfaceElevee,
  },
  etiquetteTexte: { fontSize: s(11), fontWeight: "700" },
  bandes: { gap: s(10) },
  bandeLigne: { flexDirection: "row", alignItems: "center", gap: esp.md },
  bandeLibelle: { width: s(72), fontSize: s(11.5), fontWeight: "800" },
  bandePiste: {
    flex: 1,
    height: s(8),
    borderRadius: s(4),
    backgroundColor: couleurs.piste,
  },
  bandeZone: { position: "absolute", top: 0, bottom: 0, borderRadius: s(4) },
  axe: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: s(84),
  },
  axeTexte: { color: couleurs.texteFaible, fontSize: s(10), fontWeight: "700" },
  jauges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    rowGap: esp.md,
  },
  jauge: { width: "33%", alignItems: "center", gap: s(4) },
  jaugeNom: {
    color: couleurs.texteAttenue,
    fontSize: s(11),
    fontWeight: "700",
  },
  paliers: {
    flexDirection: "row",
    height: s(34),
    gap: s(2),
    borderRadius: s(6),
    overflow: "hidden",
  },
  palier: { alignItems: "center", justifyContent: "center" },
  palierTexte: {
    color: couleurs.surAccent,
    fontSize: s(12),
    fontWeight: "900",
  },
  frise: { gap: s(8) },
  friseLigne: { flexDirection: "row", alignItems: "center", gap: esp.md },
  frisePuce: {
    width: s(22),
    height: s(22),
    borderRadius: s(6),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: couleurs.surfaceElevee,
  },
  frisePuceFaite: { backgroundColor: couleurs.accent },
  friseNumero: {
    color: couleurs.texteAttenue,
    fontSize: s(11),
    fontWeight: "800",
  },
  friseTexte: { color: couleurs.texte, fontSize: s(13), fontWeight: "700" },
  lancer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: esp.lg,
  },
  tube: {
    width: s(22),
    height: s(110),
    borderRadius: s(11),
    borderWidth: 2,
    borderColor: couleurs.accent,
    backgroundColor: couleurs.piste,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  tubeNiveau: { width: "100%", borderRadius: s(9) },
  bouton: {
    paddingHorizontal: esp.lg,
    height: s(38),
    borderRadius: rayon.md,
    backgroundColor: couleurs.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  boutonTexte: {
    color: couleurs.surAccent,
    fontSize: s(13),
    fontWeight: "800",
  },
  conseil: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    padding: s(9),
    borderRadius: rayon.lg,
    borderWidth: 1,
    borderColor: `${couleurs.accent}55`,
    backgroundColor: `${couleurs.accent}14`,
  },
  conseilTitre: {
    color: couleurs.accent,
    fontSize: s(12.5),
    fontWeight: "800",
  },
  conseilDetail: {
    color: couleurs.texteAttenue,
    fontSize: s(11),
    fontWeight: "600",
  },
  reservoir: {
    padding: s(9),
    gap: s(6),
    borderRadius: rayon.lg,
    backgroundColor: couleurs.surface,
  },
  reservoirTete: { flexDirection: "row", alignItems: "center", gap: s(7) },
  reservoirNom: { color: couleurs.texte, fontSize: s(12.5), fontWeight: "800" },
  reservoirNiveau: {
    marginLeft: "auto",
    color: couleurs.texte,
    fontSize: s(14),
    fontWeight: "800",
  },
  reservoirPiste: {
    height: s(8),
    borderRadius: s(3),
    backgroundColor: couleurs.piste,
    overflow: "hidden",
  },
  reservoirRemplissage: { height: "100%", backgroundColor: couleurs.amour },
  reservoirEcheance: {
    color: couleurs.attention,
    fontSize: s(11),
    fontWeight: "700",
  },
  notif: {
    flexDirection: "row",
    gap: esp.md,
    padding: esp.lg,
    borderRadius: rayon.lg,
    backgroundColor: couleurs.surfaceElevee,
    borderWidth: 1,
    borderColor: couleurs.liseretVif,
  },
  notifTitre: { color: couleurs.texte, fontSize: s(13), fontWeight: "800" },
  notifTexte: {
    color: couleurs.texteAttenue,
    fontSize: s(12),
    marginTop: s(2),
    lineHeight: s(17),
  },
  fin: { alignItems: "center", gap: esp.lg },
});
