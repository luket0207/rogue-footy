import { makeDecision } from "../../../engine/utils/makeDecision/makeDecision";
import { EVENT_KIND, EVENT_OUTCOME, MATCH_HALF, POSITION, TEAM_KEY } from "./matchSimTypes";

const choose = (list, rng) => list[Math.floor(rng.random() * list.length)];
const scoreLabel = (scoreAfter) => `${scoreAfter.a}-${scoreAfter.b}`;
const nameOf = (player, fallback = "Unknown") => player?.name || fallback;

const PASS_VERBS = Object.freeze([
  "threads it",
  "slides it",
  "clips it",
  "drives it",
  "angles it",
  "zips it",
  "rolls it",
  "chips it",
  "lifts it",
  "whips it",
  "cuts it back",
  "dinks it",
  "stabs it",
  "nudges it",
  "bends it",
  "fires it",
]);

const SHOT_VERBS = Object.freeze([
  "lashes",
  "rifles",
  "drives",
  "smashes",
  "hammers",
  "snaps at",
  "sweeps",
  "stabs",
  "hooks",
  "fizzes",
  "thumps",
  "blasts",
  "cracks",
  "pokes",
  "whips",
  "slices",
]);

const CONTROL_OPENERS = Object.freeze([
  "recycle possession",
  "keep the ball moving",
  "settle into shape",
  "work the ball side to side",
  "slow the tempo",
  "retain control",
  "probe for gaps",
  "stay patient in build up",
  "hold field position",
  "pin the opposition back",
  "find safe angles",
  "sustain pressure",
  "keep their structure",
  "manage this phase calmly",
  "build methodically",
  "control the rhythm",
]);

const TRANSITION_OPENERS = Object.freeze([
  "Turnover in midfield",
  "Loose touch under pressure",
  "A poor pass is punished",
  "The press forces an error",
  "A heavy touch invites pressure",
  "The ball breaks loose",
  "The passing lane is closed",
  "A rushed touch gives it away",
  "Pressure tells in midfield",
  "A ricochet drops kindly",
  "An overhit pass is intercepted",
  "A duel is won cleanly",
  "The second ball is claimed",
  "Quick feet win it back",
  "A challenge pops the ball free",
  "The defender reads it early",
]);

const CORNER_OPENERS = Object.freeze([
  "Corner",
  "Corner kick",
  "Set piece from the corner",
  "Dead ball from the flag",
  "Wide corner delivery",
  "Attacking corner",
  "Corner opportunity",
  "Corner situation",
]);

const getHalfLabelFromMinute = (minute) => (minute > 30 ? MATCH_HALF.H2 : MATCH_HALF.H1);

const weightedPickPlayer = (entries, rng) => {
  const weights = entries.reduce((result, entry) => {
    if (!entry || !entry.player) return result;
    const safeWeight = Number.isFinite(entry.weight) ? Math.max(0, entry.weight) : 0;
    if (safeWeight > 0) result[entry.player.id] = safeWeight;
    return result;
  }, {});
  const playerIds = Object.keys(weights);
  if (playerIds.length === 0) return null;
  const selectedId = makeDecision(weights, rng.random);
  return entries.find((entry) => entry.player.id === selectedId)?.player || null;
};

const getTeamPlayers = (context, teamId) => {
  const lineup = context.teams[teamId].lineup;
  const gk = lineup.gkId ? context.playersById[lineup.gkId] : null;
  const defs = lineup[POSITION.DEF].map((id) => context.playersById[id]).filter(Boolean);
  const mids = lineup[POSITION.MID].map((id) => context.playersById[id]).filter(Boolean);
  const fwrs = lineup[POSITION.FWR].map((id) => context.playersById[id]).filter(Boolean);
  return {
    gk,
    defs,
    mids,
    fwrs,
    outfield: [...defs, ...mids, ...fwrs],
    all: [...(gk ? [gk] : []), ...defs, ...mids, ...fwrs],
  };
};

export const getEligiblePlayers = (teamPlayers, rolePreference) => {
  if (rolePreference === "shooter") return [...teamPlayers.fwrs, ...teamPlayers.mids, ...teamPlayers.defs];
  if (rolePreference === "creator") return [...teamPlayers.mids, ...teamPlayers.fwrs, ...teamPlayers.defs];
  if (rolePreference === "defender") return [...teamPlayers.defs, ...teamPlayers.mids, ...teamPlayers.fwrs];
  if (rolePreference === "gk") return teamPlayers.gk ? [teamPlayers.gk] : [];
  return teamPlayers.all;
};

