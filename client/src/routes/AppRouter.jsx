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
import PoliceFieldReportsPage from "../pages/police/PoliceFieldReportsPage";
import PoliceIncidentDetailPage from "../pages/police/PoliceIncidentDetailPage";
import PoliceMyIncidentsPage from "../pages/police/PoliceMyIncidentsPage";
import PoliceNearbyIncidentsPage from "../pages/police/PoliceNearbyIncidentsPage";
import PoliceOperationHistoryPage from "../pages/police/PoliceOperationHistoryPage";
import PoliceVerificationQueuePage from "../pages/police/PoliceVerificationQueuePage";
import PoliceWorkZoneSetupPage from "../pages/police/PoliceWorkZoneSetupPage";
import ProfilePage from "../pages/user/ProfilePage";
import ReportIncidentPage from "../pages/user/ReportIncidentPage";
import ReportsPage from "../pages/user/ReportsPage";
import SettingsPage from "../pages/user/SettingsPage";
import UserDashboardPage from "../pages/user/UserDashboardPage";
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
          <Route element={<ProtectedRoute roles={["police", "police_officer", "police officer"]} />}>
            <Route element={<PoliceAccessGate />}>
              <Route path="police" element={<PolicePage />} />
              <Route path="police/setup-zone" element={<PoliceWorkZoneSetupPage />} />
              <Route path="police/alerts" element={<PoliceAlertCenterPage />} />
              <Route path="police/field-reports" element={<PoliceFieldReportsPage />} />
              <Route path="police/insights" element={<PoliceAIInsightsPage />} />
              <Route path="police/my-incidents" element={<PoliceMyIncidentsPage />} />
              <Route path="police/nearby" element={<PoliceNearbyIncidentsPage />} />
              <Route path="police/history" element={<PoliceOperationHistoryPage />} />
              <Route path="police/verification" element={<PoliceVerificationQueuePage />} />
              <Route path="police/incident/:id" element={<PoliceIncidentDetailPage />} />
            </Route>
          </Route>
          <Route path="report" element={<ReportsPage />} />
          <Route path="report/create" element={<ReportIncidentPage />} />
          <Route path="predictions" element={<PredictionsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="dashboard" element={<UserDashboardPage />} />
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
        </Route>
      </Route>

      <Route path="*" element={<DefaultRouteRedirect defaultPath="/home" />} />
    </Routes>
  );
}
