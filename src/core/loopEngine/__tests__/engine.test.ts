import { describe, it, expect } from 'vitest';
import { MountStat, Tier } from '@/types/breeding';
import { createMount } from '@/types/enclosure';
import { evaluate, startLoopInstance, pauseLoopInstance, resumeLoopInstance, interruptLoopInstance } from '../engine';
import { STRATEGY_CATALOG, BREEDING_STRATEGY } from '../catalog';
import { LoopDefinition } from '../types';

const TIER_1 = () => 1 as const;

describe('evaluate — stratégie d’élevage, cas nominal', () => {
  it('recommande de stabiliser la sérénité vers l’extrémité la plus proche (-5000) avant toute jauge', () => {
    const mount = createMount();
    mount.serenity = -1_000; // plus proche de -5000 que de +5000
    const instance = startLoopInstance(BREEDING_STRATEGY, 0);

    const result = evaluate(mount, instance, STRATEGY_CATALOG, TIER_1);

    expect(result.decision.reason).toBe('objectif-non-atteint');
    expect(result.decision.action).toEqual({ stat: 'serenity', direction: 'decrease', tier: 1 });
    expect(result.decision.targetValue).toBe(-5_000);
    expect(result.instance.stepId).toBe('guard1');
  });

  it('vise l’extrémité haute (+5000) quand elle est la plus proche', () => {
    const mount = createMount();
    mount.serenity = 1_000; // plus proche de +5000 que de -5000
    const instance = startLoopInstance(BREEDING_STRATEGY, 0);

    const result = evaluate(mount, instance, STRATEGY_CATALOG, TIER_1);

    expect(result.decision.action).toEqual({ stat: 'serenity', direction: 'increase', tier: 1 });
    expect(result.decision.targetValue).toBe(5_000);
  });

  it('une monture déjà « équilibrée » (sérénité déjà à une extrémité) saute directement au remplissage des jauges, sans action inutile', () => {
    const mount = createMount();
    mount.serenity = -5_000; // déjà à l'extrémité : rien à faire ici
    const instance = startLoopInstance(BREEDING_STRATEGY, 0);

    const result = evaluate(mount, instance, STRATEGY_CATALOG, TIER_1);

    expect(result.instance.stepId).toBe('fill-endurance');
    expect(result.decision.action).toEqual({ stat: 'endurance', direction: 'increase', tier: 1 });
  });

  it('le joueur peut déclarer la monture déjà équilibrée même loin d’une extrémité numérique : la stratégie ne force rien', () => {
    const mount = createMount();
    mount.serenity = -100; // ni à -5000 ni à +5000
    mount.serenityEquilibrated = true; // mais le joueur sait que ce n'est pas la peine ici
    const instance = startLoopInstance(BREEDING_STRATEGY, 0);

    const result = evaluate(mount, instance, STRATEGY_CATALOG, TIER_1);

    expect(result.instance.stepId).toBe('fill-endurance');
    expect(result.decision.action?.stat).toBe('endurance');
  });

  it('sans la déclaration du joueur, la même sérénité à -100 recommande bien de la stabiliser', () => {
    const mount = createMount();
    mount.serenity = -100;
    const instance = startLoopInstance(BREEDING_STRATEGY, 0);

    const result = evaluate(mount, instance, STRATEGY_CATALOG, TIER_1);

    expect(result.decision.action?.stat).toBe('serenity');
  });

  it('l’autre extrémité (+5000) suffit tout autant : peu importe laquelle, pas de trajet imposé', () => {
    const mount = createMount();
    mount.serenity = 5_000;
    const instance = startLoopInstance(BREEDING_STRATEGY, 0);

    const result = evaluate(mount, instance, STRATEGY_CATALOG, TIER_1);

    expect(result.instance.stepId).toBe('fill-endurance');
  });

  it('saute directement à Maturité si la sérénité est déjà extrême et Endurance déjà au plafond, en une seule évaluation (aucun temps perdu)', () => {
    const mount = createMount();
    mount.serenity = 5_000;
    mount.endurance = 20_000;
    const instance = startLoopInstance(BREEDING_STRATEGY, 0);

    const result = evaluate(mount, instance, STRATEGY_CATALOG, TIER_1);

    expect(result.instance.stepId).toBe('fill-maturity');
  });

  it('régule de nouveau la sérénité entre deux jauges si elle a dérivé en jeu depuis la dernière visite', () => {
    const mount = createMount();
    mount.serenity = 2_000; // ni à -5000 ni à +5000 : a dérivé depuis la dernière stabilisation
    mount.endurance = 20_000; // Endurance déjà terminée
    const instance = { loopId: BREEDING_STRATEGY.id, stepId: 'guard2', status: 'running' as const, startedAt: 0 };

    const result = evaluate(mount, instance, STRATEGY_CATALOG, TIER_1);

    expect(result.instance.stepId).toBe('guard2');
    expect(result.decision.action?.direction).toBe('increase'); // 2000 plus proche de +5000
    expect(result.decision.targetValue).toBe(5_000);
  });

  it('termine la stratégie sans phase XP si aucun niveau cible n’a été configuré', () => {
    const mount = createMount();
    mount.serenity = 500;
    mount.endurance = 20_000;
    mount.maturity = 20_000;
    mount.love = 20_000;
    // xpTarget par défaut (0) <= xp (0) : pas de cible réelle configurée.
    const instance = { loopId: BREEDING_STRATEGY.id, stepId: 'fill-love', status: 'running' as const, startedAt: 0 };

    const result = evaluate(mount, instance, STRATEGY_CATALOG, TIER_1);

    expect(result.decision.reason).toBe('boucle-terminee');
  });

  it('enchaîne sur la phase XP si un niveau cible a été configuré au-delà de l’XP actuelle', () => {
    const mount = createMount();
    mount.serenity = 500;
    mount.endurance = 20_000;
    mount.maturity = 20_000;
    mount.love = 20_000;
    mount.xp = 1_000;
    mount.xpTarget = 50_000; // le joueur vise un niveau précis
    const instance = { loopId: BREEDING_STRATEGY.id, stepId: 'fill-love', status: 'running' as const, startedAt: 0 };

    const result = evaluate(mount, instance, STRATEGY_CATALOG, TIER_1);

    expect(result.instance.stepId).toBe('fill-xp');
    expect(result.decision.action).toEqual({ stat: 'xp', direction: 'increase', tier: 1 });
    expect(result.decision.targetValue).toBe(50_000);
  });

  it('termine après la phase XP une fois le niveau cible atteint', () => {
    const mount = createMount();
    mount.xp = 50_000;
    mount.xpTarget = 50_000;
    const instance = { loopId: BREEDING_STRATEGY.id, stepId: 'fill-xp', status: 'running' as const, startedAt: 0 };

    const result = evaluate(mount, instance, STRATEGY_CATALOG, TIER_1);

    expect(result.decision.reason).toBe('boucle-terminee');
  });

  it('résout le tier par jauge : la jauge recommandée peut utiliser un tier différent', () => {
    const mount = createMount();
    const instance = { loopId: BREEDING_STRATEGY.id, stepId: 'fill-endurance', status: 'running' as const, startedAt: 0 };
    const tierFor = (stat: MountStat): Tier => (stat === 'endurance' ? 3 : 1);

    const result = evaluate(mount, instance, STRATEGY_CATALOG, tierFor);

    expect(result.decision.action?.stat).toBe('endurance');
    expect(result.decision.action?.tier).toBe(3);
  });

  it('est stable/répétable : une réévaluation sans changement d’état redonne la même décision', () => {
    const mount = createMount();
    mount.serenity = -1_000;
    const instance = startLoopInstance(BREEDING_STRATEGY, 0);

    const first = evaluate(mount, instance, STRATEGY_CATALOG, TIER_1);
    const second = evaluate(mount, first.instance, STRATEGY_CATALOG, TIER_1);

    expect(second.decision).toEqual(first.decision);
  });
});

