import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { seedInitialData } from './db';
import { syncService } from './services/syncService';

// Bootstrap local database seeds & offline sync engine
seedInitialData().catch(console.error);
syncService.init().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
