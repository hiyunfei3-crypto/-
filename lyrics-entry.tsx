import React from 'react';
import {createRoot} from 'react-dom/client';
import {LyricsOverlay} from './components/live-lyrics';
import './app/globals.css';
createRoot(document.getElementById('root')!).render(<LyricsOverlay/>);
