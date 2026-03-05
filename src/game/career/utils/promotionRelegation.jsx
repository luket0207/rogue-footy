const sortLeaguesByTier = (leagues) =>
  [...leagues].sort((leagueA, leagueB) => Number(leagueA.tier) - Number(leagueB.tier));

const getLeagueRows = (league, leagueTables) => {
  const rows = Array.isArray(leagueTables?.[league.id]?.rows) ? leagueTables[league.id].rows : [];
  if (rows.length > 0) return rows;
  return (Array.isArray(league?.teamIds) ? league.teamIds : []).map((teamId) => ({
    teamId,
  }));
};

const getPlayoffWinnersByLeague = (fixturesData) => {
  const fixtures = Array.isArray(fixturesData?.fixtures) ? fixturesData.fixtures : [];
  return fixtures
    .filter((fixture) => fixture.stage === "PLAYOFF_FINAL" && fixture.played && fixture.result)
    .reduce((result, fixture) => {
      const homeGoals = Number(fixture?.result?.homeGoals) || 0;
      const awayGoals = Number(fixture?.result?.awayGoals) || 0;
      if (homeGoals === awayGoals) return result;
      result[fixture.leagueId] = homeGoals > awayGoals ? fixture.homeTeamId : fixture.awayTeamId;
      return result;
    }, {});
};

const pickPromotedTeamId = ({ league, leagueTables, playoffWinners }) => {
  const playoffWinner = playoffWinners[league.id];
  if (playoffWinner) return playoffWinner;
  const rows = getLeagueRows(league, leagueTables);
  return rows[0]?.teamId || "";
};

const pickRelegatedTeamId = ({ league, leagueTables, promotedTeamId }) => {
  const rows = getLeagueRows(league, leagueTables);
  if (rows.length === 0) return "";

  const bottom = rows[rows.length - 1]?.teamId || "";
  if (!bottom || bottom !== promotedTeamId || rows.length < 2) {
    return bottom;
  }

  // Safety fallback for malformed rows where top == bottom.
  return rows[rows.length - 2]?.teamId || bottom;
};

export const createLeaguesAfterPromotionRelegation = ({
  leagues = [],
  leagueTables = {},
  fixturesData,
} = {}) => {
  if (!Array.isArray(leagues) || leagues.length === 0) {
    return {
      leagues: [],
      movements: [],
    };
  }

  const sortedLeagues = sortLeaguesByTier(leagues);
  const highestTier = Number(sortedLeagues[0]?.tier) || 1;
  const lowestTier = Number(sortedLeagues[sortedLeagues.length - 1]?.tier) || sortedLeagues.length;
  const playoffWinners = getPlayoffWinnersByLeague(fixturesData);
  const promotedByTier = {};
  const relegatedByTier = {};
  const movements = [];

  sortedLeagues.forEach((league) => {
    const tier = Number(league.tier);
    if (tier > highestTier) {
      const promotedTeamId = pickPromotedTeamId({
        league,
        leagueTables,
        playoffWinners,
      });
      if (promotedTeamId) {
        promotedByTier[tier] = promotedTeamId;
        movements.push({
          type: "PROMOTION",
          teamId: promotedTeamId,
          fromTier: tier,
          toTier: tier - 1,
        });
      }
    }

    if (tier < lowestTier) {
      const relegatedTeamId = pickRelegatedTeamId({
        league,
        leagueTables,
        promotedTeamId: promotedByTier[tier] || "",
      });
      if (relegatedTeamId) {
        relegatedByTier[tier] = relegatedTeamId;
        movements.push({
          type: "RELEGATION",
          teamId: relegatedTeamId,
          fromTier: tier,
          toTier: tier + 1,
        });
      }
    }
  });

  const nextLeagues = sortedLeagues.map((league) => {
    const tier = Number(league.tier);
    const originalTeamIds = Array.isArray(league.teamIds) ? league.teamIds : [];
    const outgoing = new Set(
      [promotedByTier[tier], relegatedByTier[tier]].filter(Boolean)
    );

    const nextTeamIds = originalTeamIds.filter((teamId) => !outgoing.has(teamId));
    const incomingFromLower = promotedByTier[tier + 1] || "";
    const incomingFromUpper = relegatedByTier[tier - 1] || "";
    [incomingFromLower, incomingFromUpper]
      .filter(Boolean)
      .forEach((teamId) => {
        if (!nextTeamIds.includes(teamId)) {
          nextTeamIds.push(teamId);
        }
      });

    // Safety to keep league sizes stable with persistent team pool.
    originalTeamIds.forEach((teamId) => {
      if (nextTeamIds.length >= originalTeamIds.length) return;
      if (!nextTeamIds.includes(teamId)) {
        nextTeamIds.push(teamId);
      }
    });

    return {
      ...league,
      teamIds: nextTeamIds.slice(0, originalTeamIds.length),
    };
  });

  return {
    leagues: nextLeagues,
    movements,
  };
};

export const applyCurrentTierToTeams = ({ playerTeam, aiTeams = [], leagues = [] }) => {
  const teamTierMap = {};
  leagues.forEach((league) => {
    (Array.isArray(league.teamIds) ? league.teamIds : []).forEach((teamId) => {
      teamTierMap[teamId] = Number(league.tier) || 1;
    });
  });

  const nextPlayerTeam =
    playerTeam && typeof playerTeam === "object"
      ? {
          ...playerTeam,
          currentTier: teamTierMap[playerTeam.id] || playerTeam.currentTier || 1,
        }
      : playerTeam;

  const nextAiTeams = (Array.isArray(aiTeams) ? aiTeams : []).map((team) => ({
    ...team,
    currentTier: teamTierMap[team.id] || team.currentTier || team.baseTier || 10,
  }));

  return {
    playerTeam: nextPlayerTeam,
    aiTeams: nextAiTeams,
  };
};

