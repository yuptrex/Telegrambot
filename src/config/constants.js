module.exports = {
  STARTING_GOLD: 100,
  STARTING_GEMS: 0,
  STARTING_ELO: 1000,

  TURN_TIMEOUT_MS: 30_000,
  MAX_BATTLE_TURNS: 40,

  EXP_PER_LEVEL_BASE: 100, // exp needed for level N = BASE * N^EXP_CURVE_EXPONENT
  EXP_CURVE_EXPONENT: 1.35,

  PVE_GOLD_REWARD: [15, 40],
  PVE_EXP_REWARD: [20, 50],
  PVP_GOLD_REWARD: [25, 60],
  PVP_EXP_REWARD: [30, 70],
  LOSER_CONSOLATION_EXP: 10,

  ITEM_DROP_CHANCE: 0.18,

  ELO_K_FACTOR: 32,

  DAILY_QUEST_COUNT: 3,
  SEASON_LENGTH_DAYS: 30,

  CRIT_BASE_CHANCE: 0.05,
  CRIT_AGILITY_SCALING: 0.002, // +0.2% crit per point of agility
  CRIT_DAMAGE_MULTIPLIER: 1.5,

  DAMAGE_VARIANCE: 0.1, // +/-10%

  RARITY_ORDER: ['common', 'rare', 'epic', 'legendary'],

  GUILD_ROLES: ['leader', 'officer', 'member'],
  GUILD_JOIN_TYPES: ['open', 'request', 'invite'],
};
