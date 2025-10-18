import { createContext, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Create a simple context if needed (optional)
export const Context = createContext({});

const AppWrapper = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <Context.Provider value={{ isAuthenticated, setIsAuthenticated }}>
      <App />
    </Context.Provider>
  );
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppWrapper />
  </StrictMode>
);
