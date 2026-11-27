import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyThemeMode, getStoredThemeMode } from './utils/themeUtils';

applyThemeMode(getStoredThemeMode());

createRoot(document.getElementById('root')!).render(<App />);
