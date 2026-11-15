// Browser side of the points API (SCRUM-117). Only for signed-in players.
import { call } from '../account/api';

export const loadPoints = () => call<{ points: number }>('/api/progress').then((r) => r.points);
export const startLesson = (size: number) =>
  call<{ lessonId: string }>('/api/progress/lessons', 'POST', { size }).then((r) => r.lessonId);
export const finishLesson = (lessonId: string, size: number, points: number) =>
  call<{ points: number; added: number }>('/api/progress/lessons/finish', 'POST', {
    lessonId,
    size,
    points,
  });
