import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { CalendarDays, ChartNoAxesCombined, ClipboardList, CreditCard, LogOut, Menu, PawPrint, Sparkles, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const links = [
  { to: "/", label: "Overview", icon: ChartNoAxesCombined },
  { to: "/pets", label: "Pets", icon: PawPrint },
  { to: "/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/records", label: "Medical records", icon: ClipboardList },
  { to: "/assistant", label: "Care assistant", icon: Sparkles },
  { to: "/payments", label: "Payments", icon: CreditCard },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#f6faf9] lg:flex">
      {open && <button className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-teal-100 bg-white p-5 transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-600 text-white"><PawPrint size={21} /></span>
            <div><p className="font-bold text-ink">VetCare</p><p className="text-xs text-slate-500">Clinic workspace</p></div>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <div className="mt-8 rounded-2xl bg-teal-50 p-4">
          <p className="truncate text-sm font-semibold text-ink">{user?.clinic_name || "Pet owner account"}</p>
          <p className="mt-1 text-xs capitalize text-slate-500">{user?.role?.replace("_", " ")}</p>
        </div>
        <nav className="mt-8 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${isActive ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50"}`}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout} className="mt-auto flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-rose-600">
          <LogOut size={18} />Sign out
        </button>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-teal-100 bg-white/90 px-5 backdrop-blur md:px-9">
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right"><p className="text-sm font-semibold text-ink">{user?.first_name || user?.username}</p><p className="text-xs text-slate-500">{user?.email}</p></div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">{(user?.first_name || user?.username || "V")[0].toUpperCase()}</div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl p-5 md:p-9"><Outlet /></div>
      </main>
    </div>
  );
}