export const pickRandomDifferentPlayer = (teamPlayers, rng, notId) => {
  const options = teamPlayers.all.filter((player) => player.id !== notId);
  if (options.length === 0) return null;
  return choose(options, rng);
};

export const pickGK = (teamPlayers) => teamPlayers.gk || null;

export const pickShooter = (teamPlayers, rng) =>
  weightedPickPlayer(
    getEligiblePlayers(teamPlayers, "shooter").map((player) => {
      const roleMultiplier = teamPlayers.fwrs.some((it) => it.id === player.id)
        ? 1.0
        : teamPlayers.mids.some((it) => it.id === player.id)
          ? 0.75
          : 0.5;
      return {
        player,
        weight: player.finishing * roleMultiplier + player.offBall * 0.25 + player.control * 0.15,
      };
    }),
    rng
  );

export const pickCreator = (teamPlayers, rng, notId = null) =>
  weightedPickPlayer(
    getEligiblePlayers(teamPlayers, "creator")
      .filter((player) => player.id !== notId)
      .map((player) => {
        const roleMultiplier = teamPlayers.mids.some((it) => it.id === player.id)
          ? 1.0
          : teamPlayers.fwrs.some((it) => it.id === player.id)
            ? 0.8
            : 0.65;
        return {
          player,
          weight: (player.passing * 0.65 + player.offBall * 0.35) * roleMultiplier,
        };
      }),
    rng
  ) || pickRandomDifferentPlayer(teamPlayers, rng, notId);

export const pickDefender = (teamPlayers, rng, notId = null) =>
  weightedPickPlayer(
    getEligiblePlayers(teamPlayers, "defender")
      .filter((player) => player.id !== notId)
      .map((player) => {
        const roleMultiplier = teamPlayers.defs.some((it) => it.id === player.id)
          ? 1.0
          : teamPlayers.mids.some((it) => it.id === player.id)
            ? 0.82
            : 0.35;
        return {
          player,
          weight: (player.defending * 0.7 + player.workRate * 0.3) * roleMultiplier,
        };
      }),
    rng
  ) || pickRandomDifferentPlayer(teamPlayers, rng, notId);

const buildEvent = ({
  chunkIndex,
  indexInChunk,
  minute,
  half,
  teamId,
  kind,
  primaryPlayerId,
  secondaryPlayerId,
  xg,
  outcome,
  scoreAfter,
  text,
  tags = [],
}) => ({
  id: `event-${chunkIndex}-${minute}-${indexInChunk}-${kind}`,
  chunkIndex,
  half,
  minute,
  teamId,
  kind,
  primaryPlayerId,
  secondaryPlayerId,
  xg,
  outcome,
  scoreAfter,
  text,
  tags,
});

const chooseLeadInKind = ({ chanceCreated, goalScored, possessionSwing, rng }) =>
  makeDecision(
    {
      [EVENT_KIND.BUILD_UP]: chanceCreated ? 0.25 : 0.31,
      [EVENT_KIND.COUNTER_START]: chanceCreated ? 0.2 : 0.11,
      [EVENT_KIND.CORNER_WON]: goalScored ? 0.15 : 0.1,
      [EVENT_KIND.FOUL_WON]: goalScored ? 0.1 : 0.09,
      [EVENT_KIND.FREE_KICK]: goalScored ? 0.08 : 0.08,
      [EVENT_KIND.THROW_IN]: 0.09,
      [EVENT_KIND.POSSESSION_SWING]: possessionSwing ? 0.14 : 0.05,
      [EVENT_KIND.INTERCEPTION]: possessionSwing ? 0.1 : 0.03,
      [EVENT_KIND.TACKLE_WON]: possessionSwing ? 0.09 : 0.03,
    },
    rng.random
  );

const chooseSwingKind = (rng) =>
  makeDecision(
    {
      [EVENT_KIND.POSSESSION_SWING]: 0.34,
      [EVENT_KIND.TURNOVER]: 0.22,
      [EVENT_KIND.BAD_TOUCH]: 0.16,
      [EVENT_KIND.INTERCEPTION]: 0.16,
      [EVENT_KIND.TACKLE_WON]: 0.12,
    },
    rng.random
  );

