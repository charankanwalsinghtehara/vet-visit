import { useEffect, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { api, getErrorMessage } from "../api";
import { useAuth } from "../auth/AuthContext";
import Pagination from "../components/Pagination";

function localDate(value) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function Appointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [pets, setPets] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [vets, setVets] = useState([]);
  const [clinicId, setClinicId] = useState(user.clinic || "");
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ count: 0, next: null, previous: null });
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  async function loadAppointments(targetPage = page) {
    const { data } = await api.get("/appointments/", { params: { page: targetPage } });
    setAppointments(data.results || data);
    setPageInfo({ count: data.count || 0, next: data.next, previous: data.previous });
  }

  useEffect(() => {
    loadAppointments(page).catch((requestError) => setError(getErrorMessage(requestError)));
  }, [page]);

  useEffect(() => {
    api.get("/pets/").then(({ data }) => setPets(data.results || data)).catch(() => {});
    api.get("/clinics/").then(({ data }) => setClinics(data.results || data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!clinicId) {
      setVets([]);
      return;
    }
    api.get(`/clinics/${clinicId}/veterinarians/`).then(({ data }) => setVets(data.results || data)).catch((requestError) => setError(getErrorMessage(requestError)));
  }, [clinicId]);

  async function createAppointment(values) {
    setError("");
    try {
      await api.post("/appointments/", {
        clinic: Number(clinicId),
        pet: Number(values.pet),
        veterinarian: Number(values.veterinarian),
        starts_at: new Date(values.starts_at).toISOString(),
        duration_minutes: Number(values.duration_minutes),
        reason: values.reason,
      });
      setPage(1);
      await loadAppointments(1);
      reset();
      setShowForm(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function updateStatus(appointment, status) {
    setError("");
    try {
      const { data } = await api.patch(`/appointments/${appointment.id}/`, { status });
      setAppointments((current) => current.map((item) => item.id === data.id ? data : item));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  const owner = user.role === "owner";
  const canBook = owner || ["admin", "receptionist"].includes(user.role);
  const eligiblePets = pets.filter((pet) => String(pet.clinic) === String(clinicId));
  const titleForStatus = { booked: "Booked", checked_in: "Checked in", completed: "Completed", cancelled: "Cancelled" };

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">Visits and scheduling</p><h1 className="mt-2 text-3xl font-bold text-ink">Appointments</h1><p className="mt-2 text-slate-500">Book and follow appointments for your pets or clinic.</p></div>{canBook && <button onClick={() => setShowForm((value) => !value)} className="btn-primary"><Plus size={17} />{showForm ? "Close form" : "Book appointment"}</button>}</div>
      {error && <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {showForm && <form onSubmit={handleSubmit(createAppointment)} className="mb-6 grid gap-4 rounded-2xl border border-teal-100 bg-white p-5 shadow-card sm:grid-cols-2 lg:grid-cols-3">
        {owner && <label className="field-label">Clinic<select className="input mt-2" value={clinicId} onChange={(event) => setClinicId(event.target.value)} required><option value="" disabled>Select a clinic</option>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label>}
        <label className="field-label">Pet<select className="input mt-2" {...register("pet", { required: true })}><option value="">Select a pet</option>{eligiblePets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label>
        <label className="field-label">Veterinarian<select className="input mt-2" {...register("veterinarian", { required: true })}><option value="">Select a veterinarian</option>{vets.map((vet) => <option key={vet.id} value={vet.id}>{vet.first_name} {vet.last_name}</option>)}</select></label>
        <label className="field-label">Date and time<input type="datetime-local" min={new Date().toISOString().slice(0, 16)} className="input mt-2" {...register("starts_at", { required: true })} /></label>
        <label className="field-label">Duration<select className="input mt-2" defaultValue="30" {...register("duration_minutes")}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option></select></label>
        <label className="field-label sm:col-span-2 lg:col-span-3">Reason for visit<textarea rows="2" className="input mt-2" {...register("reason")} /></label>
        <button disabled={isSubmitting || !clinicId} className="btn-primary sm:col-span-2 lg:col-span-3">{isSubmitting ? "Booking…" : "Request appointment"}</button>
      </form>}
      <div className="space-y-3">
        {appointments.map((appointment) => <article key={appointment.id} className="flex flex-col gap-4 rounded-2xl border border-teal-100 bg-white p-5 shadow-card md:flex-row md:items-center">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700"><CalendarDays size={21} /></span>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-ink">{appointment.pet_name}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${appointment.status === "cancelled" ? "bg-rose-50 text-rose-700" : appointment.status === "completed" ? "bg-slate-100 text-slate-600" : "bg-teal-50 text-teal-700"}`}>{titleForStatus[appointment.status]}</span></div><p className="mt-1 text-sm text-slate-500">{localDate(appointment.starts_at)} · {appointment.duration_minutes} min · Dr. {appointment.veterinarian_name}</p><p className="mt-1 text-xs text-slate-400">{appointment.clinic_name}{appointment.reason ? ` · ${appointment.reason}` : ""}</p></div>
          <div className="flex flex-wrap gap-2">
            {owner && appointment.status === "booked" && new Date(appointment.starts_at) > new Date() && <button onClick={() => updateStatus(appointment, "cancelled")} className="btn-secondary text-rose-700">Cancel</button>}
            {user.role === "veterinarian" && appointment.status === "booked" && <button onClick={() => updateStatus(appointment, "checked_in")} className="btn-secondary">Check in</button>}
            {user.role === "veterinarian" && appointment.status === "checked_in" && <button onClick={() => updateStatus(appointment, "completed")} className="btn-secondary">Complete</button>}
            {["admin", "receptionist"].includes(user.role) && appointment.status === "booked" && <button onClick={() => updateStatus(appointment, "checked_in")} className="btn-secondary">Check in</button>}
          </div>
        </article>)}
        {!appointments.length && <div className="rounded-2xl border border-dashed border-teal-200 bg-white py-16 text-center"><CalendarDays className="mx-auto text-teal-400" size={28} /><p className="mt-3 font-semibold text-ink">No appointments yet</p><p className="mt-1 text-sm text-slate-500">Appointments that you can access will show here.</p></div>}
      </div>
      <Pagination count={pageInfo.count} page={page} hasNext={Boolean(pageInfo.next)} hasPrevious={Boolean(pageInfo.previous)} onPageChange={setPage} />
    </div>
  );
}
