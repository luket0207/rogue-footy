export const CUP_COMPETITION = Object.freeze({
  NONE: "NONE",
  SWAP_CUP: "SWAP_CUP",
  SUPER_SWAP_CUP: "SUPER_SWAP_CUP",
  CHAMPIONS_CUP: "CHAMPIONS_CUP",
});

export const getCupCompetitionForTier = (tierValue) => {
  const tier = Number(tierValue) || 10;
  if (tier === 1) return CUP_COMPETITION.CHAMPIONS_CUP;
  if (tier >= 2 && tier <= 5) return CUP_COMPETITION.SUPER_SWAP_CUP;
  if (tier >= 6 && tier <= 9) return CUP_COMPETITION.SWAP_CUP;
  return CUP_COMPETITION.NONE;
};

export const getCupCompetitionLabel = (competition) => {
  if (competition === CUP_COMPETITION.CHAMPIONS_CUP) return "Champions Cup";
  if (competition === CUP_COMPETITION.SUPER_SWAP_CUP) return "Super Swap Cup";
  if (competition === CUP_COMPETITION.SWAP_CUP) return "Swap Cup";
  return "No Cup";
};

const createTeamTierMap = (leagues = []) => {
  const teamTierMap = {};
  (Array.isArray(leagues) ? leagues : []).forEach((league) => {
    const tier = Number(league?.tier) || 10;
    (Array.isArray(league?.teamIds) ? league.teamIds : []).forEach((teamId) => {
      teamTierMap[teamId] = tier;
    });
  });
  return teamTierMap;
};

export const createCupEligibilityState = ({
  playerTeam,
  aiTeams = [],
  leagues = [],
  seasonNumber = 1,
  updatedAt = new Date().toISOString(),
} = {}) => {
  const teamTierMap = createTeamTierMap(leagues);
  const byTeamId = {};

  const registerTeam = (teamId) => {
    if (!teamId) return;
    const tier = Number(teamTierMap[teamId]) || 10;
    const cupCompetition = getCupCompetitionForTier(tier);
    byTeamId[teamId] = {
      teamId,
      tier,
      cupCompetition,
      cupLabel: getCupCompetitionLabel(cupCompetition),
      eligible: cupCompetition !== CUP_COMPETITION.NONE,
    };
  };

  registerTeam(playerTeam?.id || "");
  (Array.isArray(aiTeams) ? aiTeams : []).forEach((team) => registerTeam(team?.id || ""));

  const playerTeamId = playerTeam?.id || "";
  const playerCup = byTeamId[playerTeamId] || {
    teamId: playerTeamId,
    tier: 10,
    cupCompetition: CUP_COMPETITION.NONE,
    cupLabel: getCupCompetitionLabel(CUP_COMPETITION.NONE),
    eligible: false,
  };

  return {
    seasonNumber: Number(seasonNumber) || 1,
    updatedAt,
    byTeamId,
    playerTeamId,
    playerCup,
  };
};

export const applyCupCompetitionToTeams = ({
  playerTeam,
  aiTeams = [],
  cupEligibility,
}) => {
  const byTeamId =
    cupEligibility?.byTeamId && typeof cupEligibility.byTeamId === "object"
      ? cupEligibility.byTeamId
      : {};

  const mapTeam = (team) => {
    if (!team || typeof team !== "object") return team;
    const cup = byTeamId[team.id];
    if (!cup) return team;
    return {
      ...team,
      cupCompetition: cup.cupCompetition,
      cupTier: cup.tier,
    };
  };

  return {
    playerTeam: mapTeam(playerTeam),
    aiTeams: (Array.isArray(aiTeams) ? aiTeams : []).map((team) => mapTeam(team)),
  };
};

