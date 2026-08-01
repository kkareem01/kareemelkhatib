/** Notes + clipboard route table (all session-gated). */

import { requireSession } from "../auth/middleware";
import type { Router } from "../router";
import { getClipboard, putClipboard } from "./clipboard";
import { createNote, deleteNote, getNote, listNotes, updateNote } from "./notes";

export function registerNoteRoutes(router: Router): void {
  router.add("GET", "/api/notes", requireSession(listNotes));
  router.add("POST", "/api/notes", requireSession(createNote));
  router.add("GET", "/api/notes/:id", requireSession(getNote));
  router.add("PUT", "/api/notes/:id", requireSession(updateNote));
  router.add("DELETE", "/api/notes/:id", requireSession(deleteNote));
  router.add("GET", "/api/clipboard", requireSession(getClipboard));
  router.add("PUT", "/api/clipboard", requireSession(putClipboard));
}
