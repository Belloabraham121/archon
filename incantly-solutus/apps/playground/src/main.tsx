import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const NoteDemo = lazy(() => import("./NoteDemo.js").then((module) => ({ default: module.NoteDemo })));

createRoot(document.getElementById("root")!).render(<StrictMode>{window.location.pathname === "/note-demo" ? <Suspense fallback={<p>Loading note test mode…</p>}><NoteDemo /></Suspense> : <App />}</StrictMode>);
