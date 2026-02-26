import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "../pages/user/HomePage";
import LoginPage from "../pages/shared/LoginPage";
import AboutPage from "../pages/shared/AboutPage";
import DescriptionPage from "../pages/shared/DescriptionPage";
import RegisterPage from "../pages/shared/RegisterPage";
import NewsPage from "../pages/user/NewsPage";
import ServicesPage from "../pages/user/ServicesPage";
import MapPage from "../pages/user/MapPage";
import PredictionsPage from "../pages/user/PredictionsPage";
import ContactPage from "../pages/user/ContactPage";
import ProfilePage from "../pages/user/ProfilePage";
import IncidentDetailPage from "../pages/user/IncidentDetailPage";
import AlertsPage from "../pages/user/AlertsPage";
import NotificationsPage from "../pages/user/NotificationsPage";
import CreateAlertPage from "../pages/user/CreateAlertPage";
import ReportIncidentPage from "../pages/user/ReportIncidentPage";
import DashboardPage from "../pages/admin/DashboardPage";
import UserDashboardPage from "../pages/user/UserDashboardPage";
import ServiceControlPage from "../pages/admin/ServiceControlPage";
import SettingsPage from "../pages/user/SettingsPage";
import ProtectedRoute from "./ProtectedRoute";

/* ── Admin Panel pages ── */
import AdminLayout from "../components/layout/AdminLayout";
import AdminOverviewPage from "../pages/admin/AdminOverviewPage";
import AdminIncidentsPage from "../pages/admin/AdminIncidentsPage";
import AdminIncidentReviewPage from "../pages/admin/AdminIncidentReviewPage";
import AdminAlertsPage from "../pages/admin/AdminAlertsPage";
import AdminAIMonitoringPage from "../pages/admin/AdminAIMonitoringPage";
import AdminUsersPage from "../pages/admin/AdminUsersPage";
import AdminZonesPage from "../pages/admin/AdminZonesPage";
import AdminSystemSettingsPage from "../pages/admin/AdminSystemSettingsPage";
import AdminAnalyticsPage from "../pages/admin/AdminAnalyticsPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/description" element={<DescriptionPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/alerts/create" element={<CreateAlertPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/incident/:id" element={<IncidentDetailPage />} />
        <Route path="/report" element={<ReportIncidentPage />} />
        <Route path="/predictions" element={<PredictionsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* User dashboard — accessible to everyone */}
        <Route path="/dashboard" element={<UserDashboardPage />} />

        {/* Admin-only dashboard (legacy) */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute roles={["admin"]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/services"
          element={
            <ProtectedRoute roles={["admin"]}>
              <ServiceControlPage />
            </ProtectedRoute>
          }
        />

        {/* ═══ ADMIN PANEL — Full authority interface ═══ */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
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

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
