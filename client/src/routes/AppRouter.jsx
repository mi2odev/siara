import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import AdminLayout from "../components/layout/AdminLayout";
import DashboardPage from "../pages/admin/DashboardPage";
import ServiceControlPage from "../pages/admin/ServiceControlPage";
import AdminOverviewPage from "../pages/admin/AdminOverviewPage";
import AdminIncidentsPage from "../pages/admin/AdminIncidentsPage";
import AdminIncidentReviewPage from "../pages/admin/AdminIncidentReviewPage";
import AdminAlertsPage from "../pages/admin/AdminAlertsPage";
import AdminAIMonitoringPage from "../pages/admin/AdminAIMonitoringPage";
import AdminUsersPage from "../pages/admin/AdminUsersPage";
import AdminZonesPage from "../pages/admin/AdminZonesPage";
import AdminSystemSettingsPage from "../pages/admin/AdminSystemSettingsPage";
import AdminAnalyticsPage from "../pages/admin/AdminAnalyticsPage";
import AdminInboxPage from "../pages/admin/AdminInboxPage";
import CreateAlertPage from "../pages/user/CreateAlertPage";
import AlertsPage from "../pages/user/AlertsPage";
import ContactPage from "../pages/user/ContactPage";
import HomePage from "../pages/user/HomePage";
import IncidentDetailPage from "../pages/user/IncidentDetailPage";
import MapPage from "../pages/user/MapPage";
import NewsPage from "../pages/user/NewsPage";
import NotificationsPage from "../pages/user/NotificationsPage";
import PredictionsPage from "../pages/user/PredictionsPage";
import PoliceAlertCenterPage from "../pages/police/PoliceAlertCenterPage";
import PolicePage from "../pages/police/PolicePage";
import PoliceAIInsightsPage from "../pages/police/PoliceAIInsightsPage";
import PoliceAssignedIncidentsPage from "../pages/police/PoliceAssignedIncidentsPage";
import PoliceFieldReportsPage from "../pages/police/PoliceFieldReportsPage";
import PoliceIncidentDetailPage from "../pages/police/PoliceIncidentDetailPage";
import PoliceMyIncidentsPage from "../pages/police/PoliceMyIncidentsPage";
import PoliceNearbyIncidentsPage from "../pages/police/PoliceNearbyIncidentsPage";
import PoliceOperationHistoryPage from "../pages/police/PoliceOperationHistoryPage";
import PoliceVerificationQueuePage from "../pages/police/PoliceVerificationQueuePage";
import PoliceWorkZoneSetupPage from "../pages/police/PoliceWorkZoneSetupPage";
import PolicePriorityQueuePage from "../pages/police/PolicePriorityQueuePage";
import SupervisorDashboardPage from "../pages/supervisor/SupervisorDashboardPage";
import SupervisorIncidentCoordinationPage from "../pages/supervisor/SupervisorIncidentCoordinationPage";
import SupervisorOfficerMonitoringPage from "../pages/supervisor/SupervisorOfficerMonitoringPage";
import SupervisorAlertCenterPage from "../pages/supervisor/SupervisorAlertCenterPage";
import SupervisorAnalyticsPage from "../pages/supervisor/SupervisorAnalyticsPage";
import SupervisorOperationsMapPage from "../pages/supervisor/SupervisorOperationsMapPage";
import SupervisorPilotDashboardPage from "../pages/supervisor/SupervisorPilotDashboardPage";
import SupervisorInterventionsPage from "../pages/supervisor/SupervisorInterventionsPage";
import ProfilePage from "../pages/user/ProfilePage";
import ReportIncidentPage from "../pages/user/ReportIncidentPage";
import ReportsPage from "../pages/user/ReportsPage";
import SettingsPage from "../pages/user/SettingsPage";
import UserDashboardPage from "../pages/user/UserDashboardPage";
import DangerSubscriptionsPage from "../pages/user/DangerSubscriptionsPage";
import RoadProfilePage from "../pages/user/RoadProfilePage";
import AboutPage from "../pages/shared/AboutPage";
import DescriptionPage from "../pages/shared/DescriptionPage";
import ForgotPasswordPage from "../pages/shared/ForgotPasswordPage";
import LoginPage from "../pages/shared/LoginPage";
import RegisterPage from "../pages/shared/RegisterPage";
import VerifyEmailPage from "../pages/shared/VerifyEmailPage";
import DefaultRouteRedirect from "./DefaultRouteRedirect";
import NonAdminOnlyRoute from "./NonAdminOnlyRoute";
import ProtectedRoute from "./ProtectedRoute";
import PublicOnlyRoute from "./PublicOnlyRoute";
import PoliceAccessGate from "../components/police/PoliceAccessGate";
import NavigationPreviewPage from "../pages/preview/NavigationPreviewPage";
import RouteExplanationPreviewPage from "../pages/preview/RouteExplanationPreviewPage";
import EmergencyDashboardPage from "../pages/emergency/EmergencyDashboardPage";
import EmergencyAssignedPage from "../pages/emergency/EmergencyAssignedPage";
import EmergencyMapPage from "../pages/emergency/EmergencyMapPage";
import EmergencyResponsePage from "../pages/emergency/EmergencyResponsePage";
import EmergencyAlertsPage from "../pages/emergency/EmergencyAlertsPage";

export default function AppRouter() {
  return (
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
  );
}
