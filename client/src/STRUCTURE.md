# SIARA Frontend Structure

This file lists the created folders and their intended purpose. No implementation files were added per request.

src/
 ├─ components/
 │   ├─ layout/       → Header, Sidebar, Footer
 │   ├─ map/          → MapContainer, MarkersLayer
 │   ├─ ui/           → Button, Card, Input, Modal, Loader
 │   ├─ forms/        → PredictForm, ContactForm
 ├─ pages/
 │   ├─ admin/        → DashboardPage, ServiceControlPage
 │   ├─ user/         → HomePage, NewsPage, ServicesPage, ProfilePage, ContactPage
 │   ├─ shared/       → LoginPage, AboutPage
 ├─ services/         → mock API services (mockApi.js, authService.js)
 ├─ contexts/         → AuthContext, ThemeContext, ApiContext
 ├─ hooks/            → useAuth, useApi, useMockData
 ├─ assets/           → logos, icons, images
 ├─ data/             → mock JSON files

Created placeholder `.gitkeep` files inside each folder to keep them in source control.
