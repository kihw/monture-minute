// Texte de l'app en Nunito (direction « Chaleureux »). Une police chargée n'a qu'une graisse par
// nom de famille, et Android ignore fontWeight sur une police chargée : ce composant lit la graisse
// demandée par le style et choisit la famille Nunito correspondante, partout dans l'app.
// À importer à la place de `Text` de react-native.

import { createContext, forwardRef, useContext } from 'react';
import { Text as TexteNatif, StyleSheet, TextProps, TextStyle } from 'react-native';

import { familleNunito } from '../theme';

/** Vrai à l'intérieur d'un texte : un passage imbriqué sans graisse propre hérite de son parent. */
const DansTexte = createContext(false);

export const Text = forwardRef<TexteNatif, TextProps>(function Text({ style, children, ...props }, ref) {
  const imbrique = useContext(DansTexte);
  const aplati = StyleSheet.flatten(style) as TextStyle | undefined;
  // Police imposée, ou passage imbriqué sans graisse : on laisse faire (héritage du parent).
  const garder = Boolean(aplati?.fontFamily) || (imbrique && aplati?.fontWeight === undefined);
  return (
    <TexteNatif
      ref={ref}
      style={garder ? style : [style, { fontFamily: familleNunito(aplati?.fontWeight), fontWeight: 'normal' }]}
      {...props}
    >
      <DansTexte.Provider value>{children}</DansTexte.Provider>
    </TexteNatif>
  );
});