const chooseNoGoalShotKind = (rng) =>
  makeDecision(
    {
      [EVENT_KIND.SHOT_SAVED]: 0.47,
      [EVENT_KIND.SHOT_BLOCKED]: 0.28,
      [EVENT_KIND.SHOT_WIDE]: 0.2,
      [EVENT_KIND.SHOT]: 0.05,
    },
    rng.random
  );

const renderControlledPhase = ({ teamName, actor, rng }) =>
  `${teamName} ${choose(CONTROL_OPENERS, rng)} through ${actor}.`;

const renderPossessionSwing = ({ winner, loser, rng }) =>
  `${choose(TRANSITION_OPENERS, rng)} - ${winner} takes it from ${loser}.`;

const renderBuildUp = ({ teamName, creator, shooter, rng }) =>
  `${teamName} build with intent. ${creator} ${choose(PASS_VERBS, rng)} into ${shooter}.`;

const renderCounterStart = ({ winner, creator, rng }) =>
  `${choose(TRANSITION_OPENERS, rng)}. ${winner} launches the counter through ${creator}.`;

const renderCornerWon = ({ teamName, attacker, defender, rng }) =>
  `${choose(CORNER_OPENERS, rng)} to ${teamName}. ${attacker} forces ${defender} to concede.`;

const renderFreeKick = ({ teamName, winner, marker }) =>
  `${winner} is clipped by ${marker}. Free kick to ${teamName}.`;

const renderThrowIn = ({ teamName, thrower, rng }) =>
  `Throw in to ${teamName}. ${thrower} ${choose(["takes it quickly", "goes short", "goes long", "restarts sharply"], rng)}.`;

const renderShotSaved = ({ shooter, keeper, xg, rng }) =>
  `${shooter} ${choose(SHOT_VERBS, rng)}... saved by ${keeper}! (xG ${xg})`;

const renderShotBlocked = ({ shooter, defender, xg, rng }) =>
  `${shooter} ${choose(SHOT_VERBS, rng)}, blocked by ${defender}. (xG ${xg})`;

const renderShotWide = ({ shooter, xg, rng }) =>
  `${shooter} ${choose(SHOT_VERBS, rng)} and flashes it wide. (xG ${xg})`;

const renderGoal = ({ scorer, creator, xg, score, rng }) =>
  `GOAL! ${scorer} ${choose(SHOT_VERBS, rng)} home from ${creator}'s pass. (xG ${xg}) ${score}`;

const renderKickOff = ({ teamName, rng }) =>
  `${teamName} ${choose(["restart from the center spot", "take the kick off", "get us underway again", "resume play from halfway"], rng)}.`;

export const createKickOffEvent = ({
  chunkIndex,
  minute,
  half = getHalfLabelFromMinute(minute),
  teamId,
  setup,
  scoreAfter,
  sequence = 0,
  rng,
}) =>
  buildEvent({
    chunkIndex,
    indexInChunk: sequence,
    minute,
    half,
    teamId,
    kind: EVENT_KIND.KICK_OFF,
    outcome: EVENT_OUTCOME.SUCCESS,
    scoreAfter,
    tags: ["restart"],
    text: renderKickOff({
      teamName: setup[teamId]?.name || (teamId === TEAM_KEY.A ? "Team A" : "Team B"),
      rng,
    }),
  });

const buildLeadInEvent = ({
  chunkIndex,
  minute,
  half,
  teamId,
  leadKind,
  teamName,
  scorer,
  creator,
  defender,
  dispossessed,
  scoreAfter,
  rng,
}) => {
  let text = renderBuildUp({
    teamName,
    creator: nameOf(creator),
    shooter: nameOf(scorer),
    rng,
  });
  if (leadKind === EVENT_KIND.COUNTER_START) {
    text = renderCounterStart({
      winner: nameOf(defender || creator || scorer),
      creator: nameOf(creator || scorer),
      rng,
    });
  } else if (leadKind === EVENT_KIND.CORNER_WON || leadKind === EVENT_KIND.CORNER_TAKEN) {
    text = renderCornerWon({
      teamName,
      attacker: nameOf(scorer || creator),
      defender: nameOf(defender),
      rng,
    });
  } else if (leadKind === EVENT_KIND.FREE_KICK || leadKind === EVENT_KIND.FOUL_WON) {
    text = renderFreeKick({
      teamName,
      winner: nameOf(scorer || creator),
      marker: nameOf(defender),
    });
  } else if (leadKind === EVENT_KIND.THROW_IN) {
    text = renderThrowIn({
      teamName,
      thrower: nameOf(creator || scorer),
      rng,
    });
  } else if (
    leadKind === EVENT_KIND.POSSESSION_SWING ||
    leadKind === EVENT_KIND.TURNOVER ||
    leadKind === EVENT_KIND.BAD_TOUCH ||
    leadKind === EVENT_KIND.INTERCEPTION ||
    leadKind === EVENT_KIND.TACKLE_WON
  ) {
    text = renderPossessionSwing({
      winner: nameOf(defender || creator || scorer),
      loser: nameOf(dispossessed),
      rng,
    });
  }

  return buildEvent({
    chunkIndex,
    indexInChunk: 0,
    minute,
    half,
    teamId,
    kind: leadKind,
    primaryPlayerId: (creator || scorer || defender)?.id,
    secondaryPlayerId: (defender || dispossessed)?.id,
    outcome: EVENT_OUTCOME.SUCCESS,
    scoreAfter,
    tags:
      leadKind === EVENT_KIND.CORNER_WON || leadKind === EVENT_KIND.CORNER_TAKEN || leadKind === EVENT_KIND.FREE_KICK || leadKind === EVENT_KIND.FOUL_WON
        ? ["setpiece"]
        : leadKind === EVENT_KIND.COUNTER_START
          ? ["counter", "transition"]
          : ["build"],
    text,
  });
};

