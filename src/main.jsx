import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { isNative } from "./api.js";
import "./styles.css";

// In the desktop shell the app fills the window instead of the web "fake window".
if (isNative) document.body.classList.add("is-desktop");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
