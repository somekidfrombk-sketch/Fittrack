import { useEffect, useMemo, useState } from 'react';

import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { colors } from '../../constants/theme';
import {
  loadProfile as loadStoredProfile,
  saveProfile as persistProfile,
} from '../../services/profile-storage';
import {
  ActivityLevel,
  emptyProfile,
  Goal,
  LossRate,
  ProfileData,
} from '../../types/profile';
import {
  calculateBmi,
  calculateBodyFat,
  calculateBmr,
  calculateCalorieTarget,
  calculateMaintenanceCalories,
} from '../../utils/profile-calculations';
import { calculateMacroTargets } from '../../utils/nutrition';

const activityOptions: {
  value: ActivityLevel;
  label: string;
  description: string;
}[] = [
  {
    value: 'sedentary',
    label: 'Sedentary',
    description:
      'Little or no structured exercise',
  },
  {
    value: 'light',
    label: 'Lightly Active',
    description:
      'Light exercise about 1–3 days per week',
  },
  {
    value: 'moderate',
    label: 'Moderately Active',
    description:
      'Exercise about 3–5 days per week',
  },
  {
    value: 'very',
    label: 'Very Active',
    description:
      'Hard training about 6–7 days per week',
  },
];

const goalOptions: {
  value: Goal;
  label: string;
}[] = [
  {
    value: 'maintain',
    label: 'Maintain',
  },
  {
    value: 'lose',
    label: 'Lose Weight',
  },
  {
    value: 'gain',
    label: 'Gain Weight',
  },
];

const lossRateOptions: LossRate[] = [
  '0.5',
  '1',
  '1.5',
  '2',
];

type NumericProfileField =
  | 'age'
  | 'heightFeet'
  | 'heightInches'
  | 'weight'
  | 'goalWeight'
  | 'neck'
  | 'waist'
  | 'hip'
  | 'calorieTarget'
  | 'proteinTarget'
  | 'carbTarget'
  | 'fatTarget';

const numericProfileFields: NumericProfileField[] = [
  'age',
  'heightFeet',
  'heightInches',
  'weight',
  'goalWeight',
  'neck',
  'waist',
  'hip',
  'calorieTarget',
  'proteinTarget',
  'carbTarget',
  'fatTarget',
];

function normalizeLoadedProfile(
  savedProfile: Partial<ProfileData>
): ProfileData {
  const normalized = {
    ...emptyProfile,
    ...savedProfile,
  } as ProfileData;

  numericProfileFields.forEach((field) => {
    const value = savedProfile[field];
    normalized[field] =
      value === undefined || value === null ? '' : String(value);
  });

  return normalized;
}

function decimalInput(value: string) {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  const [whole = '', ...decimalParts] = normalized.split('.');
  return decimalParts.length > 0
    ? `${whole}.${decimalParts.join('')}`
    : whole;
}

function bmiCategory(bmi: number) {
  if (bmi < 18.5) return 'Below healthy range';
  if (bmi < 25) return 'Healthy range';
  if (bmi < 30) return 'Above healthy range';
  return 'High range';
}

