import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";

const Appointments = lazy(() => import("./pages/Appointments"));
const CareAssistant = lazy(() => import("./pages/CareAssistant"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Payments = lazy(() => import("./pages/Payments"));
const Pets = lazy(() => import("./pages/Pets"));
const Records = lazy(() => import("./pages/Records"));

export default function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading workspace…</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="pets" element={<Pets />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="records" element={<Records />} />
            <Route path="assistant" element={<CareAssistant />} />
            <Route path="payments" element={<Payments />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
