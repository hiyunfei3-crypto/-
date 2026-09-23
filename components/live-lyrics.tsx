'use client';
import {useEffect,useMemo,useState} from 'react';
import {hostLyrics,type LyricSnapshot} from '@/lib/host-helper';

export function useLiveLyrics(){
 const [lyrics,setLyrics]=useState<LyricSnapshot|null>(null),[connected,setConnected]=useState(false);
 useEffect(()=>{const params=new URLSearchParams(location.hash.replace(/^#/,'')),token=params.get('token')||'';if(!token)return;let mounted=true;const refresh=async()=>{try{const next=await hostLyrics(token);if(mounted){setLyrics(next?.available?next:null);setConnected(true)}}catch{if(mounted){setLyrics(null);setConnected(false)}}};const resume=()=>{if(!document.hidden)void refresh()};void refresh();const timer=setInterval(()=>void refresh(),500);window.addEventListener('focus',resume);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);return()=>{mounted=false;clearInterval(timer);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume)}},[]);
 return {lyrics,connected};
}

export function LyricLines({lyrics,standalone=false}:{lyrics:LyricSnapshot;standalone?:boolean}){
 const offset=typeof window==='undefined'?200:Number(new URLSearchParams(location.search).get('offset')||200);
 const activeWord=useMemo(()=>{if(!lyrics.words.length||lyrics.positionMs===null)return -1;const now=lyrics.positionMs+offset;return lyrics.words.findIndex(word=>now>=word.startMs&&now<word.startMs+Math.max(100,word.durationMs))},[lyrics,offset]);
 return <div className={'live-lyrics-lines'+(standalone?' standalone':'')} aria-live="polite"><div className="live-lyric-current">{lyrics.words.length?lyrics.words.map((word,index)=><span key={`${index}-${word.text}`} className={index<=activeWord?'sung':''}>{word.text}</span>):lyrics.currentLine}</div>{lyrics.nextLine&&<div className="live-lyric-next">{lyrics.nextLine}</div>}</div>;
}

export function LyricsOverlay(){
 const {lyrics}=useLiveLyrics();
 const [theme,setTheme]=useState('liquid'),[color,setColor]=useState('lime');
 useEffect(()=>{document.documentElement.classList.add('overlay-page');document.body.classList.add('overlay-page');const p=new URLSearchParams(location.search);setTheme(p.get('theme')||'liquid');setColor(p.get('color')||'lime');return()=>{document.documentElement.classList.remove('overlay-page');document.body.classList.remove('overlay-page')}},[]);
 return <main className={`lyrics-overlay live-overlay-${theme} live-overlay-color-${color}`}>{lyrics&&<><div className="lyrics-song-meta">{lyrics.title}{lyrics.artist?` · ${lyrics.artist}`:''}</div><LyricLines lyrics={lyrics} standalone/></>}</main>;
}
