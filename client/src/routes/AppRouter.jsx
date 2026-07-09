import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// Routing/gate/layout components stay eager — they are small and decide what to
// render on every navigation. Page components are code-split (below) so a
// citizen on a slow connection never downloads the admin/police/supervisor
// bundles just to open the map.
import RouteErrorBoundary from "../components/common/RouteErrorBoundary";
import PageLoader from "../components/common/PageLoader";
import AdminLayout from "../components/layout/AdminLayout";
import DefaultRouteRedirect from "./DefaultRouteRedirect";
import NonAdminOnlyRoute from "./NonAdminOnlyRoute";
import ProtectedRoute from "./ProtectedRoute";
import PublicOnlyRoute from "./PublicOnlyRoute";
import PoliceAccessGate from "../components/police/PoliceAccessGate";

// ── Lazily-loaded route pages (each becomes its own chunk) ──────────────────
const DashboardPage = lazy(() => import("../pages/admin/DashboardPage"));
const ServiceControlPage = lazy(() => import("../pages/admin/ServiceControlPage"));
const AdminOverviewPage = lazy(() => import("../pages/admin/AdminOverviewPage"));
const AdminIncidentsPage = lazy(() => import("../pages/admin/AdminIncidentsPage"));
const AdminIncidentReviewPage = lazy(() => import("../pages/admin/AdminIncidentReviewPage"));
const AdminAlertsPage = lazy(() => import("../pages/admin/AdminAlertsPage"));
const AdminAIMonitoringPage = lazy(() => import("../pages/admin/AdminAIMonitoringPage"));
const AdminUsersPage = lazy(() => import("../pages/admin/AdminUsersPage"));
const AdminZonesPage = lazy(() => import("../pages/admin/AdminZonesPage"));
const AdminSystemSettingsPage = lazy(() => import("../pages/admin/AdminSystemSettingsPage"));
const AdminAnalyticsPage = lazy(() => import("../pages/admin/AdminAnalyticsPage"));
const AdminInboxPage = lazy(() => import("../pages/admin/AdminInboxPage"));
const CreateAlertPage = lazy(() => import("../pages/user/CreateAlertPage"));
const AlertsPage = lazy(() => import("../pages/user/AlertsPage"));
const ContactPage = lazy(() => import("../pages/user/ContactPage"));
const HomePage = lazy(() => import("../pages/user/HomePage"));
const IncidentDetailPage = lazy(() => import("../pages/user/IncidentDetailPage"));
const MapPage = lazy(() => import("../pages/user/MapPage"));
const NewsPage = lazy(() => import("../pages/user/NewsPage"));
const NotificationsPage = lazy(() => import("../pages/user/NotificationsPage"));
const PredictionsPage = lazy(() => import("../pages/user/PredictionsPage"));
const PoliceAlertCenterPage = lazy(() => import("../pages/police/PoliceAlertCenterPage"));
const PolicePage = lazy(() => import("../pages/police/PolicePage"));
const PoliceAIInsightsPage = lazy(() => import("../pages/police/PoliceAIInsightsPage"));
const PoliceAssignedIncidentsPage = lazy(() => import("../pages/police/PoliceAssignedIncidentsPage"));
const PoliceFieldReportsPage = lazy(() => import("../pages/police/PoliceFieldReportsPage"));
const PoliceIncidentDetailPage = lazy(() => import("../pages/police/PoliceIncidentDetailPage"));
const PoliceMyIncidentsPage = lazy(() => import("../pages/police/PoliceMyIncidentsPage"));
const PoliceNearbyIncidentsPage = lazy(() => import("../pages/police/PoliceNearbyIncidentsPage"));
const PoliceOperationHistoryPage = lazy(() => import("../pages/police/PoliceOperationHistoryPage"));
const PoliceVerificationQueuePage = lazy(() => import("../pages/police/PoliceVerificationQueuePage"));
const PoliceWorkZoneSetupPage = lazy(() => import("../pages/police/PoliceWorkZoneSetupPage"));
const PolicePriorityQueuePage = lazy(() => import("../pages/police/PolicePriorityQueuePage"));
const SupervisorDashboardPage = lazy(() => import("../pages/supervisor/SupervisorDashboardPage"));
const SupervisorIncidentCoordinationPage = lazy(() => import("../pages/supervisor/SupervisorIncidentCoordinationPage"));
const SupervisorOfficerMonitoringPage = lazy(() => import("../pages/supervisor/SupervisorOfficerMonitoringPage"));
const SupervisorAlertCenterPage = lazy(() => import("../pages/supervisor/SupervisorAlertCenterPage"));
const SupervisorAnalyticsPage = lazy(() => import("../pages/supervisor/SupervisorAnalyticsPage"));
const SupervisorOperationsMapPage = lazy(() => import("../pages/supervisor/SupervisorOperationsMapPage"));
const SupervisorPilotDashboardPage = lazy(() => import("../pages/supervisor/SupervisorPilotDashboardPage"));
const SupervisorInterventionsPage = lazy(() => import("../pages/supervisor/SupervisorInterventionsPage"));
const ProfilePage = lazy(() => import("../pages/user/ProfilePage"));
const ReportIncidentPage = lazy(() => import("../pages/user/ReportIncidentPage"));
const ReportsPage = lazy(() => import("../pages/user/ReportsPage"));
const SettingsPage = lazy(() => import("../pages/user/SettingsPage"));
const UserDashboardPage = lazy(() => import("../pages/user/UserDashboardPage"));
const DangerSubscriptionsPage = lazy(() => import("../pages/user/DangerSubscriptionsPage"));
const RoadProfilePage = lazy(() => import("../pages/user/RoadProfilePage"));
const AboutPage = lazy(() => import("../pages/shared/AboutPage"));
const DescriptionPage = lazy(() => import("../pages/shared/DescriptionPage"));
const ForgotPasswordPage = lazy(() => import("../pages/shared/ForgotPasswordPage"));
const LoginPage = lazy(() => import("../pages/shared/LoginPage"));
const RegisterPage = lazy(() => import("../pages/shared/RegisterPage"));
const VerifyEmailPage = lazy(() => import("../pages/shared/VerifyEmailPage"));
const NavigationPreviewPage = lazy(() => import("../pages/preview/NavigationPreviewPage"));
const RouteExplanationPreviewPage = lazy(() => import("../pages/preview/RouteExplanationPreviewPage"));
const EmergencyDashboardPage = lazy(() => import("../pages/emergency/EmergencyDashboardPage"));
const EmergencyAssignedPage = lazy(() => import("../pages/emergency/EmergencyAssignedPage"));
const EmergencyMapPage = lazy(() => import("../pages/emergency/EmergencyMapPage"));
const EmergencyResponsePage = lazy(() => import("../pages/emergency/EmergencyResponsePage"));
const EmergencyAlertsPage = lazy(() => import("../pages/emergency/EmergencyAlertsPage"));

