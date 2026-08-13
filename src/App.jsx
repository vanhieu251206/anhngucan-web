import { useState } from "react";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import ModelPreloader from "./components/ModelPreloader.jsx";
import HomePage from "./pages/HomePage.jsx";
import LessonsPage from "./pages/LessonsPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import { useAuth } from "./lib/authContext.jsx";

export default function App() {
  const [page, setPage] = useState("home");
  const { isStaff } = useAuth();

  // Khu vực quản trị (dashboard) có layout TÁCH BIỆT hoàn toàn khỏi web công khai — không
  // bọc Header/Footer, giống cách SceneRunner render fullscreen riêng trong LessonsPage.jsx.
  if (page === "dashboard" && isStaff) {
    return <DashboardPage onNavigate={setPage} />;
  }

  return (
    <>
      <Header page={page} onNavigate={setPage} />

      <main id="app">
        {page === "home" && <HomePage onNavigate={setPage} />}
        {page === "lessons" && <LessonsPage />}
        {page === "about" && <AboutPage onNavigate={setPage} />}
        {page === "contact" && <ContactPage />}
        {page === "login" && <LoginPage onNavigate={setPage} />}
        {page === "settings" && isStaff && <SettingsPage />}
      </main>

      <Footer onNavigate={setPage} />
      <ModelPreloader />
    </>
  );
}