const buildFinalChanceEvent = ({
  chunkIndex,
  indexInChunk,
  minute,
  half,
  teamId,
  finalKind,
  scorer,
  creator,
  defender,
  keeper,
  xg,
  scoreAfter,
  rng,
}) => {
  const xgLabel = xg.toFixed(2);

  let text = renderShotWide({
    shooter: nameOf(scorer),
    xg: xgLabel,
    rng,
  });
  if (finalKind === EVENT_KIND.SHOT_SAVED) {
    text = renderShotSaved({
      shooter: nameOf(scorer),
      keeper: nameOf(keeper),
      xg: xgLabel,
      rng,
    });
  } else if (finalKind === EVENT_KIND.SHOT_BLOCKED) {
    text = renderShotBlocked({
      shooter: nameOf(scorer),
      defender: nameOf(defender),
      xg: xgLabel,
      rng,
    });
  } else if (finalKind === EVENT_KIND.GOAL) {
    text = renderGoal({
      scorer: nameOf(scorer),
      creator: nameOf(creator),
      xg: xgLabel,
      score: scoreLabel(scoreAfter),
      rng,
    });
  }

  return buildEvent({
    chunkIndex,
    indexInChunk,
    minute,
    half,
    teamId,
    kind: finalKind,
    primaryPlayerId: scorer?.id,
    secondaryPlayerId:
      finalKind === EVENT_KIND.GOAL
        ? creator?.id
        : finalKind === EVENT_KIND.SHOT_SAVED
          ? keeper?.id
          : finalKind === EVENT_KIND.SHOT_BLOCKED
            ? defender?.id
            : creator?.id,
    xg,
    outcome:
      finalKind === EVENT_KIND.GOAL
        ? EVENT_OUTCOME.GOAL
        : finalKind === EVENT_KIND.SHOT_SAVED
          ? EVENT_OUTCOME.SAVED
          : finalKind === EVENT_KIND.SHOT_BLOCKED
            ? EVENT_OUTCOME.BLOCKED
            : EVENT_OUTCOME.WIDE,
    scoreAfter,
    tags: finalKind === EVENT_KIND.GOAL ? ["goal", "shot"] : ["shot"],
    text,
  });
};