export default function AppRouter() {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKey={location.pathname}>
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<DefaultRouteRedirect defaultPath="/home" />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route path="verify-email" element={<VerifyEmailPage />} />

      <Route path="preview/route-explanation" element={<RouteExplanationPreviewPage />} />
      <Route path="preview/emergency" element={<EmergencyDashboardPage />} />
      <Route path="preview/emergency/assigned" element={<EmergencyAssignedPage />} />
      <Route path="preview/emergency/map" element={<EmergencyMapPage />} />
      <Route path="preview/emergency/response" element={<EmergencyResponsePage />} />
      <Route path="preview/emergency/alerts" element={<EmergencyAlertsPage />} />
      <Route path="navigation-preview" element={<NavigationPreviewPage />} />
      <Route path="map-preview" element={<NavigationPreviewPage />} />

      <Route element={<NonAdminOnlyRoute />}>
        <Route path="home" element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="description" element={<DescriptionPage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="incident/:id" element={<IncidentDetailPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="map" element={<MapPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="alerts/create" element={<CreateAlertPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route element={<ProtectedRoute roles={["emergency_service", "emergency"]} />}>
            <Route path="emergency" element={<EmergencyDashboardPage />} />
            <Route path="emergency/assigned" element={<EmergencyAssignedPage />} />
            <Route path="emergency/map" element={<EmergencyMapPage />} />
            <Route path="emergency/response" element={<EmergencyResponsePage />} />
            <Route path="emergency/response/:id" element={<EmergencyResponsePage />} />
            <Route path="emergency/alerts" element={<EmergencyAlertsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["police", "police_officer", "police officer", "police_supervisor", "police supervisor"]} />}>
            <Route element={<PoliceAccessGate />}>
              {/* Officer pages */}
              <Route path="police" element={<PolicePage />} />
              <Route path="police/setup-zone" element={<PoliceWorkZoneSetupPage />} />
              <Route path="police/alerts" element={<PoliceAlertCenterPage />} />
              <Route path="police/field-reports" element={<PoliceFieldReportsPage />} />
              <Route path="police/insights" element={<PoliceAIInsightsPage />} />
              <Route path="police/my-incidents" element={<PoliceMyIncidentsPage />} />
              <Route path="police/assigned-incidents" element={<PoliceAssignedIncidentsPage />} />
              <Route path="police/nearby" element={<PoliceNearbyIncidentsPage />} />
              <Route path="police/history" element={<PoliceOperationHistoryPage />} />
              <Route path="police/verification" element={<PoliceVerificationQueuePage />} />
              <Route path="police/priority-queue" element={<PolicePriorityQueuePage />} />
              <Route path="police/incident/:id" element={<PoliceIncidentDetailPage />} />
              {/* Supervisor-only pages — same gate, supervisors have police profiles too */}
              <Route path="police/supervisor" element={<SupervisorDashboardPage />} />
              <Route path="police/supervisor/coordination" element={<SupervisorIncidentCoordinationPage />} />
              <Route path="police/supervisor/officers" element={<SupervisorOfficerMonitoringPage />} />
              <Route path="police/supervisor/alerts" element={<SupervisorAlertCenterPage />} />
              <Route path="police/supervisor/analytics" element={<SupervisorAnalyticsPage />} />
              <Route path="police/supervisor/pilot" element={<SupervisorPilotDashboardPage />} />
              <Route path="police/supervisor/interventions" element={<SupervisorInterventionsPage />} />
              <Route path="police/supervisor/map" element={<SupervisorOperationsMapPage />} />
            </Route>
          </Route>
          <Route path="report" element={<ReportsPage />} />
          <Route path="report/create" element={<ReportIncidentPage />} />
          <Route path="predictions" element={<PredictionsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="dashboard" element={<UserDashboardPage />} />
          <Route path="alerts/subscriptions" element={<DangerSubscriptionsPage />} />
          <Route path="zone-profile" element={<RoadProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route path="admin/dashboard" element={<DashboardPage />} />
        <Route path="admin/services" element={<ServiceControlPage />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/overview" replace />} />
          <Route path="overview" element={<AdminOverviewPage />} />
          <Route path="incidents" element={<AdminIncidentsPage />} />
          <Route path="incidents/:id" element={<AdminIncidentReviewPage />} />
          <Route path="alerts" element={<AdminAlertsPage />} />
          <Route path="ai" element={<AdminAIMonitoringPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="zones" element={<AdminZonesPage />} />
          <Route path="system" element={<AdminSystemSettingsPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="inbox" element={<AdminInboxPage />} />
        </Route>
      </Route>

      <Route path="*" element={<DefaultRouteRedirect defaultPath="/home" />} />
    </Routes>
    </Suspense>
    </RouteErrorBoundary>
  );
}