describe('evaluate — pause / interruption / reprise', () => {
  it('ne recommande aucune action quand la boucle est en pause', () => {
    const mount = createMount();
    const paused = pauseLoopInstance(startLoopInstance(BREEDING_STRATEGY, 0));

    const result = evaluate(mount, paused, STRATEGY_CATALOG, TIER_1);

    expect(result.decision.reason).toBe('boucle-en-pause');
    expect(result.decision.action).toBeNull();
  });

  it('ne recommande aucune action quand la boucle est interrompue', () => {
    const mount = createMount();
    const interrupted = interruptLoopInstance(startLoopInstance(BREEDING_STRATEGY, 0));

    const result = evaluate(mount, interrupted, STRATEGY_CATALOG, TIER_1);

    expect(result.decision.reason).toBe('boucle-interrompue');
  });

  it('reprend normalement après résolution d’une pause', () => {
    const mount = createMount();
    mount.serenity = -1_000;
    const resumed = resumeLoopInstance(pauseLoopInstance(startLoopInstance(BREEDING_STRATEGY, 0)));

    const result = evaluate(mount, resumed, STRATEGY_CATALOG, TIER_1);

    expect(result.decision.reason).toBe('objectif-non-atteint');
    expect(result.instance.status).toBe('running');
  });

  it('n’interrompt pas une boucle déjà terminée', () => {
    const completed = { loopId: BREEDING_STRATEGY.id, stepId: 'fill-love', status: 'completed' as const, startedAt: 0 };
    expect(interruptLoopInstance(completed).status).toBe('completed');
  });
});

