export interface TopPlayer {
  _id: string;
  login: string;
  avatarUrl?: string | null;
  winRate?: number;
  totalScore: number;
  timeMode: number;
}

export interface TopPlayersByMode {
  timeMode: number;
  players: TopPlayer[];
}
