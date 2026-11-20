import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { aboutRoute } from './about/aboutRoute';
import { takeStartLanguage } from './startLanguage';
import './styles/index.css';
const root = createRoot(document.getElementById('root')!);
// SCRUM-218: /about[/sk|/en] is the About page, loaded on demand so the app does not grow.
const about = aboutRoute(location.pathname, navigator.languages ?? [navigator.language]);
if (about)
  void import('./about/AboutPage').then(({ default: AboutPage }) =>
    root.render(
      <StrictMode>
        <AboutPage language={about.language} />
      </StrictMode>,
    ),
  );
else
  root.render(
    <StrictMode>
      <App startLanguage={takeStartLanguage() ?? 'en'} />
    </StrictMode>,
  );
