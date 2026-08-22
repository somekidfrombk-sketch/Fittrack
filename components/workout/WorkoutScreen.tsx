import { useEffect, useMemo, useState } from 'react';

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../../constants/theme';
import { useRestTimer } from '../../hooks/use-rest-timer';
import {
  getOrCreateProfileId,
  loadProfile,
} from '../../services/profile-storage';
import {
  loadWorkoutHistory as loadStoredWorkoutHistory,
  saveWorkoutHistory as persistWorkoutHistory,
} from '../../services/workout-history-storage';
import { WorkoutExercise } from '../../types/workout';

import {
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutIntensity,
  WorkoutHistorySet,
} from '../../types/workoutHistory';
import { estimateWorkoutCalories } from '../../utils/workout-calories';

import { WorkoutPlan } from '../../types/workoutPlan';

import ExerciseLibrary from '../exercise-library/ExerciseLibrary';
import { ExerciseRecord } from '../exercise-library/exerciseData';

import ExerciseCard from './ExerciseCard';
import WorkoutHistory from './WorkoutHistory';
import WorkoutPlanner from './WorkoutPlanner';
import WorkoutSummary from './WorkoutSummary';

import {
  createId,
  formatTime,
} from './workoutUtils';

type ExerciseSelection = {
  exercise: ExerciseRecord;
  sets: number;
  reps: number;
  restSeconds: number;
};

