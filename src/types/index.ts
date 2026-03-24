import type { RecordModel } from 'pocketbase'

export type LicenceType = 'scorer_vb' | 'referee_vb' | 'otr1_bb' | 'otr2_bb' | 'otn_bb' | 'referee_bb'
export type MemberPosition =
  | 'setter'
  | 'outside'
  | 'middle'
  | 'opposite'
  | 'libero'
  | 'point_guard'
  | 'shooting_guard'
  | 'small_forward'
  | 'power_forward'
  | 'center'
  | 'coach'
  | 'guest'
  | 'other'

export interface Team extends RecordModel {
  name: string
  full_name: string
  team_id: string
  sport: 'volleyball' | 'basketball'
  league: string
  season: string
  color: string
  coach: string[]
  captain: string[]
  team_responsible: string[]
  active: boolean
  team_picture: string
  team_picture_pos: string
  social_url: string
  sponsors: string[]
  sponsors_logos: string[]
  bb_source_id: string
  features_enabled: FeatureToggles

}

export interface FeatureToggles {
  polls?: boolean
  carpool?: boolean
  tasks?: boolean
  show_rsvp_time?: boolean
}

export interface Member extends RecordModel {
  email: string
  name: string
  first_name: string
  last_name: string
  phone: string
  license_nr: string
  number: number
  position: MemberPosition[]
  photo: string
  role: ('user' | 'vorstand' | 'admin' | 'vb_admin' | 'bb_admin' | 'superuser')[]
  kscw_membership_active: boolean
  birthdate: string
  yob: number
  licences: LicenceType[]
  coach_approved_team: boolean
  requested_team: string
  language: 'english' | 'german' | 'french' | 'italian' | 'swiss_german' | ''
  hide_phone: boolean
  birthdate_visibility: 'full' | 'year_only' | 'hidden'
  website_visible: boolean
  wiedisync_active: boolean
  shell: boolean
  shell_expires: string
  shell_reminder_sent: boolean

}

export interface MemberTeam extends RecordModel {
  member: string
  team: string
  season: string
  guest_level: number  // 0=member, 1-3=guest levels

}

export interface TeamInvite extends RecordModel {
  token: string
  team: string
  invited_by: string
  guest_level: number // 0=player, 1-3=guest
  status: 'pending' | 'claimed' | 'expired'
  claimed_by: string
  expires_at: string

}

export interface Hall extends RecordModel {
  name: string
  address: string
  city: string
  courts: number
  notes: string
  maps_url: string
  homologation: boolean
  sv_hall_id: string

}

export interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    city?: string
    postcode?: string
    country?: string
    state?: string
    osm_key?: string
    osm_value?: string
  }
}

export interface LocationResult {
  name: string
  address: string
  city: string
  lat: number | null
  lon: number | null
  source: 'pocketbase' | 'photon'
}

export interface SlotClaim extends RecordModel {
  hall_slot: string
  hall: string
  date: string
  start_time: string
  end_time: string
  claimed_by_team: string
  claimed_by_member: string
  freed_reason: 'cancelled_training' | 'away_game' | 'manual_free'
  freed_source_id: string
  notes: string
  status: 'active' | 'revoked'

}

export interface VirtualSlotMeta {
  source: 'game' | 'training' | 'hall_event'
  sourceId: string
  sourceRecord: Game | Training | HallEvent
  isAway?: boolean
  isCancelled?: boolean
  isFreed?: boolean
  isClaimed?: boolean
  claimRecord?: SlotClaim
  /** Spielhalle slot that is free (no game scheduled) */
  isSpielhalleFreed?: boolean
  /** Recurring training template surfaced as free for this week/day */
  isTemplateFreed?: boolean
  /** When a slot spans multiple halls (e.g. BB game in A+B), lists all hall IDs */
  spanHallIds?: string[]
}

export interface HallSlot extends RecordModel {
  hall: string
  team: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_type: 'training' | 'game' | 'event' | 'away' | 'other'
  recurring: boolean
  valid_from: string
  valid_until: string
  indefinite: boolean
  label: string
  notes: string
  sport?: 'volleyball' | 'basketball' | ''

