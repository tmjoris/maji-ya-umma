  import { Routes, Route, Navigate } from "react-router-dom"
  import { ThemeProvider } from "./Components/theme-provider"

  // Customer pages
  import LoginPage from "./pages/User/login"
  import RegisterPage from "./pages/User/register"
  import CustomerDashboard from "./pages/User/dashboard"
  import BillsPage from "./pages/User/bills"
  import UsagePage from "./pages/User/usage"
  import PaymentsPage from "./pages/User/payments"
  import FeedbackPage from "./pages/User/feedback"
  import ProfilePage from "./pages/User/profile"
  import HomePage from "./pages/User/home"
  import RequestConnectionPage from "./pages/User/request-connection"

  // Admin pages
  import AdminDashboard from "./pages/Admin/dashboard"
  import CustomersPage from "./pages/Admin/customers"
  import BillingPage from "./pages/Admin/billing"
  import PaymentsManagementPage from "./pages/Admin/payments"
  import TicketsPage from "./pages/Admin/tickets"
  import UsersPage from "./pages/Admin/users"

  function App() {
  return (
    <ThemeProvider defaultTheme="dark">
    
        <Routes>
          {/* Public routes */}
          <Route path="/" element={< HomePage/>}/>
          {/*<Route path="/" element={<Navigate to="/login" replace />} /> */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="request-connection" element={<RequestConnectionPage/>}/>

          {/* Customer routes */}
          <Route path="/dashboard" element={<CustomerDashboard />} />
          <Route path="/bills" element={<BillsPage />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Admin routes */}
          
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/customers" element={<CustomersPage />} />
          <Route path="/admin/billing" element={<BillingPage />} />
          <Route path="/admin/payments" element={<PaymentsManagementPage />} />
          <Route path="/admin/tickets" element={<TicketsPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
        </Routes>
  
    </ThemeProvider>
  )
}


  export default App