export default function WorkoutScreen() {
  const [profileId, setProfileId] =
    useState('');
  const [startedAt, setStartedAt] =
    useState<number | null>(null);

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);

  const [profileWeightLb, setProfileWeightLb] =
    useState(0);

  const [workoutIntensity, setWorkoutIntensity] =
    useState<WorkoutIntensity>('moderate');

  const [exercises, setExercises] =
    useState<WorkoutExercise[]>([]);

  const [plans, setPlans] =
    useState<WorkoutPlan[]>([]);

  const [history, setHistory] =
    useState<WorkoutHistoryEntry[]>([]);

  const [
    historyLoaded,
    setHistoryLoaded,
  ] = useState(false);

  const [
    exerciseLibraryOpen,
    setExerciseLibraryOpen,
  ] = useState(false);

  const [
    exerciseRestTimes,
    setExerciseRestTimes,
  ] = useState<Record<string, number>>({});

  const {
    secondsLeft: restSecondsLeft,
    active: restActive,
    complete: restComplete,
    start: startRestTimer,
    reset: resetRestTimer,
  } = useRestTimer();

  const [
    prSetIds,
    setPrSetIds,
  ] = useState<string[]>([]);

  /*
   * LOAD WORKOUT HISTORY
   */

  useEffect(() => {
    const loadWorkoutHistory = async () => {
      try {
        const activeProfileId =
          await getOrCreateProfileId();
        const profile = await loadProfile();
        const savedHistory =
          await loadStoredWorkoutHistory(
            activeProfileId
          );

        setProfileId(activeProfileId);
        setProfileWeightLb(
          Number(profile?.weight) || 0
        );
        setHistory(savedHistory);
      } catch (error) {
        console.error(
          'Failed to load workout history:',
          error
        );
      } finally {
        setHistoryLoaded(true);
      }
    };

    loadWorkoutHistory();
  }, []);

  /*
   * SAVE WORKOUT HISTORY
   */

  useEffect(() => {
    if (!historyLoaded || !profileId) {
      return;
    }

    const saveWorkoutHistory = async () => {
      try {
        await persistWorkoutHistory(
          profileId,
          history
        );
      } catch (error) {
        console.error(
          'Failed to save workout history:',
          error
        );
      }
    };

    saveWorkoutHistory();
  }, [
    history,
    historyLoaded,
    profileId,
  ]);

  /*
   * WORKOUT DURATION
   */

  useEffect(() => {
    if (!startedAt) {
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds(
        Math.floor(
          (Date.now() - startedAt) / 1000
        )
      );
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [startedAt]);

  /*
   * COMPLETED SETS
   */

  const completedSets = useMemo(() => {
    return exercises.reduce(
      (total, exercise) =>
        total +
        exercise.sets.filter(
          (set) => set.completed
        ).length,
      0
    );
  }, [exercises]);

  /*
   * TOTAL VOLUME
   */

  const totalVolume = useMemo(() => {
    return exercises.reduce(
      (exerciseTotal, exercise) =>
        exerciseTotal +
        exercise.sets.reduce(
          (setTotal, set) => {
            if (!set.completed) {
              return setTotal;
            }

            const weight =
              Number(set.weight) || 0;

            const reps =
              Number(set.reps) || 0;

            return (
              setTotal +
              weight * reps
            );
          },
          0
        ),
      0
    );
  }, [exercises]);

  const estimatedCalories = useMemo(
    () =>
      estimateWorkoutCalories({
        weightLb: profileWeightLb,
        durationSeconds: elapsedSeconds,
        intensity: workoutIntensity,
      }),
    [
      elapsedSeconds,
      profileWeightLb,
      workoutIntensity,
    ]
  );

  /*
   * FORMAT REST TIME
   */

  const formatRestTime = (
    seconds: number
  ) => {
    const minutes =
      Math.floor(seconds / 60);

    const remaining =
      seconds % 60;

    return `${minutes}:${String(
      remaining
    ).padStart(2, '0')}`;
  };

  /*
   * FIND MOST RECENT PERFORMANCE
   */

  const findLastExercisePerformance = (
    exerciseName: string
  ):
    | WorkoutHistoryExercise
    | null => {
    const normalizedName =
      exerciseName
        .trim()
        .toLowerCase();

    for (const workout of history) {
      const match =
        workout.exercises.find(
          (exercise) =>
            exercise.name
              .trim()
              .toLowerCase() ===
            normalizedName
        );

      if (match) {
        return match;
      }
    }

    return null;
  };

  /*
   * FIND PREVIOUS BEST WEIGHT
   */

  const getPreviousBestWeight = (
    exerciseName: string
  ): number | null => {
    const normalizedName =
      exerciseName
        .trim()
        .toLowerCase();

    let bestWeight:
      | number
      | null = null;

    for (const workout of history) {
      const matchingExercise =
        workout.exercises.find(
          (exercise) =>
            exercise.name
              .trim()
              .toLowerCase() ===
            normalizedName
        );

      if (!matchingExercise) {
        continue;
      }

      for (const set of matchingExercise.sets) {
        if (!set.completed) {
          continue;
        }

        const weight =
          Number(set.weight);

        if (
          !Number.isFinite(weight) ||
          weight <= 0
        ) {
          continue;
        }

        if (
          bestWeight === null ||
          weight > bestWeight
        ) {
          bestWeight = weight;
        }
      }
    }

    return bestWeight;
  };

  /*
   * GET PREVIOUS SET
   */

  const getPreviousSet = (
    previousExercise:
      | WorkoutHistoryExercise
      | null,
    setIndex: number
  ):
    | WorkoutHistorySet
    | null => {
    if (
      !previousExercise ||
      previousExercise.sets.length === 0
    ) {
      return null;
    }

    const completedPreviousSets =
      previousExercise.sets.filter(
        (set) => set.completed
      );

    const availableSets =
      completedPreviousSets.length > 0
        ? completedPreviousSets
        : previousExercise.sets;

    if (availableSets.length === 0) {
      return null;
    }

    return (
      availableSets[setIndex] ??
      availableSets[
        availableSets.length - 1
      ]
    );
  };

  /*
   * RESET WORKOUT
   */

  const resetWorkoutState = () => {
    setStartedAt(null);
    setElapsedSeconds(0);
    setWorkoutIntensity('moderate');

    setExercises([]);
    setExerciseRestTimes({});
    setExerciseLibraryOpen(false);

    resetRestTimer();

    setPrSetIds([]);
  };

  /*
   * QUICK START
   */

  const startEmptyWorkout = () => {
    setStartedAt(Date.now());
    setElapsedSeconds(0);

    setExercises([]);
    setExerciseRestTimes({});
    setExerciseLibraryOpen(false);

    resetRestTimer();

    setPrSetIds([]);
  };

  /*
   * START WORKOUT PLAN
   *
   * Loads the user's most recent
   * completed weight and reps.
   */

  const startWorkoutPlan = (
    plan: WorkoutPlan
  ) => {
    const restMap: Record<
      string,
      number
    > = {};

    const loadedExercises:
      WorkoutExercise[] =
      plan.exercises.map(
        (plannedExercise) => {
          const exerciseId =
            createId();

          const numberOfSets =
            Math.min(
              99,
              Math.max(
                1,
                Number(
                  plannedExercise.targetSets
                ) || 1
              )
            );

          const plannedReps =
            String(
              Math.min(
                99,
                Math.max(
                  1,
                  Number(
                    plannedExercise.targetReps
                  ) || 1
                )
              )
            );

          const savedRest =
            Math.min(
              600,
              Math.max(
                0,
                plannedExercise.restSeconds ??
                  60
              )
            );

          restMap[exerciseId] =
            savedRest;

          const previousExercise =
            findLastExercisePerformance(
              plannedExercise.name
            );

          const sets =
            Array.from(
              {
                length:
                  numberOfSets,
              },
              (_, setIndex) => {
                const previousSet =
                  getPreviousSet(
                    previousExercise,
                    setIndex
                  );

                const previousWeight =
                  previousSet?.weight ??
                  '';

                const previousReps =
                  previousSet?.reps;

                const safePreviousReps =
                  previousReps &&
                  Number(previousReps) >= 1 &&
                  Number(previousReps) <= 99
                    ? previousReps
                    : plannedReps;

                return {
                  id:
                    createId(),

                  weight:
                    previousWeight,

                  reps:
                    safePreviousReps,

                  completed:
                    false,
                };
              }
            );

          return {
            id:
              exerciseId,

            name:
              plannedExercise.name,

            sets,
          };
        }
      );

    setExercises(
      loadedExercises
    );

    setExerciseRestTimes(
      restMap
    );

    setStartedAt(Date.now());
    setElapsedSeconds(0);

    setExerciseLibraryOpen(false);

    resetRestTimer();

    setPrSetIds([]);
  };

  /*
   * ADD EXERCISE
   */

  const addExerciseFromLibrary = (
    selection: ExerciseSelection
  ) => {
    const {
      exercise,
      sets,
      reps,
      restSeconds,
    } = selection;

    const safeSets =
      Math.min(
        99,
        Math.max(1, sets)
      );

    const safeReps =
      Math.min(
        99,
        Math.max(1, reps)
      );

    const safeRest =
      Math.min(
        600,
        Math.max(
          0,
          restSeconds
        )
      );

    const exerciseId =
      createId();

    const previousExercise =
      findLastExercisePerformance(
        exercise.name
      );

    const newExercise:
      WorkoutExercise = {
        id:
          exerciseId,

        name:
          exercise.name,

        sets: Array.from(
          {
            length:
              safeSets,
          },
          (_, setIndex) => {
            const previousSet =
              getPreviousSet(
                previousExercise,
                setIndex
              );

            const previousWeight =
              previousSet?.weight ??
              '';

            const previousReps =
              previousSet?.reps;

            const finalReps =
              previousReps &&
              Number(previousReps) >= 1 &&
              Number(previousReps) <= 99
                ? previousReps
                : String(safeReps);

            return {
              id:
                createId(),

              weight:
                previousWeight,

              reps:
                finalReps,

              completed:
                false,
            };
          }
        ),
      };

    setExercises(
      (current) => [
        ...current,
        newExercise,
      ]
    );

    setExerciseRestTimes(
      (current) => ({
        ...current,

        [exerciseId]:
          safeRest,
      })
    );

    setExerciseLibraryOpen(
      false
    );
  };

  /*
   * SAVE WORKOUT
   */

  const saveWorkoutToHistory = () => {
    if (exercises.length === 0) {
      resetWorkoutState();
      return;
    }

    const entry:
      WorkoutHistoryEntry = {
        id:
          createId(),

        profileId,

        date:
          new Date().toISOString(),

        durationSeconds:
          elapsedSeconds,

        totalVolume,

        completedSets,

        caloriesBurned:
          profileWeightLb > 0
            ? estimatedCalories
            : undefined,

        intensity:
          workoutIntensity,

        weightLbAtWorkout:
          profileWeightLb || undefined,

        exercises:
          exercises.map(
            (exercise) => ({
              id:
                createId(),

              name:
                exercise.name,

              sets:
                exercise.sets.map(
                  (set) => ({
                    id:
                      createId(),

                    weight:
                      set.weight,

                    reps:
                      set.reps,

                    completed:
                      set.completed,
                  })
                ),
            })
          ),
      };

    setHistory(
      (current) => [
        entry,
        ...current,
      ]
    );

    resetWorkoutState();
  };

  /*
   * FINISH WORKOUT
   */

  const finishWorkout = () => {
    Alert.alert(
      'Workout Complete',
      [
        `${exercises.length} exercises`,
        `${completedSets} completed sets`,
        `${Math.round(
          totalVolume
        ).toLocaleString()} lb total volume`,
        `Duration ${formatTime(
          elapsedSeconds
        )}`,
        profileWeightLb > 0
          ? `${estimatedCalories} estimated calories burned`
          : 'Add your profile weight to estimate calories',
        prSetIds.length > 0
          ? `${prSetIds.length} new PR${
              prSetIds.length === 1
                ? ''
                : 's'
            }`
          : 'No new PRs',
      ].join('\n'),
      [
        {
          text:
            'Keep Training',

          style:
            'cancel',
        },

        {
          text:
            'Finish & Save',

          onPress:
            saveWorkoutToHistory,
        },
      ]
    );
  };

  /*
   * ADD SET
   */

  const addSet = (
    exerciseId: string
  ) => {
    setExercises(
      (current) =>
        current.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise;
            }

            if (
              exercise.sets.length >=
              99
            ) {
              return exercise;
            }

            const previousSet =
              exercise.sets[
                exercise.sets.length - 1
              ];

            return {
              ...exercise,

              sets: [
                ...exercise.sets,

                {
                  id:
                    createId(),

                  weight:
                    previousSet?.weight ??
                    '',

                  reps:
                    previousSet?.reps ??
                    '',

                  completed:
                    false,
                },
              ],
            };
          }
        )
    );
  };

  /*
   * UPDATE SET
   */

  const updateSet = (
    exerciseId: string,
    setId: string,
    field:
      | 'weight'
      | 'reps',
    value: string
  ) => {
    setExercises(
      (current) =>
        current.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise;
            }

            return {
              ...exercise,

              sets:
                exercise.sets.map(
                  (set) => {
                    if (
                      set.id !==
                      setId
                    ) {
                      return set;
                    }

                    return {
                      ...set,

                      [field]:
                        value,
                    };
                  }
                ),
            };
          }
        )
    );
  };

  /*
   * COMPLETE / UNCOMPLETE SET
   */

  const toggleSetComplete = (
    exerciseId: string,
    setId: string
  ) => {
    const exercise =
      exercises.find(
        (item) =>
          item.id ===
          exerciseId
      );

    if (!exercise) {
      return;
    }

    const workoutSet =
      exercise.sets.find(
        (item) =>
          item.id ===
          setId
      );

    if (!workoutSet) {
      return;
    }

    const willBeCompleted =
      !workoutSet.completed;

    /*
     * REMOVE PR IF USER
     * UNCHECKS THE SET
     */

    if (!willBeCompleted) {
      setPrSetIds(
        (current) =>
          current.filter(
            (id) =>
              id !== setId
          )
      );
    }

    /*
     * CHECK FOR NEW WEIGHT PR
     */

    if (willBeCompleted) {
      const currentWeight =
        Number(
          workoutSet.weight
        );

      const previousBestWeight =
        getPreviousBestWeight(
          exercise.name
        );

      /*
       * If there is no previous
       * record, this is the user's
       * baseline and is not marked
       * as a PR.
       */

      if (
        previousBestWeight !== null &&
        Number.isFinite(
          currentWeight
        ) &&
        currentWeight >
          previousBestWeight
      ) {
        setPrSetIds(
          (current) =>
            current.includes(
              setId
            )
              ? current
              : [
                  ...current,
                  setId,
                ]
        );
      }
    }

    /*
     * UPDATE COMPLETED STATE
     */

    setExercises(
      (current) =>
        current.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise;
            }

            return {
              ...exercise,

              sets:
                exercise.sets.map(
                  (set) => {
                    if (
                      set.id !==
                      setId
                    ) {
                      return set;
                    }

                    return {
                      ...set,

                      completed:
                        willBeCompleted,
                    };
                  }
                ),
            };
          }
        )
    );

    /*
     * START REST TIMER
     */

    if (willBeCompleted) {
      const savedRest =
        exerciseRestTimes[
          exerciseId
        ] ?? 60;

      if (savedRest > 0) {
        startRestTimer(
          savedRest
        );
      }
    }
  };

  /*
   * REMOVE EXERCISE
   */

  const removeExercise = (
    exerciseId: string
  ) => {
    const exercise =
      exercises.find(
        (item) =>
          item.id ===
          exerciseId
      );

    if (exercise) {
      const setIds =
        exercise.sets.map(
          (set) => set.id
        );

      setPrSetIds(
        (current) =>
          current.filter(
            (id) =>
              !setIds.includes(id)
          )
      );
    }

    setExercises(
      (current) =>
        current.filter(
          (exercise) =>
            exercise.id !==
            exerciseId
        )
    );

    setExerciseRestTimes(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          exerciseId
        ];

        return next;
      }
    );
  };

  /*
   * DELETE HISTORY ENTRY
   */

  const deleteHistoryEntry = (
    entryId: string
  ) => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout from your history?',
      [
        {
          text:
            'Cancel',

          style:
            'cancel',
        },

        {
          text:
            'Delete',

          style:
            'destructive',

          onPress: () => {
            setHistory(
              (current) =>
                current.filter(
                  (entry) =>
                    entry.id !==
                    entryId
                )
            );
          },
        },
      ]
    );
  };

  /*
   * MAIN WORKOUT PAGE
   */

  if (!startedAt) {
    return (
      <ScrollView
        contentContainerStyle={
          styles.plannerContainer
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Text
            style={
              styles.brand
            }
          >
            FITTRACK
          </Text>

          <Text
            style={
              styles.title
            }
          >
            Workout
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Train today or build
            your weekly workout
            plan.
          </Text>
        </View>

        <Pressable
          style={
            styles.quickStartButton
          }
          onPress={
            startEmptyWorkout
          }
        >
          <View
            style={
              styles.quickStartIcon
            }
          >
            <Text
              style={
                styles.quickStartIconText
              }
            >
              +
            </Text>
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.quickStartTitle
              }
            >
              Quick Start
            </Text>

            <Text
              style={
                styles.quickStartSubtitle
              }
            >
              Start an empty workout
              now
            </Text>
          </View>

          <Text
            style={
              styles.quickStartArrow
            }
          >
            ›
          </Text>
        </Pressable>

        <WorkoutPlanner
          plans={
            plans
          }
          onPlansChange={
            setPlans
          }
          onStartPlan={
            startWorkoutPlan
          }
        />

        <WorkoutHistory
          history={
            history
          }
          onDeleteEntry={
            deleteHistoryEntry
          }
        />
      </ScrollView>
    );
  }

  /*
   * ACTIVE WORKOUT
   */

  return (
    <KeyboardAvoidingView
      style={
        styles.screen
      }
      behavior={
        Platform.OS ===
        'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.activeContainer
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.activeHeader
          }
        >
          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.brand
              }
            >
              FITTRACK
            </Text>

            <Text
              style={
                styles.activeTitle
              }
            >
              Active Workout
            </Text>
          </View>

          <Pressable
            style={
              styles.finishButton
            }
            onPress={
              finishWorkout
            }
          >
            <Text
              style={
                styles.finishButtonText
              }
            >
              Finish
            </Text>
          </Pressable>
        </View>

        <WorkoutSummary
          duration={
            formatTime(
              elapsedSeconds
            )
          }
          volume={
            totalVolume
          }
          sets={
            completedSets
          }
          calories={
            profileWeightLb > 0
              ? estimatedCalories
              : null
          }
          intensity={
            workoutIntensity
          }
          onIntensityChange={
            setWorkoutIntensity
          }
          restTime={
            restActive
              ? formatRestTime(
                  restSecondsLeft
                )
              : restComplete
                ? '0:00'
                : 'Ready'
          }
          restActive={
            restActive
          }
          restComplete={
            restComplete
          }
        />

        {!exerciseLibraryOpen ? (
          <Pressable
            style={
              styles.addExerciseButton
            }
            onPress={() =>
              setExerciseLibraryOpen(
                true
              )
            }
          >
            <View
              style={
                styles.addExerciseIcon
              }
            >
              <Text
                style={
                  styles.addExerciseIconText
                }
              >
                +
              </Text>
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.addExerciseTitle
                }
              >
                Add Exercise
              </Text>

              <Text
                style={
                  styles.addExerciseSubtitle
                }
              >
                Search the exercise
                library
              </Text>
            </View>

            <Text
              style={
                styles.addExerciseArrow
              }
            >
              ›
            </Text>
          </Pressable>
        ) : (
          <View
            style={
              styles.librarySection
            }
          >
            <View
              style={
                styles.libraryHeader
              }
            >
              <Text
                style={
                  styles.libraryTitle
                }
              >
                Add Exercise
              </Text>

              <Pressable
                onPress={() =>
                  setExerciseLibraryOpen(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.cancelLibraryText
                  }
                >
                  Cancel
                </Text>
              </Pressable>
            </View>

            <ExerciseLibrary
              onSelectExercise={
                addExerciseFromLibrary
              }
            />
          </View>
        )}

        {exercises.length === 0 ? (
          <View
            style={
              styles.emptyWorkoutCard
            }
          >
            <Text
              style={
                styles.emptyWorkoutTitle
              }
            >
              No exercises yet
            </Text>

            <Text
              style={
                styles.emptyWorkoutText
              }
            >
              Tap Add Exercise and
              choose an exercise from
              the library.
            </Text>
          </View>
        ) : (
          exercises.map(
            (exercise) => (
              <ExerciseCard
                key={
                  exercise.id
                }

                exercise={
                  exercise
                }

                prSetIds={
                  prSetIds
                }

                onAddSet={() =>
                  addSet(
                    exercise.id
                  )
                }

                onRemove={() =>
                  removeExercise(
                    exercise.id
                  )
                }

                onUpdateSet={(
                  setId,
                  field,
                  value
                ) =>
                  updateSet(
                    exercise.id,
                    setId,
                    field,
                    value
                  )
                }

                onToggleSetComplete={(
                  setId
                ) =>
                  toggleSetComplete(
                    exercise.id,
                    setId
                  )
                }
              />
            )
          )
        )}

        <View
          style={{
            height: 90,
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    plannerContainer: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 110,
      backgroundColor:
        colors.background,
    },

    activeContainer: {
      paddingHorizontal: 20,
      paddingTop: 58,
      backgroundColor:
        colors.background,
    },

    header: {
      marginBottom: 18,
    },

    brand: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 2,
      color: colors.muted,
    },

    title: {
      fontSize: 36,
      fontWeight: '900',
      color: colors.text,
      marginTop: 4,
    },

    subtitle: {
      marginTop: 6,
      fontSize: 15,
      lineHeight: 21,
      color: colors.muted,
    },

    quickStartButton: {
      backgroundColor:
        colors.surface,
      borderRadius: 20,
      padding: 18,
      marginBottom: 22,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 14,
    },

    quickStartIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor:
        colors.text,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    quickStartIconText: {
      color:
        colors.surface,
      fontSize: 27,
      fontWeight: '500',
    },

    quickStartTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
    },

    quickStartSubtitle: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 3,
    },

    quickStartArrow: {
      color: colors.muted,
      fontSize: 30,
    },

    activeHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 12,
    },

    activeTitle: {
      fontSize: 32,
      fontWeight: '900',
      color: colors.text,
      marginTop: 4,
    },

    finishButton: {
      backgroundColor:
        colors.text,
      borderRadius: 12,
      paddingHorizontal: 18,
      paddingVertical: 11,
    },

    finishButtonText: {
      color:
        colors.surface,
      fontWeight: '900',
    },

    addExerciseButton: {
      backgroundColor:
        colors.surface,
      borderRadius: 18,
      padding: 16,
      marginTop: 16,
      marginBottom: 16,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 12,
    },

    addExerciseIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor:
        colors.text,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    addExerciseIconText: {
      color:
        colors.surface,
      fontSize: 24,
      fontWeight: '500',
    },

    addExerciseTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
    },

    addExerciseSubtitle: {
      marginTop: 3,
      color: colors.muted,
      fontSize: 12,
    },

    addExerciseArrow: {
      color: colors.muted,
      fontSize: 28,
    },

    librarySection: {
      marginTop: 16,
      marginBottom: 16,
    },

    libraryHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom: 10,
    },

    libraryTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.text,
    },

    cancelLibraryText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.muted,
    },

    emptyWorkoutCard: {
      backgroundColor:
        colors.surface,
      borderRadius: 20,
      padding: 20,
    },

    emptyWorkoutTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.text,
    },

    emptyWorkoutText: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
    },
  });
  
