import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import PrivateRoute from "./components/PrivateRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LessonsPage from "./pages/LessonsPage";
import PracticePage from "./pages/PracticePage";
import GamePage from "./pages/GamePage";
import FinalChallengePage from "./pages/FinalChallengePage";
import SettingsPage from "./pages/SettingsPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<Navigate to="/lessons" replace />} />
            <Route path="/lessons" element={<LessonsPage />} />
            <Route path="/practice/:unitId/:stepId" element={<PracticePage />} />
            <Route path="/challenge/:unitId" element={<FinalChallengePage />} />
            <Route path="/game" element={<GamePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/dashboard" element={<Navigate to="/lessons" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
