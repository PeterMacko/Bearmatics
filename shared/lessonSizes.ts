// Lesson sizes, for the app's menus and the server's check of a started lesson.

/** Exercise counts a child can choose for a lesson. */
export const SESSION_SIZES = [5, 10, 20] as const;

/** SCRUM-324: Pexeso pictures (pairs) per game; a Pexeso lesson saves its pair count as the size. */
export const PEXESO_PAIR_COUNTS = [6, 10, 15] as const;
