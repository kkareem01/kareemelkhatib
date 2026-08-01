/** File vault route table (all session-gated). */

import { requireSession } from "../auth/middleware";
import type { Router } from "../router";
import { getFileContent, getFileMeta } from "./content";
import { listFiles } from "./list";
import { deleteFile, updateFile } from "./manage";
import { uploadFile } from "./upload";

export function registerFileRoutes(router: Router): void {
  router.add("GET", "/api/files", requireSession(listFiles));
  router.add("POST", "/api/files", requireSession(uploadFile));
  router.add("GET", "/api/files/:id", requireSession(getFileMeta));
  router.add("GET", "/api/files/:id/content", requireSession(getFileContent));
  router.add("PATCH", "/api/files/:id", requireSession(updateFile));
  router.add("DELETE", "/api/files/:id", requireSession(deleteFile));
}
