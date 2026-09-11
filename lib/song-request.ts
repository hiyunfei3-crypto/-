import type { Song } from './songs';
import { community } from './community';

export const requestText = (song: Song) => `点歌 ${song.title}`;

export async function copySongRequest(song: Song, clipboard?: { writeText(text: string): Promise<void> }): Promise<boolean> {
 if (!clipboard) return false;
 try { await clipboard.writeText(requestText(song)); void community('copy',{song:song.id,event:crypto.randomUUID()}).catch(()=>{ window.dispatchEvent(new Event('song-count-failed')); }); return true; } catch { return false; }
}
