import { createSeededRng } from "../../../features/matchSim/utils/seededRng";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const resolveTeamStrength = (teamsById, teamId) =>
  Number(teamsById?.[teamId]?.teamStrength) || 70;

const rollGoalsFromExpected = (expectedGoals, rng) => {
  const chanceCount = 6;
  const baseChance = clamp(expectedGoals / chanceCount, 0.02, 0.88);
  let goals = 0;

  for (let chance = 0; chance < chanceCount; chance += 1) {
    if (rng.random() < baseChance) {
      goals += 1;
    }
  }

  const bonusChance = clamp((expectedGoals - 2.1) * 0.2, 0, 0.28);
  if (rng.random() < bonusChance) {
    goals += 1;
  }

  return goals;
};

const simulateFixtureResult = ({ fixture, teamsById, seedBase }) => {
  const rng = createSeededRng(`${seedBase}:${fixture.id}:${fixture.dayNumber}`);
  const homeStrength = resolveTeamStrength(teamsById, fixture.homeTeamId);
  const awayStrength = resolveTeamStrength(teamsById, fixture.awayTeamId);
  const strengthDiff = homeStrength - awayStrength;

  const homeExpected = clamp(1.35 + 0.2 + strengthDiff / 22, 0.2, 4.6);
  const awayExpected = clamp(1.35 - strengthDiff / 22, 0.2, 4.6);

  return {
    homeGoals: rollGoalsFromExpected(homeExpected, rng),
    awayGoals: rollGoalsFromExpected(awayExpected, rng),
  };
};

export const simulateOtherLeagueMatchesForDay = ({
  fixturesData,
  dayNumber,
  playerTeamId,
  teamsById,
  seedBase = "career-matchday",
} = {}) => {
  const fixtures = Array.isArray(fixturesData?.fixtures) ? fixturesData.fixtures : [];
  let simulatedCount = 0;

  const nextFixtures = fixtures.map((fixture) => {
    if (fixture.played) return fixture;
    if (Number(fixture.dayNumber) !== Number(dayNumber)) return fixture;

    const includesPlayer =
      fixture.homeTeamId === playerTeamId || fixture.awayTeamId === playerTeamId;
    if (includesPlayer) return fixture;

    simulatedCount += 1;
    return {
      ...fixture,
      played: true,
      result: simulateFixtureResult({ fixture, teamsById, seedBase }),
      simulated: true,
    };
  });

  return {
    ...fixturesData,
    fixtures: nextFixtures,
    simulationMeta: {
      ...(fixturesData?.simulationMeta && typeof fixturesData.simulationMeta === "object"
        ? fixturesData.simulationMeta
        : {}),
      lastSimulatedDay: Number(dayNumber),
      simulatedCount,
    },
  };
};

