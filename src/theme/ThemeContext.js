import React, { createContext, useContext, useState, useEffect } from "react";
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

  // Call this when user switches profile manually
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