  _virtual?: VirtualSlotMeta
}

export interface HallClosure extends RecordModel {
  hall: string
  start_date: string
  end_date: string
  reason: string
  source: 'hauswart' | 'admin' | 'auto' | 'gcal' | 'school_holidays'

}

export interface Game extends RecordModel {
  game_id: string
  home_team: string
  away_team: string
  kscw_team: string
  hall: string
  away_hall_json: { name: string; address: string; city: string; plus_code?: string } | null
  date: string
  time: string
  league: string
  round: string
  season: string
  type: 'home' | 'away'
  status: 'scheduled' | 'live' | 'completed' | 'postponed'
  home_score: number
  away_score: number
  sets_json: unknown
  // Legacy text fields (from Swiss Volley sync)
  scorer_team: string
  scorer_person: string
  scoreboard_team: string
  scoreboard_person: string
  // Volleyball duty assignments (PB field names)
  scorer_member: string
  scoreboard_member: string
  scorer_scoreboard_member: string
  scorer_duty_team: string
  scoreboard_duty_team: string
  scorer_scoreboard_duty_team: string
  // Basketball duty assignments
  bb_scorer_member: string
  bb_timekeeper_member: string
  bb_24s_official: string
  bb_duty_team: string
  bb_scorer_duty_team: string
  bb_timekeeper_duty_team: string
  bb_24s_duty_team: string
  duty_confirmed: boolean
  referees_json: Array<{ name: string; id?: number }>
  source: 'swiss_volley' | 'manual' | 'basketplan'
  respond_by: string

}


export interface Ranking extends RecordModel {
  team_id: string
  team: string
  team_name: string
  league: string
  rank: number
  played: number
  won: number
  lost: number
  wins_clear?: number
  wins_narrow?: number
  defeats_clear?: number
  defeats_narrow?: number
  sets_won: number
  sets_lost: number
  points_won: number
  points_lost: number
  points: number
  season: string
  updated_at: string

}

export interface Training extends RecordModel {
  team: string
  hall_slot: string
  date: string
  start_time: string
  end_time: string
  hall: string
  hall_name: string
  coach: string
  notes: string
  cancelled: boolean
  cancel_reason: string
  respond_by: string
  min_participants: number
  max_participants: number
  require_note_if_absent: boolean

}

export interface Absence extends RecordModel {
  member: string
  start_date: string
  end_date: string
  reason: 'injury' | 'vacation' | 'work' | 'personal' | 'other'
  reason_detail: string
  affects: string[] // 'all', 'trainings', 'games', 'events'
  type: 'standard' | 'weekly'
  days_of_week: number[] // 0=Mon..6=Sun (only for type='weekly')
  indefinite: boolean
}

export interface Event extends RecordModel {
  title: string
  description: string
  event_type: 'verein' | 'social' | 'meeting' | 'tournament' | 'trainingsweekend' | 'friendly' | 'other'
  start_date: string
  end_date: string
  all_day: boolean
  location: string
  hall: string
  teams: string[]
  created_by: string
  respond_by: string
  max_players: number
  participation_mode: 'whole' | 'per_day' | 'per_session' | ''
  require_note_if_absent: boolean
  features_enabled: FeatureToggles

}

export interface EventSession extends RecordModel {
  event: string
  date: string
  start_time: string
  end_time: string
  label: string
  sort_order: number

}

export interface HallEvent extends RecordModel {
  uid: string
  title: string
  date: string
  start_time: string
  end_time: string
  location: string
  hall: string[]
  all_day: boolean
  source: string
}

export interface Participation extends RecordModel {
  member: string
  activity_type: 'training' | 'game' | 'event'
  activity_id: string
  status: 'confirmed' | 'declined' | 'tentative' | 'waitlisted'
  note: string
  session_id: string
  guest_count: number
  is_staff: boolean
  waitlisted_at: string

}

