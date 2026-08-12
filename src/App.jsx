import { useState } from "react";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import HomePage from "./pages/HomePage.jsx";
import LessonsPage from "./pages/LessonsPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";

export default function App() {
  const [page, setPage] = useState("home");

  return (
    <>
      <Header page={page} onNavigate={setPage} />

      <main id="app">
        {page === "home" && <HomePage onNavigate={setPage} />}
        {page === "lessons" && <LessonsPage />}
        {page === "about" && <AboutPage onNavigate={setPage} />}
        {page === "contact" && <ContactPage />}
      </main>

      <Footer onNavigate={setPage} />
    </>
  );
}
