/**
 * Side Panel 入口。
 *
 * 挂载 React 应用到 #root。
 */

import React from "react";
import { createRoot } from "react-dom/client";
import App from "@/sidepanel/App.tsx";
import "./styles.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("找不到 #root 容器");
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
