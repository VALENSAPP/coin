import React, { createContext, useContext, useState, useEffect } from "react";
import { normalTheme, businessTheme } from "./theme";
import { useSelector } from "react-redux";

const ThemeContext = createContext();

export const ThemeProvider = ({ children, activeProfile}) => {
  const userProfile = useSelector(state => state.userProfile.userProfile);
  const [theme, setTheme] = useState(
    activeProfile === "company" ? businessTheme : normalTheme
  );

  // Call this when user switches profile
  const switchTheme = (profileType) => {
    if (profileType === "company") setTheme(businessTheme);
    else setTheme(normalTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, switchTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);