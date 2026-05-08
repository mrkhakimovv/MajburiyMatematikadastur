export interface User {
  id: number;
  telegram_id: string;
  first_name: string;
  last_name: string;
  username: string;
  phone_number: string;
  registered_at: string;
  profile_photo: string | null;
  status?: string;
  accent_color?: string;
  selected_badge?: string;
}

export interface UserStats {
  total_tests: number;
  correct_answers: number;
  wrong_answers: number;
  time_spent: number;
}

export interface UserWithStats extends User {
  stats: UserStats;
  rank: number;
  earned_badges?: string[];
}

export interface Test {
  id: number;
  file_id: string;
  correct_answer: string;
  created_at: string;
  image_url: string | null;
}

export interface Channel {
  id: number;
  username: string;
}