describe('evaluate — cas particuliers / données manquantes', () => {
  it('rend "données manquantes" sans monture', () => {
    const instance = startLoopInstance(BREEDING_STRATEGY, 0);
    const result = evaluate(null, instance, STRATEGY_CATALOG, TIER_1);
    expect(result.decision.reason).toBe('donnees-manquantes');
  });

  it('rend "données manquantes" sans instance active (mode manuel pur)', () => {
    const result = evaluate(createMount(), null, STRATEGY_CATALOG, TIER_1);
    expect(result.decision.reason).toBe('donnees-manquantes');
  });

  it('rend "données manquantes" si la définition de boucle référencée n’existe plus', () => {
    const instance = { loopId: 'boucle-inconnue', stepId: 'x', status: 'running' as const, startedAt: 0 };
    const result = evaluate(createMount(), instance, STRATEGY_CATALOG, TIER_1);
    expect(result.decision.reason).toBe('donnees-manquantes');
  });

  it('rend "données manquantes" si l’étape référencée n’existe plus (état inattendu)', () => {
    const instance = { loopId: BREEDING_STRATEGY.id, stepId: 'etape-fantome', status: 'running' as const, startedAt: 0 };
    const result = evaluate(createMount(), instance, STRATEGY_CATALOG, TIER_1);
    expect(result.decision.reason).toBe('donnees-manquantes');
  });

  it('ne boucle pas indéfiniment sur une définition mal formée (cycle de transitions)', () => {
    const cyclic: LoopDefinition = {
      id: 'cycle',
      label: 'Boucle cyclique invalide',
      entryStepId: 'a',
      steps: [
        { id: 'a', label: 'A', stat: 'serenity', exitConditions: [{ stat: 'serenity', operator: 'gte', value: -99_999 }] },
        { id: 'b', label: 'B', stat: 'serenity', exitConditions: [{ stat: 'serenity', operator: 'gte', value: -99_999 }] },
      ],
      transitions: [
        { fromStepId: 'a', toStepId: 'b' },
        { fromStepId: 'b', toStepId: 'a' },
      ],
    };
    const instance = startLoopInstance(cyclic, 0);
    const result = evaluate(createMount(), instance, [cyclic], TIER_1);
    expect(['a', 'b']).toContain(result.instance.stepId);
  });
});
