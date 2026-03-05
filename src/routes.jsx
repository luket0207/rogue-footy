import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Home from "./game/home/home";
import Info from "./game/info/info";
import StartCareer from "./game/career/startCareer/startCareer";
import CareerLoading from "./game/career/loading/careerLoading";
import CareerCalendar from "./game/career/calendar/careerCalendar";
import CareerCupDraw from "./game/career/cupDraw/careerCupDraw";
import CareerPreMatch from "./game/career/preMatch/careerPreMatch";
import CareerMatchSummary from "./game/career/matchSummary/careerMatchSummary";
import CareerTeamManagement from "./game/career/teamManagement/careerTeamManagement";
import CareerStaff from "./game/career/staff/careerStaff";
import TeamSelection from "./features/matchSim/components/teamSelection";
import Match from "./features/matchSim/components/match";
import { useGame } from "./engine/gameContext/gameContext";

const NotFound = () => <div>404</div>;

const isDebugPath = (pathname) =>
  pathname === "/team-selection" || pathname === "/match" || pathname === "/match-sim";

const CareerRouteGuard = ({ children }) => {
  const location = useLocation();
  const { gameState, setGameValue } = useGame();
  const isCareerPath = location.pathname.startsWith("/career");
  const inCareerMode = gameState.mode === "career";
  const hasActiveCareerMatch =
    gameState?.match?.pendingConfig?.meta?.source === "career" ||
    !!gameState?.match?.activeCareerMatch ||
    !!gameState?.match?.lastCareerMatchResult;

  useEffect(() => {
    // Keep career mode stable on refresh for career routes.
    if (isCareerPath && !inCareerMode) {
      setGameValue("mode", "career");
    }
  }, [inCareerMode, isCareerPath, setGameValue]);

  if (inCareerMode && isDebugPath(location.pathname)) {
    if (location.pathname === "/match" && hasActiveCareerMatch) {
      return children;
    }
    return <Navigate to="/career/start" replace />;
  }

  return children;
};

export default function AppRoutes() {
  return (
    <CareerRouteGuard>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/career/start" element={<StartCareer />} />
        <Route path="/career/loading" element={<CareerLoading />} />
        <Route path="/career/calendar" element={<CareerCalendar />} />
        <Route path="/career/cup-draw" element={<CareerCupDraw />} />
        <Route path="/career/pre-match" element={<CareerPreMatch />} />
        <Route path="/career/match-summary" element={<CareerMatchSummary />} />
        <Route path="/career/team-management" element={<CareerTeamManagement />} />
        <Route path="/career/staff" element={<CareerStaff />} />
        <Route path="/info" element={<Info />} />
        <Route path="/team-selection" element={<TeamSelection />} />
        <Route path="/match" element={<Match />} />
        <Route path="/match-sim" element={<Navigate to="/team-selection" replace />} />

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </CareerRouteGuard>
  );
}
