import React from "react";
import ReactDOM from "react-dom/client";
import { AdminApp } from "./App";
import "./admin.css";

ReactDOM.createRoot(document.getElementById("admin-root")!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>,
);
