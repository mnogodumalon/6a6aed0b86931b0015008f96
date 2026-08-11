import '@/lib/sentry';
import '@/lib/stale-bundle';
import { Fragment, lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { locale, onLocaleChange, syncProfileLocale } from '@/i18n';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import PublicPagesAdmin from '@/pages/PublicPagesAdmin';
import UnternehmenPage from '@/pages/UnternehmenPage';
import UnternehmenDetailPage from '@/pages/UnternehmenDetailPage';
import TerminePage from '@/pages/TerminePage';
import TermineDetailPage from '@/pages/TermineDetailPage';
import DokumentePage from '@/pages/DokumentePage';
import DokumenteDetailPage from '@/pages/DokumenteDetailPage';
import NotizenPage from '@/pages/NotizenPage';
import NotizenDetailPage from '@/pages/NotizenDetailPage';
// <custom:imports>
const NeueBeteiligungPage = lazy(() => import('@/pages/intents/NeueBeteiligungPage'));
const TerminNachbereitenPage = lazy(() => import('@/pages/intents/TerminNachbereitenPage'));
// </custom:imports>

// Lazy: public pages live outside <Layout> and only load on /#/public/:slug —
// dashboard users never pay for them, anonymous visitors skip the dashboard.
const PublicPage = lazy(() => import('@/pages/public/PublicPage'));

// Language switch = full remount below the router: every t()/label lookup
// re-evaluates, the la-* widgets re-read <html lang>. Sits INSIDE
// ActionsProvider so chat/drawer state survives a switch, and inside
// HashRouter so the current route survives (it re-reads the URL hash).
function LocaleGate({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState(locale);
  useEffect(() => onLocaleChange(() => setCurrent(locale)), []);
  // Adopt the LA profile language (SSOT) — but never on public routes,
  // where the visitor's browser language governs (initPublicLocale).
  useEffect(() => {
    if (!window.location.hash.startsWith('#/public')) void syncProfileLocale();
  }, []);
  return <Fragment key={current}>{children}</Fragment>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <LocaleGate>
            <Routes>
              <Route path="public/:slug" element={<Suspense fallback={null}><PublicPage /></Suspense>} />
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="unternehmen" element={<UnternehmenPage />} />
                <Route path="unternehmen/:id" element={<UnternehmenDetailPage />} />
                <Route path="termine" element={<TerminePage />} />
                <Route path="termine/:id" element={<TermineDetailPage />} />
                <Route path="dokumente" element={<DokumentePage />} />
                <Route path="dokumente/:id" element={<DokumenteDetailPage />} />
                <Route path="notizen" element={<NotizenPage />} />
                <Route path="notizen/:id" element={<NotizenDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="verwaltung/oeffentliche-seiten" element={<PublicPagesAdmin />} />
                {/* <custom:routes> */}
                <Route path="intents/neue-beteiligung" element={<Suspense fallback={null}><NeueBeteiligungPage /></Suspense>} />
                <Route path="intents/termin-nachbereiten" element={<Suspense fallback={null}><TerminNachbereitenPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
            </LocaleGate>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
