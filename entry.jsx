/* Build entry point — mounts the app.
   The whole game lives in qudrat-quest.tsx (single source of truth).
   `node build.mjs` bundles this and splices the result into index.html. */
import { createRoot } from "react-dom/client";
import AppRoot from "./qudrat-quest.tsx";

createRoot(document.getElementById("root")).render(<AppRoot />);
