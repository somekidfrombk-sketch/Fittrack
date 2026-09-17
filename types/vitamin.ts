export type VitaminFoodTiming = 'with-food' | 'without-food' | 'either';

export type VitaminEntry = {
  id: string;
  profileId: string;
  name: string;
  dose: string;
  time: string;
  foodTiming: VitaminFoodTiming;
  guidance: string;
  reminderEnabled: boolean;
  notificationId?: string;
  takenDates: string[];
  createdAt: string;
};