import React from 'react';
import {createRoot} from 'react-dom/client';
import {LiveOverlay} from './components/live-overlay';
import './app/globals.css';
createRoot(document.getElementById('root')!).render(<LiveOverlay/>);
