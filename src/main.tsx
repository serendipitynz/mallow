import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './lib/i18n';
import './styles/global.scss';
import './styles/app.scss';
import './styles/markdown.scss';
import './styles/config.scss';
import './styles/source.scss';
import './styles/table.scss';

// No StrictMode: the viewer runs imperative DOM work (mermaid / outline / code
// copy) in effects, and StrictMode's double-invoke in dev would render twice.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
