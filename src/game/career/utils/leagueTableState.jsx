const sortRows = (rows) =>
  [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.teamId.localeCompare(b.teamId);
  });

const createBaseRow = (teamId) => ({
  teamId,
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDiff: 0,
  points: 0,
});

export const createLeagueTablesFromFixtures = ({ leagues = [], fixturesData } = {}) => {
  const fixtures = Array.isArray(fixturesData?.fixtures) ? fixturesData.fixtures : [];
  const tables = {};

  leagues.forEach((league) => {
    const rows = (Array.isArray(league.teamIds) ? league.teamIds : []).map((teamId) =>
      createBaseRow(teamId)
    );
    tables[league.id] = {
      leagueId: league.id,
      tier: league.tier,
      rows,
    };
  });

  fixtures.forEach((fixture) => {
    if (!fixture.played || !fixture.result || fixture.stage !== "LEAGUE") return;
    const table = tables[fixture.leagueId];
    if (!table) return;

    const homeRow = table.rows.find((row) => row.teamId === fixture.homeTeamId);
    const awayRow = table.rows.find((row) => row.teamId === fixture.awayTeamId);
    if (!homeRow || !awayRow) return;

    const homeGoals = Number(fixture.result.homeGoals) || 0;
    const awayGoals = Number(fixture.result.awayGoals) || 0;

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += homeGoals;
    homeRow.goalsAgainst += awayGoals;
    awayRow.goalsFor += awayGoals;
    awayRow.goalsAgainst += homeGoals;
    homeRow.goalDiff = homeRow.goalsFor - homeRow.goalsAgainst;
    awayRow.goalDiff = awayRow.goalsFor - awayRow.goalsAgainst;

    if (homeGoals > awayGoals) {
      homeRow.wins += 1;
      homeRow.points += 3;
      awayRow.losses += 1;
      return;
    }

    if (awayGoals > homeGoals) {
      awayRow.wins += 1;
      awayRow.points += 3;
      homeRow.losses += 1;
      return;
    }

    homeRow.draws += 1;
    awayRow.draws += 1;
    homeRow.points += 1;
    awayRow.points += 1;
  });

  Object.keys(tables).forEach((leagueId) => {
    tables[leagueId] = {
      ...tables[leagueId],
      rows: sortRows(tables[leagueId].rows),
    };
  });

  return tables;
};

export const isValidLeagueTables = (tables, leagues = []) => {
  if (!tables || typeof tables !== "object") return false;
  return leagues.every((league) => {
    const table = tables[league.id];
    if (!table || !Array.isArray(table.rows) || table.rows.length !== league.teamIds.length) {
      return false;
    }
    return table.rows.every((row) =>
      [
        row.played,
        row.wins,
        row.draws,
        row.losses,
        row.goalsFor,
        row.goalsAgainst,
        row.goalDiff,
        row.points,
      ].every((value) => Number.isFinite(value))
    );
  });
};
