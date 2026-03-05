export const SEASON_MONTH_COUNT = 2;
export const WEEKS_PER_MONTH = 4;
export const DAYS_PER_WEEK = 7;
export const TOTAL_SEASON_DAYS = SEASON_MONTH_COUNT * WEEKS_PER_MONTH * DAYS_PER_WEEK;

const DAY_NAMES = Object.freeze(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

const isValidSeasonModel = (season) =>
  season &&
  typeof season === "object" &&
  season.totalDays === TOTAL_SEASON_DAYS &&
  Array.isArray(season.months) &&
  season.months.length === SEASON_MONTH_COUNT &&
  Array.isArray(season.days) &&
  season.days.length === TOTAL_SEASON_DAYS;

export const createSeasonModel = ({ seasonNumber = 1 } = {}) => {
  const months = [];
  const days = [];
  let absoluteDay = 1;
  let weekOfSeason = 1;

  for (let monthIndex = 1; monthIndex <= SEASON_MONTH_COUNT; monthIndex += 1) {
    const weeks = [];

    for (let weekOfMonth = 1; weekOfMonth <= WEEKS_PER_MONTH; weekOfMonth += 1) {
      const weekDays = [];

      for (let dayOfWeek = 1; dayOfWeek <= DAYS_PER_WEEK; dayOfWeek += 1) {
        const dayName = DAY_NAMES[dayOfWeek - 1];
        const day = {
          id: `season_${seasonNumber}_day_${String(absoluteDay).padStart(2, "0")}`,
          dayNumber: absoluteDay,
          monthIndex,
          monthDay: (weekOfMonth - 1) * DAYS_PER_WEEK + dayOfWeek,
          weekOfMonth,
          weekOfSeason,
          dayOfWeek,
          dayName,
          isWeekend: dayName === "Sat" || dayName === "Sun",
        };

        weekDays.push(day);
        days.push(day);
        absoluteDay += 1;
      }

      weeks.push({
        id: `season_${seasonNumber}_month_${monthIndex}_week_${weekOfMonth}`,
        weekOfMonth,
        weekOfSeason,
        days: weekDays,
      });
      weekOfSeason += 1;
    }

    months.push({
      id: `season_${seasonNumber}_month_${monthIndex}`,
      monthIndex,
      name: `Month ${monthIndex}`,
      weeks,
    });
  }

  return {
    seasonNumber,
    totalDays: TOTAL_SEASON_DAYS,
    months,
    days,
    currentDay: 1,
    completedDayIds: [],
  };
};

export const ensureSeasonModel = (season, options = {}) =>
  isValidSeasonModel(season) ? season : createSeasonModel(options);

