import type { Song } from './songs';

export const requestText = (song: Song) => `${song.id}、${song.title}`;

export async function copySongRequest(song: Song, clipboard?: { writeText(text: string): Promise<void> }): Promise<boolean> {
 if (!clipboard) return false;
 try { await clipboard.writeText(requestText(song)); return true; } catch { return false; }
}
