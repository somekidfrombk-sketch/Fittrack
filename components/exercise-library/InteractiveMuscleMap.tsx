import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import bodyModels from '../../assets/data/react-muscle-highlighter-male.json';

export type MuscleFocusLabel =
  | 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Forearms'
  | 'Core' | 'Glutes' | 'Quadriceps' | 'Hamstrings' | 'Calves';

type Props = {
  selectedMuscles: MuscleFocusLabel[];
  onToggleMuscle: (muscle: MuscleFocusLabel) => void;
};

type MuscleSlug =
  | 'abs' | 'adductors' | 'ankles' | 'biceps' | 'calves' | 'chest'
  | 'deltoids' | 'feet' | 'forearm' | 'gluteal' | 'hamstring' | 'hands'
  | 'hair' | 'head' | 'knees' | 'lower-back' | 'neck' | 'obliques'
  | 'quadriceps' | 'tibialis' | 'trapezius' | 'triceps' | 'upper-back';

type BodyPart = {
  slug?: MuscleSlug;
  path?: { common?: string[]; left?: string[]; right?: string[] };
};

type BodySide = 'front' | 'back';

const muscleSlugs: Record<MuscleFocusLabel, MuscleSlug[]> = {
  Chest: ['chest'],
  Back: ['trapezius', 'upper-back', 'lower-back'],
  Shoulders: ['deltoids'],
  Biceps: ['biceps'],
  Triceps: ['triceps'],
  Forearms: ['forearm'],
  Core: ['abs', 'obliques'],
  Glutes: ['gluteal'],
  Quadriceps: ['quadriceps'],
  Hamstrings: ['hamstring'],
  Calves: ['calves'],
};

const slugToMuscle = Object.entries(muscleSlugs).reduce<Partial<Record<MuscleSlug, MuscleFocusLabel>>>(
  (lookup, [muscle, slugs]) => {
    slugs.forEach((slug) => { lookup[slug] = muscle as MuscleFocusLabel; });
    return lookup;
  },
  {}
);

const models: Record<BodySide, BodyPart[]> = bodyModels as Record<BodySide, BodyPart[]>;

function NativeBody({ side, selected, onToggleMuscle }: {
  side: BodySide;
  selected: Set<MuscleFocusLabel>;
  onToggleMuscle: (muscle: MuscleFocusLabel) => void;
}) {
  return (
    <Svg
      accessibilityLabel={`${side} muscle model`}
      height="100%"
      viewBox={side === 'front' ? '0 0 724 1448' : '724 0 724 1448'}
      width="100%"
    >
      {models[side].flatMap((part) => {
        const muscle = part.slug ? slugToMuscle[part.slug] : undefined;
        const isSelected = muscle ? selected.has(muscle) : false;
        const paths = [
          ...(part.path?.common ?? []),
          ...(part.path?.left ?? []),
          ...(part.path?.right ?? []),
        ];

        return paths.map((path, index) => (
          <Path
            d={path}
            fill={isSelected ? '#EF4444' : '#CBD5E1'}
            key={`${side}-${part.slug ?? 'part'}-${index}`}
            onPress={muscle ? () => onToggleMuscle(muscle) : undefined}
            stroke={isSelected ? '#B91C1C' : '#64748B'}
            strokeWidth={isSelected ? 2 : 1}
          />
        ));
      })}
    </Svg>
  );
}

export default function InteractiveMuscleMap({ selectedMuscles, onToggleMuscle }: Props) {
  const selected = useMemo(() => new Set(selectedMuscles), [selectedMuscles]);

  return (
    <View
      accessibilityLabel="Interactive front and back muscle selector"
      style={styles.container}
    >
      <View style={styles.body}>
        <NativeBody side="front" selected={selected} onToggleMuscle={onToggleMuscle} />
      </View>
      <View style={styles.body}>
        <NativeBody side="back" selected={selected} onToggleMuscle={onToggleMuscle} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { aspectRatio: 1 / 2, height: '100%', maxWidth: '50%' },
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 360,
    justifyContent: 'center',
    width: '100%',
  },
});