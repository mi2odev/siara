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
import ProfilePage from "../pages/user/ProfilePage";
import ReportIncidentPage from "../pages/user/ReportIncidentPage";
import ServicesPage from "../pages/user/ServicesPage";
import SettingsPage from "../pages/user/SettingsPage";
import UserDashboardPage from "../pages/user/UserDashboardPage";
import AboutPage from "../pages/shared/AboutPage";
import DescriptionPage from "../pages/shared/DescriptionPage";
import ForgotPasswordPage from "../pages/shared/ForgotPasswordPage";
import LoginPage from "../pages/shared/LoginPage";
import RegisterPage from "../pages/shared/RegisterPage";
import VerifyEmailPage from "../pages/shared/VerifyEmailPage";
import ProtectedRoute from "./ProtectedRoute";
import PublicOnlyRoute from "./PublicOnlyRoute";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<HomePage />} />
      <Route
        path="/login"
        element={(
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        )}
      />
      <Route
        path="/register"
        element={(
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        )}
      />
      <Route
        path="/forgot-password"
        element={(
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        )}
      />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route
        path="/map"
        element={(
          <ProtectedRoute>
            <MapPage />
          </ProtectedRoute>
        )}
      />
      <Route path="/description" element={<DescriptionPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route
        path="/alerts"
        element={(
          <ProtectedRoute>
            <AlertsPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/alerts/create"
        element={(
          <ProtectedRoute>
            <CreateAlertPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/notifications"
        element={(
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        )}
      />
      <Route path="/incident/:id" element={<IncidentDetailPage />} />
      <Route
        path="/report"
        element={(
          <ProtectedRoute>
            <ReportIncidentPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/predictions"
        element={(
          <ProtectedRoute>
            <PredictionsPage />
          </ProtectedRoute>
        )}
      />
      <Route path="/contact" element={<ContactPage />} />
      <Route
        path="/profile"
        element={(
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/settings"
        element={(
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/dashboard"
        element={(
          <ProtectedRoute>
            <UserDashboardPage />
          </ProtectedRoute>
        )}
      />

      <Route
        path="/admin/dashboard"
        element={(
          <ProtectedRoute roles={["admin"]}>
            <DashboardPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin/services"
        element={(
          <ProtectedRoute roles={["admin"]}>
            <ServiceControlPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin"
        element={(
          <ProtectedRoute roles={["admin"]}>
            <AdminLayout />
          </ProtectedRoute>
        )}
      >
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

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
