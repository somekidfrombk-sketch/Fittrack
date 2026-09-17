import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Body, { type ExtendedBodyPart, type Slug } from 'react-muscle-highlighter';

export type MuscleFocusLabel =
  | 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Forearms'
  | 'Core' | 'Glutes' | 'Quadriceps' | 'Hamstrings' | 'Calves';

type Props = {
  selectedMuscles: MuscleFocusLabel[];
  onToggleMuscle: (muscle: MuscleFocusLabel) => void;
};

const muscleSlugs: Record<MuscleFocusLabel, Slug[]> = {
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

const slugToMuscle = Object.entries(muscleSlugs).reduce<Partial<Record<Slug, MuscleFocusLabel>>>(
  (lookup, [muscle, slugs]) => {
    slugs.forEach((slug) => { lookup[slug] = muscle as MuscleFocusLabel; });
    return lookup;
  },
  {}
);

const disabledParts: Slug[] = [
  'adductors', 'ankles', 'feet', 'hands', 'hair', 'head', 'knees', 'neck', 'tibialis',
];

export default function InteractiveMuscleMap({ selectedMuscles, onToggleMuscle }: Props) {
  const bodyData = useMemo<ExtendedBodyPart[]>(
    () => selectedMuscles.flatMap((muscle) =>
      muscleSlugs[muscle].map((slug) => ({
        slug,
        styles: { fill: '#EF4444', stroke: '#B91C1C', strokeWidth: 2 },
      }))
    ),
    [selectedMuscles]
  );

  const handleBodyPartPress = (part: ExtendedBodyPart) => {
    if (!part.slug) return;
    const muscle = slugToMuscle[part.slug];
    if (muscle) onToggleMuscle(muscle);
  };

  return (
    <View
      style={styles.container}
      accessibilityLabel="Interactive front and back muscle selector"
    >
      <Body
        data={bodyData}
        side="front"
        gender="male"
        scale={0.9}
        border="#64748B"
        defaultFill="#CBD5E1"
        defaultStroke="#64748B"
        defaultStrokeWidth={1}
        disabledParts={disabledParts}
        onBodyPartPress={handleBodyPartPress}
      />
      <Body
        data={bodyData}
        side="back"
        gender="male"
        scale={0.9}
        border="#64748B"
        defaultFill="#CBD5E1"
        defaultStroke="#64748B"
        defaultStrokeWidth={1}
        disabledParts={disabledParts}
        onBodyPartPress={handleBodyPartPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 360,
    width: '100%',
  },
});