export const generateChunkEvents = ({
  context,
  chunkIndex,
  half,
  minuteStart,
  minuteEnd,
  possessionTeamId,
  defendingTeamId,
  possessionSwing,
  chanceCreated,
  xg,
  goalScored,
  goalScorerId,
  scoreAfter,
}) => {
  const rng = context.rng;
  const events = [];

  const attackPlayers = getTeamPlayers(context, possessionTeamId);
  const defensePlayers = getTeamPlayers(context, defendingTeamId);
  const teamName = context.setup[possessionTeamId].name;

  // Goal scorer must stay aligned with sim result when goalScorerId exists.
  const scorer =
    goalScored && goalScorerId
      ? context.playersById[goalScorerId] || pickShooter(attackPlayers, rng)
      : pickShooter(attackPlayers, rng);
  const creator = pickCreator(attackPlayers, rng, scorer?.id) || pickRandomDifferentPlayer(attackPlayers, rng, scorer?.id);
  const defender = pickDefender(defensePlayers, rng);
  const keeper = pickGK(defensePlayers);
  const dispossessed = pickRandomDifferentPlayer(defensePlayers, rng, defender?.id);

  const twoEventProbability = goalScored ? 0.79 : chanceCreated ? 0.58 : 0.34;
  const hasTwoEvents = rng.random() < twoEventProbability;

  if (chanceCreated) {
    const leadKind = hasTwoEvents ? chooseLeadInKind({ chanceCreated, goalScored, possessionSwing, rng }) : null;
    if (leadKind) {
      events.push(
        buildLeadInEvent({
          chunkIndex,
          minute: minuteStart,
          half,
          teamId: possessionTeamId,
          leadKind,
          teamName,
          scorer,
          creator,
          defender,
          dispossessed,
          scoreAfter,
          rng,
        })
      );
    }

    const finalKind = goalScored ? EVENT_KIND.GOAL : chooseNoGoalShotKind(rng);
    events.push(
      buildFinalChanceEvent({
        chunkIndex,
        indexInChunk: events.length,
        minute: leadKind ? minuteEnd : minuteStart,
        half,
        teamId: possessionTeamId,
        finalKind,
        scorer,
        creator,
        defender,
        keeper,
        xg,
        scoreAfter,
        rng,
      })
    );
    return events;
  }

  if (possessionSwing) {
    const swingKind = chooseSwingKind(rng);
    events.push(
      buildEvent({
        chunkIndex,
        indexInChunk: 0,
        minute: minuteStart,
        half,
        teamId: possessionTeamId,
        kind: swingKind,
        primaryPlayerId: (defender || creator || scorer)?.id,
        secondaryPlayerId: dispossessed?.id,
        outcome: EVENT_OUTCOME.SUCCESS,
        scoreAfter,
        tags: ["transition"],
        text: renderPossessionSwing({
          winner: nameOf(defender || creator || scorer),
          loser: nameOf(dispossessed),
          rng,
        }),
      })
    );
    if (hasTwoEvents) {
      events.push(
        buildEvent({
          chunkIndex,
          indexInChunk: 1,
          minute: minuteEnd,
          half,
          teamId: possessionTeamId,
          kind: EVENT_KIND.CONTROLLED_PHASE,
          primaryPlayerId: (creator || scorer || defender)?.id,
          outcome: EVENT_OUTCOME.SUCCESS,
          scoreAfter,
          tags: ["control"],
          text: renderControlledPhase({
            teamName,
            actor: nameOf(creator || scorer || defender),
            rng,
          }),
        })
      );
    }
    return events;
  }

  if (hasTwoEvents) {
    const leadKind = makeDecision(
      {
        [EVENT_KIND.BUILD_UP]: 0.44,
        [EVENT_KIND.THROW_IN]: 0.22,
        [EVENT_KIND.COUNTER_START]: 0.14,
        [EVENT_KIND.CORNER_TAKEN]: 0.11,
        [EVENT_KIND.FREE_KICK]: 0.09,
      },
      rng.random
    );

    events.push(
      buildLeadInEvent({
        chunkIndex,
        minute: minuteStart,
        half,
        teamId: possessionTeamId,
        leadKind,
        teamName,
        scorer,
        creator,
        defender,
        dispossessed,
        scoreAfter,
        rng,
      })
    );
    events.push(
      buildEvent({
        chunkIndex,
        indexInChunk: 1,
        minute: minuteEnd,
        half,
        teamId: possessionTeamId,
        kind: EVENT_KIND.CONTROLLED_PHASE,
        primaryPlayerId: (creator || scorer || defender)?.id,
        outcome: EVENT_OUTCOME.SUCCESS,
        scoreAfter,
        tags: ["control"],
        text: renderControlledPhase({
          teamName,
          actor: nameOf(creator || scorer || defender),
          rng,
        }),
      })
    );
    return events;
  }

  events.push(
    buildEvent({
      chunkIndex,
      indexInChunk: 0,
      minute: minuteStart,
      half,
      teamId: possessionTeamId,
      kind: EVENT_KIND.CONTROLLED_PHASE,
      primaryPlayerId: (creator || scorer || defender)?.id,
      outcome: EVENT_OUTCOME.SUCCESS,
      scoreAfter,
      tags: ["control"],
      text: renderControlledPhase({
        teamName,
        actor: nameOf(creator || scorer || defender),
        rng,
      }),
    })
  );

  return events;
};
