import { loadWorkoutSession, saveWorkoutSession } from '../../services/workout-session-storage';
import { loadWorkoutPlans, saveWorkoutPlans } from '../../services/workout-plan-storage';
import WorkoutPhotos from '../progress/WorkoutPhotos';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  Alert,
  AppState,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { createUserContextSnapshot } from '../../services/user-context-snapshot';

import {
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutIntensity,
  WorkoutHistorySet,
} from '../../types/workoutHistory';
import { estimateWorkoutCalories } from '../../utils/workout-calories';

import { WorkoutPlan } from '../../types/workoutPlan';
import { localDateKey } from '../../utils/date';
import { getMuscleRecencyForExercise } from './muscleRecency';

import ExerciseLibrary from '../exercise-library/ExerciseLibrary';
import { ExerciseRecord, getExerciseById } from '../exercise-library/exerciseData';
import {
  getExerciseGif,
  getExerciseImage,
} from '../exercise-library/exerciseMedia';
import {
  getExerciseByName,
  getExerciseMeasurement,
} from './exerciseMeasurement';

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
  const { date: requestedDate, requestId } = useLocalSearchParams<{ date?: string; requestId?: string }>();
  const handledRequest = useRef<string | null>(null);
  const savingWorkout = useRef(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [sessionLoadError, setSessionLoadError] = useState(false);
  const [sessionSaveError, setSessionSaveError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [completedWorkout, setCompletedWorkout] = useState<WorkoutHistoryEntry | null>(null);
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
  const [workoutDate, setWorkoutDate] = useState<string | null>(null);
  const [savePlanOpen, setSavePlanOpen] = useState(false);
  const [savePlanName, setSavePlanName] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [plansLoadError, setPlansLoadError] = useState(false);

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
    start: startTimer,
    reset: resetTimer,
  } = useRestTimer();

  const [
    prSetIds,
    setPrSetIds,
  ] = useState<string[]>([]);

  const [
    selectedMediaExercise,
    setSelectedMediaExercise,
  ] = useState<WorkoutExercise | null>(null);

  const startRestTimer = useCallback((seconds: number) => {
    setRestEndsAt(Date.now() + seconds * 1000);
    startTimer(seconds);
  }, [startTimer]);
  const resetRestTimer = () => {
    setRestEndsAt(null);
    resetTimer();
  };

  useLayoutEffect(() => {
    if (!sessionLoaded || !profileId) return;
    void saveWorkoutSession(profileId, startedAt === null ? null : {
      startedAt, exercises, workoutIntensity, exerciseRestTimes, prSetIds, restEndsAt, workoutDate,
    }).then(() => setSessionSaveError(false)).catch(error => {
      console.error('Failed to save active workout:', error);
      setSessionSaveError(true);
    });
  }, [sessionLoaded, profileId, startedAt, exercises, workoutIntensity, exerciseRestTimes, prSetIds, restEndsAt, workoutDate]);

  /*
   * LOAD WORKOUT HISTORY
   */

  useEffect(() => {
    let cancelled = false;
    const loadWorkoutHistory = async () => {
      try {
        const activeProfileId =
          await getOrCreateProfileId();
        const profile = await loadProfile();
        const savedHistory =
          await loadStoredWorkoutHistory(
            activeProfileId
          );

        const session = await loadWorkoutSession(activeProfileId);
        const savedPlans = await loadWorkoutPlans(activeProfileId).catch((error) => {
          console.error('Failed to load workout plans:', error);
          if (!cancelled) setPlansLoadError(true);
          return [];
        });
        if (cancelled) return;
        if (session && !savedHistory.some(entry => entry.id === `session-${session.startedAt}`)) {
          setStartedAt(session.startedAt);
          setWorkoutDate(session.workoutDate ?? null);
          setExercises(session.exercises);
          setWorkoutIntensity(session.workoutIntensity);
          setExerciseRestTimes(session.exerciseRestTimes);
          setPrSetIds(session.prSetIds);
          setRestEndsAt(session.restEndsAt);
          if (session.restEndsAt !== null) startTimer(Math.max(0, Math.ceil((session.restEndsAt - Date.now()) / 1000)));
        }
        setSessionLoaded(true);
        setProfileId(activeProfileId);
        setPlans(savedPlans);
        setProfileWeightLb(
          Number(profile?.weight) || 0
        );
        setHistory(savedHistory);
      } catch (error) {
        console.error(
          'Failed to load workout history:',
          error
        );
        if (!cancelled) setSessionLoadError(true);
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    };

    void loadWorkoutHistory();
    return () => { cancelled = true; };
  }, [loadAttempt, startTimer]);

  useEffect(() => {
    if (!sessionLoaded || !requestId || handledRequest.current === requestId) return;
    handledRequest.current = requestId;
    if (startedAt !== null) {
      Alert.alert('Workout in progress', 'Finish your active workout before adding one for another day.');
      return;
    }
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
        localDateKey(new Date(`${requestedDate}T12:00:00`)) === requestedDate) {
      const timer = setTimeout(() => {
        setStartedAt(Date.now());
        setWorkoutDate(requestedDate);
        setElapsedSeconds(0);
        setExercises([]);
        setExerciseRestTimes({});
        setExerciseLibraryOpen(false);
        setRestEndsAt(null);
        resetTimer();
        setPrSetIds([]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [sessionLoaded, requestId, requestedDate, startedAt, resetTimer]);

  const updatePlans = async (next: WorkoutPlan[]) => {
    if (!profileId) return;
    if (plansLoadError) {
      Alert.alert('Saved workouts unavailable', 'Reopen the Workout screen and try again.');
      return;
    }
    try {
      await saveWorkoutPlans(profileId, next);
      setPlans(next);
    } catch (error) {
      console.error('Failed to save workout plans:', error);
      Alert.alert('Workout not saved', 'Please try again.');
    }
  };

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

    const refreshElapsed = () => {
      setElapsedSeconds(
        Math.floor(
          (Date.now() - startedAt) / 1000
        )
      );
    };

    refreshElapsed();
    const timer = setInterval(refreshElapsed, 1000);
    const subscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') {
          refreshElapsed();
        }
      }
    );

    return () => {
      clearInterval(timer);
      subscription.remove();
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
        (getExerciseMeasurement(exercise.name, exercise.trackingMethod).kind !== 'weighted' ? 0 :
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
        )),
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

  const getExerciseRecency = (
    exerciseName: string
  ) =>
    getMuscleRecencyForExercise(
      exerciseName,
      history
    );

  /*
   * FIND MOST RECENT PERFORMANCE
   */

  const findLastExercisePerformance = (
    exerciseName: string,
    libraryId?: string
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
            libraryId?.startsWith('custom-')
              ? exercise.exerciseLibraryId === libraryId
              : exercise.name.trim().toLowerCase() === normalizedName
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
    exerciseName: string,
    libraryId?: string
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
            libraryId?.startsWith('custom-')
              ? exercise.exerciseLibraryId === libraryId
              : exercise.name.trim().toLowerCase() === normalizedName
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
    setWorkoutDate(null);
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

  const startEmptyWorkout = (date = localDateKey()) => {
    setStartedAt(Date.now());
    setWorkoutDate(date);
    setElapsedSeconds(0);

    setExercises([]);
    setExerciseRestTimes({});
    setExerciseLibraryOpen(false);

    resetRestTimer();

    setPrSetIds([]);
  };

  const saveCurrentWorkoutAsPlan = async () => {
    const name = savePlanName.trim();
    if (!name || exercises.length === 0 || savingPlan) return;
    if (plansLoadError) {
      Alert.alert('Saved workouts unavailable', 'Reopen the Workout screen and try again.');
      return;
    }
    const plan: WorkoutPlan = {
      id: createId(),
      name,
      days: [],
      exercises: exercises.map((exercise) => ({
        id: createId(),
        name: exercise.name,
        exerciseLibraryId: exercise.exerciseLibraryId,
        trackingMethod: exercise.trackingMethod,
        image: exercise.image,
        targetSets: String(exercise.sets.length),
        targetReps: exercise.trackingMethod && !['weight_reps', 'reps', 'bodyweight_reps'].includes(exercise.trackingMethod)
          ? ''
          : exercise.sets.find((set) => Number(set.reps) > 0)?.reps ?? '10',
        restSeconds: exerciseRestTimes[exercise.id] ?? 60,
      })),
    };
    setSavingPlan(true);
    try {
      await saveWorkoutPlans(profileId, [...plans, plan]);
      setPlans((current) => [...current, plan]);
      setSavePlanName('');
      setSavePlanOpen(false);
      Alert.alert('Workout saved', 'Find it in Your Workout Plans.');
    } catch (error) {
      console.error('Failed to save workout plan:', error);
      Alert.alert('Workout not saved', 'Please try again.');
    } finally {
      setSavingPlan(false);
    }
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
    setWorkoutDate(localDateKey());
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
          const hasReps = !plannedExercise.trackingMethod ||
            ['weight_reps', 'reps', 'bodyweight_reps'].includes(plannedExercise.trackingMethod);

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
              plannedExercise.name,
              plannedExercise.exerciseLibraryId
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
                    : hasReps ? plannedReps : '';

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

            exerciseLibraryId: plannedExercise.exerciseLibraryId,
            trackingMethod: plannedExercise.trackingMethod,
            image: plannedExercise.image,

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
        exercise.name,
        exercise.id
      );

    const newExercise:
      WorkoutExercise = {
        id:
          exerciseId,

        name:
          exercise.name,
        exerciseLibraryId: exercise.id,
        trackingMethod: exercise.trackingMethod,
        image: exercise.isCustom ? exercise.image : undefined,

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

            const hasReps = !exercise.trackingMethod ||
              ['weight_reps', 'reps', 'bodyweight_reps'].includes(exercise.trackingMethod);
            const finalReps =
              previousReps &&
              (hasReps ? Number(previousReps) >= 1 && Number(previousReps) <= 99 : true)
                ? previousReps
                : hasReps ? String(safeReps) : '';

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

  const saveWorkoutToHistory = async () => {
    if (savingWorkout.current) return;
    if (!historyLoaded || !profileId) {
      Alert.alert('Please wait', 'Your profile and workout history are still loading.');
      return;
    }
    if (exercises.length === 0) {
      resetWorkoutState();
      return;
    }

    const entry:
      WorkoutHistoryEntry = {
        id:
          `session-${startedAt}`,

        profileId,

        date:
          workoutDate && workoutDate !== localDateKey()
            ? new Date(`${workoutDate}T12:00:00`).toISOString()
            : new Date().toISOString(),

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
            (exercise, exerciseIndex) => ({
              id:
                createId(),

              name:
                exercise.name,
              trackingMethod: exercise.trackingMethod,
              exerciseLibraryId: exercise.exerciseLibraryId,

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

    savingWorkout.current = true;
    try {
      const completedEntry = { ...entry, userContext: await createUserContextSnapshot(profileId) };
      const updated = [completedEntry, ...history];
      await persistWorkoutHistory(profileId, updated);
      await saveWorkoutSession(profileId, null);
      setHistory(updated);
      setCompletedWorkout(completedEntry);
      resetWorkoutState();
    } catch (error) {
      console.error('Failed to finish workout:', error);
      Alert.alert('Workout not saved', 'Your workout is still open. Please try Finish again.');
    } finally {
      savingWorkout.current = false;
    }
  };

  /*
   * FINISH WORKOUT
   */

  const finishWorkout = () => {
    const unfinishedItems = exercises
      .map((exercise) => {
        const remainingSets = exercise.sets.filter(
          (set) => !set.completed
        ).length;

        if (remainingSets === 0) {
          return null;
        }

        return `• ${exercise.name}: ${remainingSets} ${
          remainingSets === 1 ? 'set' : 'sets'
        } left`;
      })
      .filter((item): item is string => Boolean(item));

    if (exercises.length === 0) {
      unfinishedItems.push('• No exercises have been added');
    }

    if (unfinishedItems.length === 0) {
      saveWorkoutToHistory();
      return;
    }

    const message = [
      'This is still left:',
      '',
      ...unfinishedItems,
      '',
      'Are you done and ready to finish anyway?',
    ].join('\n');

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        saveWorkoutToHistory();
      }
      return;
    }

    Alert.alert('Are you done?', message, [
      {
        text: 'Continue Workout',
        style: 'cancel',
      },
      {
        text: 'Finish Anyway',
        style: 'destructive',
        onPress: saveWorkoutToHistory,
      },
    ]);
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

    if (willBeCompleted && getExerciseMeasurement(exercise.name, exercise.trackingMethod).kind === 'weighted') {
      const currentWeight =
        Number(
          workoutSet.weight
        );

      const previousBestWeight =
        getPreviousBestWeight(
          exercise.name,
          exercise.exerciseLibraryId
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

  const confirmDestructiveAction = (
    title: string,
    message: string,
    onConfirm: () => void
  ) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
      return;
    }

    Alert.alert(title, message, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: onConfirm,
      },
    ]);
  };

  const moveItem = <T,>(
    list: T[],
    fromIndex: number,
    toIndex: number
  ) => {
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= list.length ||
      toIndex >= list.length
    ) {
      return list;
    }

    const next = [...list];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
  };

  const moveExercise = (
    exerciseId: string,
    direction: -1 | 1
  ) => {
    setExercises((current) => {
      const index = current.findIndex(
        (exercise) => exercise.id === exerciseId
      );

      return moveItem(
        current,
        index,
        index + direction
      );
    });
  };

  const moveSet = (
    exerciseId: string,
    setId: string,
    direction: -1 | 1
  ) => {
    setExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        const index = exercise.sets.findIndex(
          (set) => set.id === setId
        );

        return {
          ...exercise,
          sets: moveItem(
            exercise.sets,
            index,
            index + direction
          ),
        };
      })
    );
  };

  const removeSet = (
    exerciseId: string,
    setId: string
  ) => {
    const exercise = exercises.find(
      (item) => item.id === exerciseId
    );
    const set = exercise?.sets.find(
      (item) => item.id === setId
    );

    if (!exercise || !set || exercise.sets.length <= 1) {
      return;
    }

    const remove = () => {
      setPrSetIds((current) =>
        current.filter((id) => id !== setId)
      );
      setExercises((current) =>
        current.map((item) => {
          if (item.id !== exerciseId) {
            return item;
          }

          return {
            ...item,
            sets: item.sets.filter(
              (workoutSet) => workoutSet.id !== setId
            ),
          };
        })
      );
    };

    if (
      set.completed ||
      set.weight.trim() ||
      set.reps.trim()
    ) {
      confirmDestructiveAction(
        'Remove set?',
        'This set already has entered workout data.',
        remove
      );
      return;
    }

    remove();
  };

  /*
   * REMOVE EXERCISE
   */

  const removeExercise = (
    exerciseId: string
  ) => {
    const exercise = exercises.find(
      (item) => item.id === exerciseId
    );

    if (!exercise) {
      return;
    }

    const remove = () => {
      const setIds = exercise.sets.map(
        (set) => set.id
      );

      setPrSetIds((current) =>
        current.filter(
          (id) => !setIds.includes(id)
        )
      );

      setExercises((current) =>
        current.filter(
          (item) => item.id !== exerciseId
        )
      );

      setExerciseRestTimes((current) => {
        const next = { ...current };
        delete next[exerciseId];
        return next;
      });
    };

    const hasEnteredData = exercise.sets.some(
      (set) =>
        set.completed ||
        set.weight.trim() ||
        set.reps.trim()
    );

    if (hasEnteredData) {
      confirmDestructiveAction(
        'Remove exercise?',
        `${exercise.name} already has entered workout data.`,
        remove
      );
      return;
    }

    remove();
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

  if (!sessionLoaded) {
    return <View style={styles.plannerContainer}>
      <Text style={styles.title}>{sessionLoadError ? 'Could not restore workout' : 'Restoring workout…'}</Text>
      {sessionLoadError ? <Pressable onPress={() => { setSessionLoadError(false); setLoadAttempt(attempt => attempt + 1); }}>
        <Text style={styles.subtitle}>Your saved session has been kept. Tap to retry.</Text>
      </Pressable> : null}
    </View>;
  }

  if (!startedAt) {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        keyboardVerticalOffset={
          Platform.OS === 'ios' ? 12 : 0
        }
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <TouchableWithoutFeedback
          accessible={false}
          onPress={Keyboard.dismiss}
        >
      <ScrollView
        contentContainerStyle={
          styles.plannerContainer
        }
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode={
          Platform.OS === 'ios'
            ? 'interactive'
            : 'on-drag'
        }
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
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
            () => startEmptyWorkout()
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

        {completedWorkout && (
          <View style={{ backgroundColor: colors.surface, padding: 18, borderRadius: 20, marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Workout saved!</Text>
            <Text style={{ marginTop: 5, color: colors.muted }}>Add a progress photo. Find it later with this workout in Progress.</Text>
            <WorkoutPhotos profileId={completedWorkout.profileId} workoutId={completedWorkout.id} />
            <Pressable onPress={() => setCompletedWorkout(null)} style={{ paddingVertical: 14 }}>
              <Text style={{ fontWeight: '800', color: colors.muted }}>Done</Text>
            </Pressable>
          </View>
        )}

        {plansLoadError ? <Text style={styles.subtitle}>Saved workouts could not be loaded. Your other workout data is available.</Text> : null}
        <WorkoutPlanner
          plans={
            plans
          }
          onPlansChange={
            updatePlans
          }
          onStartPlan={
            startWorkoutPlan
          }
          getExerciseRecency={
            getExerciseRecency
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
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  }

  /*
   * ACTIVE WORKOUT
   */

  const selectedExerciseRecord = selectedMediaExercise
    ? selectedMediaExercise.exerciseLibraryId?.startsWith('custom-')
      ? null
      : getExerciseById(selectedMediaExercise.exerciseLibraryId ?? '') ??
        getExerciseByName(selectedMediaExercise.name)
    : null;

  const selectedMediaSource = selectedMediaExercise?.image
    ? { uri: selectedMediaExercise.image }
    : selectedExerciseRecord
      ? getExerciseGif(selectedExerciseRecord.id) ?? getExerciseImage(selectedExerciseRecord.id)
      : null;

  return (
    <KeyboardAvoidingView
      style={
        styles.screen
      }
      keyboardVerticalOffset={
        Platform.OS === 'ios' ? 12 : 0
      }
      behavior={
        Platform.OS ===
        'ios'
          ? 'padding'
          : undefined
      }
    >
      <Modal
        animationType="slide"
        transparent
        visible={Boolean(selectedMediaExercise)}
        onRequestClose={() =>
          setSelectedMediaExercise(null)
        }
      >
        <View style={styles.mediaModalOverlay}>
          <View style={styles.mediaModalCard}>
            <View style={styles.mediaModalHeader}>
              <Text style={styles.mediaModalTitle}>
                {selectedMediaExercise?.name}
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setSelectedMediaExercise(null)
                }
                style={styles.mediaCloseButton}
              >
                <Text style={styles.mediaCloseText}>
                  Close
                </Text>
              </Pressable>
            </View>

            {selectedMediaSource ? (
              <Image
                resizeMode="contain"
                source={selectedMediaSource}
                style={styles.mediaPreview}
              />
            ) : (
              <View style={styles.mediaFallback}>
                <Text style={styles.mediaFallbackText}>
                  No exercise media available
                </Text>
              </View>
            )}

            <Text style={styles.mediaHint}>
              Your workout timer, sets, reps, and completed marks stay active while this is open.
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={savePlanOpen}
        onRequestClose={() => setSavePlanOpen(false)}
      >
        <View style={styles.savePlanOverlay}>
          <View style={styles.savePlanCard}>
            <Text style={styles.savePlanTitle}>Save Current Workout</Text>
            <Text style={styles.savePlanHint}>Reuse the current exercises, sets, and rest times later.</Text>
            <TextInput
              value={savePlanName}
              onChangeText={setSavePlanName}
              placeholder="Workout name"
              placeholderTextColor={colors.lightMuted}
              style={styles.savePlanInput}
              returnKeyType="done"
              onSubmitEditing={() => void saveCurrentWorkoutAsPlan()}
            />
            <View style={styles.savePlanActions}>
              <Pressable onPress={() => setSavePlanOpen(false)} style={styles.savePlanCancel}>
                <Text style={styles.savePlanCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={!savePlanName.trim() || savingPlan}
                onPress={() => void saveCurrentWorkoutAsPlan()}
                style={[styles.savePlanConfirm, (!savePlanName.trim() || savingPlan) && styles.savePlanDisabled]}
              >
                <Text style={styles.savePlanConfirmText}>{savingPlan ? 'Saving…' : 'Save Workout'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableWithoutFeedback
        accessible={false}
        onPress={Keyboard.dismiss}
      >
      <ScrollView
        contentContainerStyle={
          styles.activeContainer
        }
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode={
          Platform.OS === 'ios'
            ? 'interactive'
            : 'on-drag'
        }
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        showsVerticalScrollIndicator={
          false
        }
      >
        {sessionSaveError ? <Text accessibilityRole="alert" style={styles.subtitle}>
          Your latest changes could not be saved. Keep this workout open and try editing again.
        </Text> : null}
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

          <View style={styles.activeHeaderActions}>
            <Pressable
              disabled={exercises.length === 0}
              style={[styles.saveCurrentButton, exercises.length === 0 && styles.savePlanDisabled]}
              onPress={() => setSavePlanOpen(true)}
            >
              <Text style={styles.saveCurrentButtonText}>Save</Text>
            </Pressable>
            <Pressable style={styles.finishButton} onPress={finishWorkout}>
              <Text style={styles.finishButtonText}>Finish</Text>
            </Pressable>
          </View>
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
            (exercise, exerciseIndex) => (
              <ExerciseCard
                key={
                  exercise.id
                }

                exercise={
                  exercise
                }

                measurement={
                  getExerciseMeasurement(
                    exercise.name,
                    exercise.trackingMethod
                  )
                }

                canMoveUp={
                  exerciseIndex > 0
                }

                canMoveDown={
                  exerciseIndex <
                  exercises.length - 1
                }

                prSetIds={
                  prSetIds
                }

                muscleRecencyLabel={
                  getExerciseRecency(
                    exercise.name
                  )?.label
                }

                onAddSet={() =>
                  addSet(
                    exercise.id
                  )
                }

                onViewMedia={() =>
                  setSelectedMediaExercise(
                    exercise
                  )
                }

                onMoveUp={() =>
                  moveExercise(
                    exercise.id,
                    -1
                  )
                }

                onMoveDown={() =>
                  moveExercise(
                    exercise.id,
                    1
                  )
                }

                onRemoveSet={(setId) =>
                  removeSet(
                    exercise.id,
                    setId
                  )
                }

                onMoveSetUp={(setId) =>
                  moveSet(
                    exercise.id,
                    setId,
                    -1
                  )
                }

                onMoveSetDown={(setId) =>
                  moveSet(
                    exercise.id,
                    setId,
                    1
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
            height: 180,
          }}
        />
      </ScrollView>
      </TouchableWithoutFeedback>
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


    mediaModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
      padding: 16,
    },

    mediaModalCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 18,
      maxHeight: '88%',
    },

    mediaModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },

    mediaModalTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
    },

    mediaCloseButton: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },

    mediaCloseText: {
      color: colors.surface,
      fontWeight: '900',
    },

    mediaPreview: {
      width: '100%',
      height: 360,
      borderRadius: 16,
      backgroundColor: colors.soft2,
    },

    mediaFallback: {
      height: 280,
      borderRadius: 16,
      backgroundColor: colors.soft2,
      alignItems: 'center',
      justifyContent: 'center',
    },

    mediaFallbackText: {
      color: colors.muted,
      fontWeight: '800',
    },

    mediaHint: {
      marginTop: 12,
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
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

    activeHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    saveCurrentButton: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
    saveCurrentButtonText: { color: colors.text, fontWeight: '900' },
    savePlanOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    savePlanCard: { width: '100%', maxWidth: 440, backgroundColor: colors.surface, borderRadius: 20, padding: 20 },
    savePlanTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
    savePlanHint: { color: colors.muted, fontSize: 13, marginTop: 6 },
    savePlanInput: { backgroundColor: colors.soft2, borderRadius: 12, color: colors.text, fontSize: 16, marginTop: 18, paddingHorizontal: 14, paddingVertical: 13 },
    savePlanActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
    savePlanCancel: { paddingHorizontal: 15, paddingVertical: 12 },
    savePlanCancelText: { color: colors.muted, fontWeight: '900' },
    savePlanConfirm: { backgroundColor: colors.text, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
    savePlanConfirmText: { color: colors.surface, fontWeight: '900' },
    savePlanDisabled: { opacity: 0.4 },

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
