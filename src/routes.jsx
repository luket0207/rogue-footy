import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./game/home/home";
import Info from "./game/info/info";
import TeamSelection from "./features/matchSim/components/teamSelection";
import Match from "./features/matchSim/components/match";

const NotFound = () => <div>404</div>;

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/info" element={<Info />} />
      <Route path="/team-selection" element={<TeamSelection />} />
      <Route path="/match" element={<Match />} />
      <Route path="/match-sim" element={<Navigate to="/team-selection" replace />} />

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