export default function ProfileScreen() {
  const [profile, setProfile] =
    useState<ProfileData>(
      emptyProfile
    );

  const [loaded, setLoaded] =
    useState(false);

  const [keyboardVisible, setKeyboardVisible] =
    useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const hideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  /*
   * LOAD PROFILE
   */

  useEffect(() => {
    const loadSavedProfile = async () => {
      try {
        const savedProfile =
          await loadStoredProfile();

        if (savedProfile) {
          setProfile(
            normalizeLoadedProfile(savedProfile)
          );
        }
      } catch (error) {
        console.error(
          'Failed to load profile:',
          error
        );
      } finally {
        setLoaded(true);
      }
    };

    loadSavedProfile();
  }, []);

  /*
   * UPDATE PROFILE FIELD
   */

  const updateField = <
    K extends keyof ProfileData,
  >(
    field: K,
    value: ProfileData[K]
  ) => {
    setProfile(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  };

  /*
   * HEIGHT
   */

  const heightFeet =
    Number(profile.heightFeet.replace(',', '.')) || 0;
  const heightRemainderInches =
    Number(profile.heightInches.replace(',', '.')) || 0;
  const heightInTotalInches =
    heightFeet * 12 + heightRemainderInches;
  const heightCm =
    heightInTotalInches > 0
      ? heightInTotalInches * 2.54
      : 0;

  /*
   * WEIGHT
   */

  const weightLb =
    Number(profile.weight.replace(',', '.')) || 0;
  const weightKg =
    weightLb > 0 ? weightLb * 0.45359237 : 0;

  /*
   * BMI
   */

  const bmi = calculateBmi(
    weightLb,
    heightInTotalInches
  );

  /*
   * ESTIMATED BODY FAT
   *
   * Uses circumference-based
   * Navy equations.
   */

  const neckInches =
    Number(profile.neck.replace(',', '.')) || 0;
  const waistInches =
    Number(profile.waist.replace(',', '.')) || 0;
  const hipInches =
    Number(profile.hip.replace(',', '.')) || 0;
  const bodyFat = calculateBodyFat({
    gender: profile.gender,
    heightInches: heightInTotalInches,
    waist: waistInches,
    neck: neckInches,
    hip: hipInches,
  });

  /*
   * BMR
   *
   * Mifflin-St Jeor estimate.
   */

  const bmr =
    useMemo(() => {
      return calculateBmr({
        gender: profile.gender,
        age: Number(profile.age),
        weightKg,
        heightCm,
      });
    }, [
      profile.age,
      profile.gender,
      weightKg,
      heightCm,
    ]);

  /*
   * ACTIVITY MULTIPLIER
   */

  /*
   * MAINTENANCE CALORIES
   */

  const maintenanceCalories =
    useMemo(() => {
      return calculateMaintenanceCalories(
        bmr,
        profile.activityLevel
      );
    }, [
      bmr,
      profile.activityLevel,
    ]);

  /*
   * RECOMMENDED CALORIE TARGET
   *
   * Weight-loss rates use the
   * common ~3,500 kcal/lb
   * approximation:
   *
   * 0.5 lb/week ≈ 250/day
   * 1 lb/week   ≈ 500/day
   * 1.5 lb/week ≈ 750/day
   */

  const recommendedCalories =
    useMemo(() => {
      return calculateCalorieTarget({
        bmr,
        maintenanceCalories,
        goal: profile.goal,
        lossRate: profile.lossRate,
      });
    }, [
      maintenanceCalories,
      profile.goal,
      profile.lossRate,
      bmr,
    ]);

  const recommendedMacros =
    useMemo(() => {
      if (
        recommendedCalories ===
        null
      ) {
        return null;
      }

      return calculateMacroTargets({
        calorieTarget:
          recommendedCalories,
        weightLb,
        goal: profile.goal,
        activityLevel:
          profile.activityLevel,
      });
    }, [
      recommendedCalories,
      weightLb,
      profile.goal,
      profile.activityLevel,
    ]);

  /*
   * SAVE PROFILE
   *
   * Save calculated targets
   * into the shared profile so
   * Food can read them.
   */

  const saveProfile =
    async () => {
      try {
        const profileToSave:
          ProfileData = {
            ...profile,

            calorieTarget:
              recommendedCalories !==
              null
                ? String(
                    recommendedCalories
                  )
                : '',

            proteinTarget:
              recommendedMacros !==
              null
                ? String(
                    recommendedMacros.proteinTarget
                  )
                : '',

            carbTarget:
              recommendedMacros !==
              null
                ? String(
                    recommendedMacros.carbTarget
                  )
                : '',

            fatTarget:
              recommendedMacros !==
              null
                ? String(
                    recommendedMacros.fatTarget
                  )
                : '',
          };

        const savedProfile =
          await persistProfile(
          profileToSave
        );

        setProfile(savedProfile);

        Alert.alert(
          'Profile Saved',
          'Your profile and nutrition targets have been saved.'
        );
      } catch (error) {
        console.error(
          'Failed to save profile:',
          error
        );

        Alert.alert(
          'Save Failed',
          'Your profile could not be saved.'
        );
      }
    };

  return (
    <View style={styles.screen}>
    <ScrollView
      contentContainerStyle={
        styles.container
      }
      showsVerticalScrollIndicator={
        false
      }
      keyboardShouldPersistTaps="handled"
    >
      {/* HEADER */}

      <View
        style={
          styles.topRow
        }
      >
        <Pressable
          style={
            styles.backButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backText
            }
          >
            ←
          </Text>
        </Pressable>

        <Text
          style={
            styles.pageTitle
          }
        >
          Profile
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      {/* PROFILE */}

      <View
        style={
          styles.avatarCard
        }
      >
        <View
          style={
            styles.avatar
          }
        >
          <Text
            style={
              styles.avatarText
            }
          >
            👤
          </Text>
        </View>

        <Text
          style={
            styles.profileName
          }
        >
          {profile.name.trim()
            ? profile.name
            : 'Your Profile'}
        </Text>

        <Text
          style={
            styles.profileSubtitle
          }
        >
          Personal information,
          measurements, and goals
        </Text>
      </View>

      {/* PERSONAL INFORMATION */}

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Personal Information
        </Text>

        <Text
          style={
            styles.label
          }
        >
          Name
        </Text>

        <TextInput
          returnKeyType="next"
          value={
            profile.name
          }
          onChangeText={(
            value
          ) =>
            updateField(
              'name',
              value
            )
          }
          placeholder="Your name"
          placeholderTextColor={
            colors.lightMuted
          }
          style={
            styles.input
          }
        />

        <Text
          style={
            styles.label
          }
        >
          Gender / sex used for estimates
        </Text>

        <View
          style={
            styles.optionRow
          }
        >
          <Pressable
            style={[
              styles.optionButton,

              profile.gender ===
                'male' &&
                styles.optionButtonSelected,
            ]}
            onPress={() =>
              updateField(
                'gender',
                'male'
              )
            }
          >
            <Text
              style={[
                styles.optionText,

                profile.gender ===
                  'male' &&
                  styles.optionTextSelected,
              ]}
            >
              Male
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.optionButton,

              profile.gender ===
                'female' &&
                styles.optionButtonSelected,
            ]}
            onPress={() =>
              updateField(
                'gender',
                'female'
              )
            }
          >
            <Text
              style={[
                styles.optionText,

                profile.gender ===
                  'female' &&
                  styles.optionTextSelected,
              ]}
            >
              Female
            </Text>
          </Pressable>
        </View>

        <Text
          style={
            styles.helperText
          }
        >
          This selection is used by
          the calorie and body-fat
          estimation formulas.
        </Text>

        <Text
          style={
            styles.label
          }
        >
          Age
        </Text>

        <TextInput
          returnKeyType="next"
          value={
            profile.age
          }
          onChangeText={(
            value
          ) =>
            updateField(
              'age',
              value.replace(
                /[^0-9]/g,
                ''
              )
            )
          }
          placeholder="Age"
          placeholderTextColor={
            colors.lightMuted
          }
          keyboardType="number-pad"
          maxLength={3}
          style={
            styles.input
          }
        />

        <Text
          style={
            styles.helperText
          }
        >
          Nutrition estimates are for
          adults age 18 and older.
        </Text>

        <Text
          style={
            styles.label
          }
        >
          Height
        </Text>

        <View
          style={
            styles.twoColumnRow
          }
        >
          <View
            style={
              styles.fieldColumn
            }
          >
            <Text
              style={[
                styles.smallLabel,
                heightFeet <= 0 && styles.missingLabel,
              ]}
            >
              Feet
            </Text>

            <TextInput
              returnKeyType="next"
              value={
                profile.heightFeet
              }
              onChangeText={(
                value
              ) =>
                updateField(
                  'heightFeet',
                  value.replace(
                    /[^0-9]/g,
                    ''
                  )
                )
              }
              placeholder="6"
              placeholderTextColor={
                colors.lightMuted
              }
              keyboardType="number-pad"
              maxLength={1}
              style={[
                styles.input,
                heightFeet <= 0 && styles.missingInput,
              ]}
            />
          </View>

          <View
            style={
              styles.fieldColumn
            }
          >
            <Text
              style={styles.smallLabel}
            >
              Inches
            </Text>

            <TextInput
              returnKeyType="next"
              value={
                profile.heightInches
              }
              onChangeText={(
                value
              ) => {
                const numeric =
                  value.replace(
                    /[^0-9]/g,
                    ''
                  );

                if (
                  numeric ===
                    '' ||
                  Number(
                    numeric
                  ) <= 11
                ) {
                  updateField(
                    'heightInches',
                    numeric
                  );
                }
              }}
              placeholder="1"
              placeholderTextColor={
                colors.lightMuted
              }
              keyboardType="number-pad"
              maxLength={2}
              style={
                styles.input
              }
            />
          </View>
        </View>

        <Text
          style={[
            styles.label,
            weightLb <= 0 && styles.missingLabel,
          ]}
        >
          Current weight (lb)
        </Text>

        <TextInput
          returnKeyType="next"
          value={
            profile.weight
          }
          onChangeText={(
            value
          ) =>
            updateField(
              'weight',
              decimalInput(value)
            )
          }
          placeholder="Weight"
          placeholderTextColor={
            colors.lightMuted
          }
          keyboardType="decimal-pad"
          style={[
            styles.input,
            weightLb <= 0 && styles.missingInput,
          ]}
        />

        <View style={styles.liveBmiCard}>
          <Text style={styles.liveBmiLabel}>LIVE BMI</Text>
          {bmi !== null ? (
            <>
              <Text style={styles.liveBmiValue}>{bmi.toFixed(1)}</Text>
              <Text style={styles.liveBmiStatus}>{bmiCategory(bmi)}</Text>
            </>
          ) : (
            <Text style={[styles.liveBmiMissing, styles.missingText]}>
              Enter both height and current weight to calculate BMI.
            </Text>
          )}
        </View>
      </View>

      {/* BODY MEASUREMENTS */}

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Body Measurements
        </Text>

        <Text
          style={[
            styles.label,
            neckInches <= 0 && styles.missingLabel,
          ]}
        >
          Neck (inches)
        </Text>

        <TextInput
          returnKeyType="next"
          value={
            profile.neck
          }
          onChangeText={(
            value
          ) =>
            updateField(
              'neck',
              decimalInput(value)
            )
          }
          placeholder="Neck"
          placeholderTextColor={
            colors.lightMuted
          }
          keyboardType="decimal-pad"
          style={[
            styles.input,
            neckInches <= 0 && styles.missingInput,
          ]}
        />

        <Text
          style={[
            styles.label,
            waistInches <= 0 && styles.missingLabel,
          ]}
        >
          Waist (inches)
        </Text>

        <TextInput
          returnKeyType="next"
          value={
            profile.waist
          }
          onChangeText={(
            value
          ) =>
            updateField(
              'waist',
              decimalInput(value)
            )
          }
          placeholder="Waist"
          placeholderTextColor={
            colors.lightMuted
          }
          keyboardType="decimal-pad"
          style={[
            styles.input,
            waistInches <= 0 && styles.missingInput,
          ]}
        />

        {profile.gender ===
        'female' ? (
          <>
            <Text
              style={[
                styles.label,
                hipInches <= 0 && styles.missingLabel,
              ]}
            >
              Hip (inches)
            </Text>

            <TextInput
              returnKeyType="next"
              value={
                profile.hip
              }
              onChangeText={(
                value
              ) =>
                updateField(
                  'hip',
                  decimalInput(value)
                )
              }
              placeholder="Hip"
              placeholderTextColor={
                colors.lightMuted
              }
              keyboardType="decimal-pad"
              style={[
                styles.input,
                hipInches <= 0 && styles.missingInput,
              ]}
            />
          </>
        ) : null}
      </View>

      {/* BODY METRICS */}

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Body Metrics
        </Text>

        <View
          style={
            styles.metricRow
          }
        >
          <View
            style={
              styles.metricBox
            }
          >
            <Text
              style={
                styles.metricLabel
              }
            >
              BMI
            </Text>

            <Text
              style={
                styles.metricValue
              }
            >
              {bmi !== null
                ? bmi.toFixed(
                    1
                  )
                : '—'}
            </Text>
          </View>

          <View
            style={
              styles.metricBox
            }
          >
            <Text
              style={
                styles.metricLabel
              }
            >
              BODY FAT
            </Text>

            <Text
              style={
                styles.metricValue
              }
            >
              {bodyFat !==
                null &&
              Number.isFinite(
                bodyFat
              )
                ? `${bodyFat.toFixed(
                    1
                  )}%`
                : '—'}
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.metricExplanation,
            bmi === null && styles.missingText,
          ]}
        >
          {bmi === null
            ? `BMI needs height and weight. Current values: ${
                heightInTotalInches > 0
                  ? `${heightFeet} ft ${heightRemainderInches} in`
                  : 'height missing'
              }, ${weightLb > 0 ? `${weightLb} lb` : 'weight missing'}.`
            : `BMI is calculated from ${heightFeet} ft ${heightRemainderInches} in and ${weightLb} lb.`}
        </Text>

        <Text
          style={[
            styles.metricExplanation,
            bodyFat === null && styles.missingText,
          ]}
        >
          {bodyFat === null
            ? `Body fat needs height, neck, waist${
                profile.gender === 'female' ? ', and hip' : ''
              } measurements in inches.`
            : 'Body fat is estimated from your circumference measurements.'}
        </Text>
      </View>

      {/* ACTIVITY */}

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Activity Level
        </Text>

        {activityOptions.map(
          (option) => {
            const selected =
              profile.activityLevel ===
              option.value;

            return (
              <Pressable
                key={
                  option.value
                }
                style={[
                  styles.listOption,

                  selected &&
                    styles.listOptionSelected,
                ]}
                onPress={() =>
                  updateField(
                    'activityLevel',
                    option.value
                  )
                }
              >
                <Text
                  style={[
                    styles.listOptionText,

                    selected &&
                      styles.listOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>

                <Text
                  style={[
                    styles.listOptionDescription,

                    selected &&
                      styles.listOptionDescriptionSelected,
                  ]}
                >
                  {
                    option.description
                  }
                </Text>
              </Pressable>
            );
          }
        )}
      </View>

      {/* GOAL */}

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Goal
        </Text>

        <View
          style={
            styles.optionWrap
          }
        >
          {goalOptions.map(
            (option) => {
              const selected =
                profile.goal ===
                option.value;

              return (
                <Pressable
                  key={
                    option.value
                  }
                  style={[
                    styles.goalButton,

                    selected &&
                      styles.optionButtonSelected,
                  ]}
                  onPress={() =>
                    updateField(
                      'goal',
                      option.value
                    )
                  }
                >
                  <Text
                    style={[
                      styles.optionText,

                      selected &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {
                      option.label
                    }
                  </Text>
                </Pressable>
              );
            }
          )}
        </View>

        {profile.goal ===
        'lose' ? (
          <>
            <Text
              style={
                styles.label
              }
            >
              Target weight loss
            </Text>

            <View
              style={
                styles.optionRow
              }
            >
              {lossRateOptions.map(
                (rate) => {
                  const selected =
                    profile.lossRate ===
                    rate;

                  return (
                    <Pressable
                      key={
                        rate
                      }
                      style={[
                        styles.optionButton,

                        selected &&
                          styles.optionButtonSelected,
                      ]}
                      onPress={() =>
                        updateField(
                          'lossRate',
                          rate
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.optionText,

                          selected &&
                            styles.optionTextSelected,
                        ]}
                      >
                        {rate}{' '}
                        lb/wk
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>
          </>
        ) : null}

        <Text
          style={
            styles.label
          }
        >
          Goal weight (lb)
        </Text>

        <TextInput
          returnKeyType="done"
          value={
            profile.goalWeight
          }
          onChangeText={(
            value
          ) =>
            updateField(
              'goalWeight',
              value.replace(
                /[^0-9.]/g,
                ''
              )
            )
          }
          placeholder="Goal weight"
          placeholderTextColor={
            colors.lightMuted
          }
          keyboardType="decimal-pad"
          style={
            styles.input
          }
        />
      </View>

      {/* NUTRITION TARGETS */}

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Nutrition Targets
        </Text>

        <View
          style={
            styles.metricRow
          }
        >
          <View
            style={
              styles.metricBox
            }
          >
            <Text
              style={
                styles.metricLabel
              }
            >
              BMR
            </Text>

            <Text
              style={
                styles.metricValueSmall
              }
            >
              {bmr !== null
                ? Math.round(
                    bmr
                  ).toLocaleString()
                : '—'}
            </Text>

            <Text
              style={
                styles.metricUnit
              }
            >
              kcal/day
            </Text>
          </View>

          <View
            style={
              styles.metricBox
            }
          >
            <Text
              style={
                styles.metricLabel
              }
            >
              MAINTENANCE
            </Text>

            <Text
              style={
                styles.metricValueSmall
              }
            >
              {maintenanceCalories !==
              null
                ? maintenanceCalories.toLocaleString()
                : '—'}
            </Text>

            <Text
              style={
                styles.metricUnit
              }
            >
              kcal/day
            </Text>
          </View>
        </View>

        <View
          style={
            styles.targetCard
          }
        >
          <Text
            style={
              styles.targetLabel
            }
          >
            DAILY CALORIE TARGET
          </Text>

          <Text
            style={
              styles.targetValue
            }
          >
            {recommendedCalories !==
            null
              ? recommendedCalories.toLocaleString()
              : '—'}
          </Text>

          <Text
            style={
              styles.targetUnit
            }
          >
            kcal per day
          </Text>

          {profile.goal ===
          'lose' ? (
            <Text
              style={
                styles.targetNote
              }
            >
              Based on approximately{' '}
              {
                profile.lossRate
              }{' '}
              lb of weight loss per
              week.
            </Text>
          ) : null}

          {profile.goal ===
          'gain' ? (
            <Text
              style={
                styles.targetNote
              }
            >
              Includes an estimated
              250-calorie daily
              surplus.
            </Text>
          ) : null}
        </View>

        <View
          style={
            styles.macroTargetRow
          }
        >
          {[
            {
              label: 'PROTEIN',
              value:
                recommendedMacros?.proteinTarget,
            },
            {
              label: 'CARBS',
              value:
                recommendedMacros?.carbTarget,
            },
            {
              label: 'FAT',
              value:
                recommendedMacros?.fatTarget,
            },
          ].map((macro) => (
            <View
              key={macro.label}
              style={
                styles.macroTargetCard
              }
            >
              <Text
                style={
                  styles.targetLabel
                }
              >
                {macro.label}
              </Text>

              <Text
                style={
                  styles.proteinValue
                }
              >
                {macro.value !==
                undefined
                  ? macro.value.toLocaleString()
                  : '—'}
              </Text>

              <Text
                style={
                  styles.targetUnit
                }
              >
                g/day
              </Text>
            </View>
          ))}
        </View>

        <Text
          style={
            styles.disclaimer
          }
        >
          Calorie and body-composition
          values are estimates. Actual
          energy needs vary and can be
          adjusted based on real weight
          trends and performance.
        </Text>
      </View>

      {/* SAVE */}

      <Pressable
        style={[
          styles.saveButton,

          !loaded &&
            styles.saveButtonDisabled,
        ]}
        onPress={
          saveProfile
        }
        disabled={
          !loaded
        }
      >
        <Text
          style={
            styles.saveButtonText
          }
        >
          Save Profile & Targets
        </Text>
      </Pressable>

    </ScrollView>

    {keyboardVisible ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close keyboard"
        style={styles.closeKeyboardButton}
        onPress={Keyboard.dismiss}
      >
        <Text style={styles.closeKeyboardText}>Close Keyboard ↓</Text>
      </Pressable>
    ) : null}
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    container: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 100,
      backgroundColor:
        colors.background,
    },

    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 22,
    },

    backButton: {
      width: 48,
      height: 48,
      borderRadius: 15,
      backgroundColor:
        colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },

    backText: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.text,
    },

    pageTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 28,
      fontWeight: '900',
      color: colors.text,
    },

    headerSpacer: {
      width: 48,
    },

    avatarCard: {
      backgroundColor:
        colors.surface,
      borderRadius: 22,
      padding: 22,
      alignItems: 'center',
      marginBottom: 16,
    },

    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor:
        colors.soft2,
      alignItems: 'center',
      justifyContent: 'center',
    },

    avatarText: {
      fontSize: 40,
    },

    profileName: {
      marginTop: 14,
      fontSize: 22,
      fontWeight: '900',
      color: colors.text,
    },

    profileSubtitle: {
      marginTop: 5,
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
    },

    card: {
      backgroundColor:
        colors.surface,
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.text,
      marginBottom: 16,
    },

    label: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.muted,
      marginBottom: 7,
      marginTop: 12,
    },

    smallLabel: {
      fontSize: 11,
      fontWeight: '800',
      color:
        colors.lightMuted,
      marginBottom: 6,
    },

    helperText: {
      marginTop: 8,
      fontSize: 11,
      lineHeight: 16,
      color:
        colors.lightMuted,
    },

    input: {
      backgroundColor:
        colors.soft2,
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 12,
      color: colors.text,
      fontWeight: '700',
    },

    missingLabel: {
      color: '#DC2626',
    },

    missingInput: {
      borderWidth: 1.5,
      borderColor: '#DC2626',
      backgroundColor: '#FEF2F2',
    },

    missingText: {
      color: '#DC2626',
      fontWeight: '700',
    },

    liveBmiCard: {
      marginTop: 12,
      borderRadius: 14,
      padding: 14,
      backgroundColor: colors.soft2,
    },

    liveBmiLabel: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      color: colors.lightMuted,
    },

    liveBmiValue: {
      marginTop: 4,
      fontSize: 28,
      fontWeight: '900',
      color: colors.text,
    },

    liveBmiStatus: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
    },

    liveBmiMissing: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
    },

    twoColumnRow: {
      flexDirection: 'row',
      gap: 10,
    },

    fieldColumn: {
      flex: 1,
    },

    optionRow: {
      flexDirection: 'row',
      gap: 8,
    },

    optionWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    optionButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      backgroundColor:
        colors.soft2,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },

    goalButton: {
      minWidth: '30%',
      flexGrow: 1,
      minHeight: 46,
      borderRadius: 12,
      backgroundColor:
        colors.soft2,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },

    optionButtonSelected: {
      backgroundColor:
        colors.text,
    },

    optionText: {
      color: colors.muted,
      fontWeight: '800',
      fontSize: 12,
      textAlign: 'center',
    },

    optionTextSelected: {
      color:
        colors.surface,
    },

    metricRow: {
      flexDirection: 'row',
      gap: 10,
    },

    metricBox: {
      flex: 1,
      backgroundColor:
        colors.soft2,
      borderRadius: 16,
      padding: 16,
    },

    metricLabel: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      color:
        colors.lightMuted,
    },

    metricValue: {
      marginTop: 6,
      fontSize: 26,
      fontWeight: '900',
      color: colors.text,
    },

    metricValueSmall: {
      marginTop: 6,
      fontSize: 21,
      fontWeight: '900',
      color: colors.text,
    },

    metricUnit: {
      marginTop: 2,
      fontSize: 10,
      color: colors.muted,
    },

    metricExplanation: {
      marginTop: 10,
      fontSize: 11,
      lineHeight: 17,
      color: colors.muted,
    },

    listOption: {
      backgroundColor:
        colors.soft2,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      marginBottom: 8,
    },

    listOptionSelected: {
      backgroundColor:
        colors.text,
    },

    listOptionText: {
      fontSize: 13,
      fontWeight: '900',
      color: colors.muted,
    },

    listOptionTextSelected: {
      color:
        colors.surface,
    },

    listOptionDescription: {
      marginTop: 3,
      fontSize: 11,
      color:
        colors.lightMuted,
    },

    listOptionDescriptionSelected: {
      color:
        colors.surface,
      opacity: 0.75,
    },

    targetCard: {
      marginTop: 14,
      backgroundColor:
        colors.soft2,
      borderRadius: 18,
      padding: 18,
    },

    targetLabel: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
      color:
        colors.lightMuted,
    },

    targetValue: {
      marginTop: 4,
      fontSize: 38,
      fontWeight: '900',
      color: colors.text,
    },

    targetUnit: {
      fontSize: 11,
      color: colors.muted,
    },

    targetNote: {
      marginTop: 10,
      fontSize: 11,
      lineHeight: 16,
      color:
        colors.lightMuted,
    },

    macroTargetRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 10,
    },

    macroTargetCard: {
      flexGrow: 1,
      flexBasis: 90,
      backgroundColor:
        colors.soft2,
      borderRadius: 18,
      padding: 18,
    },

    proteinValue: {
      marginTop: 4,
      fontSize: 30,
      fontWeight: '900',
      color: colors.text,
    },

    disclaimer: {
      marginTop: 14,
      fontSize: 11,
      lineHeight: 17,
      color:
        colors.lightMuted,
    },

    saveButton: {
      backgroundColor:
        colors.text,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },

    saveButtonDisabled: {
      opacity: 0.4,
    },

    saveButtonText: {
      color:
        colors.surface,
      fontWeight: '900',
      fontSize: 15,
    },

    keyboardToolbar: {
      minHeight: 50,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderTopWidth: 1,
      borderTopColor: colors.soft,
      backgroundColor: colors.surface,
    },

    closeKeyboardButton: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 54 : 34,
      right: 18,
      minHeight: 48,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.text,
      zIndex: 100,
      elevation: 12,
    },

    closeKeyboardText: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.surface,
    },

    keyboardDoneButton: {
      minWidth: 88,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
      backgroundColor: colors.text,
    },

    keyboardDoneText: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.surface,
    },
  });
