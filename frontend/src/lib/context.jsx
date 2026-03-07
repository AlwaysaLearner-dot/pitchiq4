import { createContext, useContext, useState } from "react";

export const FILLERS = [
  "um","uh","like","you know","basically","literally",
  "right","so","okay","actually","i mean","kind of",
  "sort of","just","well","anyway",
];

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [slides,        setSlides]        = useState([]);
  const [presenterName, setPresenterName] = useState("");
  const [sessionSec,    setSessionSec]    = useState(600);
  const [report,        setReport]        = useState(null);

  return (
    <Ctx.Provider value={{
      slides, setSlides,
      presenterName, setPresenterName,
      sessionSec, setSessionSec,
      report, setReport,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
};
