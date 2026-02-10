import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from '../pages/user/HomePage'
import LoginPage from '../pages/shared/LoginPage'
import AboutPage from '../pages/shared/AboutPage'
import DescriptionPage from '../pages/shared/DescriptionPage'
import RegisterPage from '../pages/shared/RegisterPage'
import NewsPage from '../pages/user/NewsPage'
import ServicesPage from '../pages/user/ServicesPage'
import MapPage from '../pages/user/MapPage'
import PredictionsPage from '../pages/user/PredictionsPage'
import ContactPage from '../pages/user/ContactPage'
import ProfilePage from '../pages/user/ProfilePage'
import IncidentDetailPage from '../pages/user/IncidentDetailPage'
import AlertsPage from '../pages/user/AlertsPage'
import NotificationsPage from '../pages/user/NotificationsPage'
import CreateAlertPage from '../pages/user/CreateAlertPage'
import ReportIncidentPage from '../pages/user/ReportIncidentPage'
import DashboardPage from '../pages/admin/DashboardPage'
import ServiceControlPage from '../pages/admin/ServiceControlPage'
import ProtectedRoute from './ProtectedRoute'

export default function AppRouter(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
        <Route path="/about" element={<AboutPage />} />
  <Route path="/description" element={<DescriptionPage />} />
        <Route path="/news" element={<NewsPage />} />
  <Route path="/services" element={<ServicesPage />} />
  <Route path="/map" element={<MapPage />} />
  <Route path="/alerts" element={<AlertsPage />} />
  <Route path="/alerts/create" element={<CreateAlertPage />} />
  <Route path="/notifications" element={<NotificationsPage />} />
  <Route path="/incident/:id" element={<IncidentDetailPage />} />
  <Route path="/report" element={<ReportIncidentPage />} />
  <Route path="/predictions" element={<PredictionsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* Admin routes: dashboard visible to any logged-in user, services admin-only */}
        <Route path="/admin/dashboard" element={<ProtectedRoute><DashboardPage/></ProtectedRoute>} />
        <Route path="/admin/services" element={<ProtectedRoute roles={["admin"]}><ServiceControlPage/></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
