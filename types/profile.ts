export type Gender = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'very';

export type Goal =
  | 'maintain'
  | 'lose'
  | 'gain';

export type LossRate =
  | '0.5'
  | '1'
  | '1.5'
  | '2';

export type ProfileData = {
  id: string;
  name: string;
  gender: Gender;
  age: string;
  heightFeet: string;
  heightInches: string;
  weight: string;
  goalWeight: string;
  neck: string;
  waist: string;
  hip: string;
  activityLevel: ActivityLevel;
  goal: Goal;
  lossRate: LossRate;
  calorieTarget: string;
  proteinTarget: string;
  carbTarget: string;
  fatTarget: string;
};

export const emptyProfile: ProfileData = {
  id: '',
  name: '',
  gender: 'male',
  age: '',
  heightFeet: '',
  heightInches: '',
  weight: '',
  goalWeight: '',
  neck: '',
  waist: '',
  hip: '',
  activityLevel: 'moderate',
  goal: 'maintain',
  lossRate: '1',
  calorieTarget: '',
  proteinTarget: '',
  carbTarget: '',
  fatTarget: '',
};
