export const DEFAULT_SETTINGS = {
  passing_yards_per_point: 20,
  passing_td: 4,
  interception: -1,
  passing_2pt: 2,
  rushing_yards_per_point: 10,
  rushing_td: 6,
  rushing_fumble_lost: -2,
  rushing_100_bonus: 0,
  rushing_150_bonus: 0,
  rushing_200_bonus: 0,
  receiving_yards_per_point: 10,
  receiving_td: 6,
  receiving_reception: 1,
  receiving_fumble_lost: -2,
  receiving_100_bonus: 0,
  receiving_150_bonus: 0,
  receiving_200_bonus: 0,
  fg_0_39: 3,
  fg_40_49: 4,
  fg_50_59: 5,
  fg_60_plus: 6,
  fg_miss_0_39: -1,
  fg_miss_40_plus: 0,
  xp_made: 1,
  xp_missed: -1,
  dst_sack: 1,
  dst_interception: 2,
  dst_fumble_recovery: 2,
  dst_td: 6,
  dst_safety: 2,
  dst_blocked_kick: 2,
  dst_return_td: 6,
  dst_pa_0: 10,
  dst_pa_1_6: 7,
  dst_pa_7_13: 4,
  dst_pa_14_20: 1,
  dst_pa_21_27: 0,
  dst_pa_28_plus: -1,
};

export function getSettings(league: any) {
  return { ...DEFAULT_SETTINGS, ...(league.scoring_settings || {}) };
}

export function calcPlayerPoints(stats: any, position: string, s: any): number {
  if (!stats) return 0;

  if (position === "DST") {
    // dst_points_allowed (and every other dst_* field) is written as one
    // atomic object only when the team has actual game data this week (see
    // runLiveSync) - a bye or a game that hasn't kicked off leaves it SQL
    // NULL, not 0. Gate on that null-ness, not just the shutout bonus: a
    // team with no game data should score 0 across the board, not just skip
    // the bonus (other dst_* fields would already be 0 here too, but this
    // makes "hasn't played" an explicit early return rather than relying on
    // every term happening to zero out the same way).
    if (stats.dst_points_allowed == null) return 0;

    let pts = 0;
    pts += (stats.dst_sacks || 0) * s.dst_sack;
    pts += (stats.dst_ints || 0) * s.dst_interception;
    pts += (stats.dst_fumbles_rec || 0) * s.dst_fumble_recovery;
    pts += (stats.dst_tds || 0) * s.dst_td;
    pts += (stats.dst_safety || 0) * s.dst_safety;
    const pa = stats.dst_points_allowed;
    if (pa === 0)      pts += s.dst_pa_0;
    else if (pa <= 6)  pts += s.dst_pa_1_6;
    else if (pa <= 13) pts += s.dst_pa_7_13;
    else if (pa <= 20) pts += s.dst_pa_14_20;
    else if (pa <= 27) pts += s.dst_pa_21_27;
    else               pts += s.dst_pa_28_plus;
    return pts;
  }

  if (position === "K") {
    let pts = 0;
    pts += (stats.fg_0_39   || 0) * s.fg_0_39;
    pts += (stats.fg_40_49  || 0) * s.fg_40_49;
    pts += (stats.fg_50_plus || 0) * s.fg_50_59;
    pts += (stats.xp_made   || 0) * s.xp_made;
    return pts;
  }

  let pts = 0;
  pts += (stats.pass_yards    || 0) / s.passing_yards_per_point;
  pts += (stats.pass_tds      || 0) * s.passing_td;
  pts += (stats.interceptions || 0) * s.interception;
  pts += (stats.rush_yards    || 0) / s.rushing_yards_per_point;
  pts += (stats.rush_tds      || 0) * s.rushing_td;
  if      ((stats.rush_yards || 0) >= 200) pts += s.rushing_200_bonus;
  else if ((stats.rush_yards || 0) >= 150) pts += s.rushing_150_bonus;
  else if ((stats.rush_yards || 0) >= 100) pts += s.rushing_100_bonus;
  pts += (stats.receptions || 0) * s.receiving_reception;
  pts += (stats.rec_yards  || 0) / s.receiving_yards_per_point;
  pts += (stats.rec_tds    || 0) * s.receiving_td;
  if      ((stats.rec_yards || 0) >= 200) pts += s.receiving_200_bonus;
  else if ((stats.rec_yards || 0) >= 150) pts += s.receiving_150_bonus;
  else if ((stats.rec_yards || 0) >= 100) pts += s.receiving_100_bonus;
  pts += (stats.fumbles_lost || 0) * s.rushing_fumble_lost;
  return pts;
}
