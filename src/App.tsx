import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CompareProvider } from "./context/CompareContext";
import { Header } from "./components/Header";
import { FeedPage } from "./pages/FeedPage";
import { ComparePage } from "./pages/ComparePage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { DigestPage } from "./pages/DigestPage";
import { NotesPage } from "./pages/NotesPage";
import { WatchesPage } from "./pages/WatchesPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <AuthProvider>
      <CompareProvider>
        <BrowserRouter>
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<FeedPage />} />
              <Route path="/vergleich" element={<ComparePage />} />
              <Route path="/merkliste" element={<FavoritesPage />} />
              <Route path="/digest" element={<DigestPage />} />
              <Route path="/notizen" element={<NotesPage />} />
              <Route path="/beobachtungen" element={<WatchesPage />} />
              <Route path="/einstellungen" element={<SettingsPage />} />
            </Routes>
          </main>
        </BrowserRouter>
      </CompareProvider>
    </AuthProvider>
  );
}