export interface UserLog extends RecordModel {
  user: string
  action: 'create' | 'update' | 'delete'
  collection_name: string
  record_id: string
  data: Record<string, unknown> | null
}

// ── Game Scheduling (Terminplanung) ──────────────────────────────────

export interface GameSchedulingSeason extends RecordModel {
  season: string
  status: 'setup' | 'open' | 'closed'
  spielsamstage: SpielsamstagConfig[]
  team_slot_config: TeamSlotConfig | null
  notes: string

}

export interface SpielsamstagConfig {
  date: string
  slots: { time: string; hall_id: string }[]
}

export interface TeamSlotConfig {
  [teamId: string]: {
    source: 'hall_slot' | 'spielsamstag' | 'manual'
    hall_slot_id?: string
  }
}

export interface GameSchedulingSlot extends RecordModel {
  season: string
  kscw_team: string
  date: string
  start_time: string
  end_time: string
  hall: string
  source: 'hall_slot' | 'spielsamstag' | 'spielhalle' | 'manual'
  status: 'available' | 'booked' | 'blocked'
  booking: string
  game: string

}

export interface GameSchedulingOpponent extends RecordModel {
  season: string
  club_name: string
  contact_name: string
  contact_email: string
  kscw_team: string
  token: string
  home_game: string
  away_game: string

}

export interface GameSchedulingBooking extends RecordModel {
  season: string
  opponent: string
  type: 'home_slot_pick' | 'away_proposal'
  game: string
  slot: string
  proposed_datetime_1: string
  proposed_place_1: string
  proposed_datetime_2: string
  proposed_place_2: string
  proposed_datetime_3: string
  proposed_place_3: string
  confirmed_proposal: number
  status: 'pending' | 'confirmed' | 'rejected'
  admin_notes: string

}

export interface ScorerDelegation extends RecordModel {
  game: string
  role: 'scorer' | 'scoreboard' | 'scorer_scoreboard' | 'bb_scorer' | 'bb_timekeeper' | 'bb_24s_official'
  from_member: string
  to_member: string
  from_team: string
  to_team: string
  same_team: boolean
  status: 'pending' | 'accepted' | 'declined' | 'expired'

}

export interface Notification extends RecordModel {
  member: string
  type: 'activity_change' | 'upcoming_activity' | 'deadline_reminder' | 'result_available' | 'duty_delegation_request' | 'poll_created' | 'carpool_update' | 'task_assigned'
  title: string
  body: string
  activity_type: 'game' | 'training' | 'event' | 'scorer_duty' | 'poll' | 'carpool' | 'task' | ''
  activity_id: string
  team: string
  read: boolean
}

export type TaskCategory = 'setup' | 'equipment' | 'food' | 'firstAid' | 'other'

export interface Task extends RecordModel {
  activity_type: 'game' | 'training' | 'event'
  activity_id: string
  label: string
  category: TaskCategory | ''
  assigned_to: string
  claimed_by: string
  completed: boolean
  completed_at: string
  sort_order: number
  created_by: string
}

export interface TaskTemplate extends RecordModel {
  name: string
  team: string
  tasks_json: Array<{ label: string; category: TaskCategory | '' }>
  created_by: string
}

// ── Carpool ─────────────────────────────────────────────────────────────

export interface Carpool extends RecordModel {
  game: string
  driver: string
  seats_available: number
  departure_time: string
  departure_location: string
  notes: string
  status: 'open' | 'full' | 'cancelled'
}

export interface CarpoolPassenger extends RecordModel {
  carpool: string
  passenger: string
  status: 'confirmed' | 'cancelled'
}

// ── Polls ───────────────────────────────────────────────────────────────

export interface Poll extends RecordModel {
  team: string
  question: string
  options: string[]
  mode: 'single' | 'multi'
  deadline: string
  created_by: string
  status: 'open' | 'closed'
  anonymous: boolean
}

export interface PollVote extends RecordModel {
  poll: string
  member: string
  selected_options: number[]
}
