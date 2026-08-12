import { createRoot } from 'react-dom/client';

import '@/index.css';
import { App } from '@/app';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element');
}
createRoot(rootElement).render(<App />);
