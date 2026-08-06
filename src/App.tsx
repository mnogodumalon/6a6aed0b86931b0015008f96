import '@/lib/sentry';
import '@/lib/stale-bundle';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
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
const NeuesUnternehmenPage = lazy(() => import('@/pages/intents/NeuesUnternehmenPage'));
const ReviewTerminPage = lazy(() => import('@/pages/intents/ReviewTerminPage'));
// </custom:imports>

// Lazy: public pages live outside <Layout> and only load on /#/public/:slug —
// dashboard users never pay for them, anonymous visitors skip the dashboard.
const PublicPage = lazy(() => import('@/pages/public/PublicPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
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
                <Route path="intents/neues-unternehmen" element={<Suspense fallback={null}><NeuesUnternehmenPage /></Suspense>} />
                <Route path="intents/review-termin" element={<Suspense fallback={null}><ReviewTerminPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
