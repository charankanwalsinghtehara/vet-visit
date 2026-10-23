import { useEffect, useState } from "react";
import { CalendarDays, PawPrint, Stethoscope } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, getErrorMessage } from "../api";
import { useAuth } from "../auth/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pets: 0, appointments: 0, records: 0, schedule: [] });
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/pets/"),
      api.get("/appointments/"),
      api.get("/records/"),
      api.get("/appointments/", { params: { status: "booked" } }),
      api.get("/appointments/", { params: { status: "checked_in" } }),
      api.get("/appointments/", { params: { status: "completed" } }),
      api.get("/appointments/", { params: { status: "cancelled" } }),
    ])
      .then(([pets, appointments, records, booked, checkedIn, completed, cancelled]) => {
        setStats({
          pets: pets.data.count ?? (pets.data.results || pets.data).length,
          appointments: appointments.data.count ?? (appointments.data.results || appointments.data).length,
          records: records.data.count ?? (records.data.results || records.data).length,
          schedule: [
            { name: "Booked", total: booked.data.count ?? booked.data.length },
            { name: "Checked in", total: checkedIn.data.count ?? checkedIn.data.length },
            { name: "Completed", total: completed.data.count ?? completed.data.length },
            { name: "Cancelled", total: cancelled.data.count ?? cancelled.data.length },
          ],
        });
      })
      .catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);

  const cards = [
    { label: "Pets", value: stats.pets, icon: PawPrint, color: "bg-teal-50 text-teal-700" },
    { label: "Appointments", value: stats.appointments, icon: CalendarDays, color: "bg-sky-50 text-sky-700" },
    { label: "Medical records", value: stats.records, icon: Stethoscope, color: "bg-violet-50 text-violet-700" },
  ];

  return (
    <div>
      <div className="mb-8"><p className="text-sm font-semibold text-teal-700">Your workspace</p><h1 className="mt-2 text-3xl font-bold text-ink">Good to see you, {user?.first_name || user?.username}</h1><p className="mt-2 text-slate-500">A clear view of your clinic and patient care.</p></div>
      {error && <div role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-teal-100 bg-white p-5 shadow-card"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">{label}</span><span className={`grid h-10 w-10 place-items-center rounded-xl ${color}`}><Icon size={19} /></span></div><p className="mt-5 text-3xl font-bold text-ink">{value}</p><p className="mt-1 text-xs text-slate-400">Visible to your account</p></div>)}
      </div>
      <section className="mt-6 rounded-2xl border border-teal-100 bg-white p-5 shadow-card md:p-7">
        <div className="mb-6"><h2 className="font-bold text-ink">Appointment overview</h2><p className="mt-1 text-sm text-slate-500">Current appointment statuses</p></div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.schedule} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8f1ef" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip cursor={{ fill: "#f0f8f6" }} />
              <Bar dataKey="total" name="Appointments" fill="#0f766e" radius={[7, 7, 0, 0]} maxBarSize={54} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
