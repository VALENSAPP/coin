import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { normalTheme, businessTheme } from "./theme";
import { useSelector } from "react-redux";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const userProfile = useSelector(state => state.userProfile.userProfile);
  const [theme, setTheme] = useState(normalTheme);

  // React to userProfile changes from Redux
  useEffect(() => {
    if (userProfile === "company") {
      setTheme(businessTheme);
    } else {
      setTheme(normalTheme);
    }
  }, [userProfile]);

  // Call this when user switches profile manually (stable reference to avoid consumer re-renders)
  const switchTheme = useCallback((profileType) => {
    if (profileType === "company") setTheme(businessTheme);
    else setTheme(normalTheme);
  }, []);

  const contextValue = useMemo(
    () => ({ theme, switchTheme }),
    [theme, switchTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);