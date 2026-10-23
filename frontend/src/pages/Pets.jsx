import { useEffect, useState } from "react";
import { PawPrint, Plus, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { api, getErrorMessage } from "../api";
import { useAuth } from "../auth/AuthContext";
import Pagination from "../components/Pagination";

export default function Pets() {
  const { user } = useAuth();
  const [pets, setPets] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [owners, setOwners] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ count: 0, next: null, previous: null });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  useEffect(() => {
    let active = true;
    api.get("/pets/", { params: { search: query, page } })
      .then(({ data }) => {
        if (!active) return;
        setPets(data.results || data);
        setPageInfo({ count: data.count || 0, next: data.next, previous: data.previous });
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      });
    return () => {
      active = false;
    };
  }, [query, page]);

  useEffect(() => {
    api.get("/clinics/").then(({ data }) => setClinics(data.results || data)).catch(() => {});
    if (user.clinic && ["admin", "receptionist"].includes(user.role)) {
      api.get(`/clinics/${user.clinic}/owners/`).then(({ data }) => setOwners(data)).catch((requestError) => setError(getErrorMessage(requestError)));
    }
  }, []);

  async function addPet(values) {
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post("/pets/", {
        ...values,
        clinic: user.role === "owner" ? Number(values.clinic) : user.clinic,
        weight_kg: values.weight_kg ? Number(values.weight_kg) : null,
        date_of_birth: values.date_of_birth || null,
      });
      setPage(1);
      setQuery("");
      const { data: firstPage } = await api.get("/pets/");
      setPets(firstPage.results || firstPage);
      setPageInfo({ count: firstPage.count || 0, next: firstPage.next, previous: firstPage.previous });
      setSuccess(`${data.name} has been added.`);
      reset();
      setShowForm(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  const canAddPet = user.role === "owner" || ["admin", "receptionist"].includes(user.role);

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">Patient directory</p><h1 className="mt-2 text-3xl font-bold text-ink">Pets</h1><p className="mt-2 text-slate-500">Pet profiles visible to your account.</p></div>{canAddPet && <button className="btn-primary" onClick={() => setShowForm((value) => !value)}><Plus size={17} />{showForm ? "Close form" : "Add a pet"}</button>}</div>
      {error && <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {success && <div role="status" className="mb-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{success}</div>}
      {showForm && <form onSubmit={handleSubmit(addPet)} className="mb-6 grid gap-4 rounded-2xl border border-teal-100 bg-white p-5 shadow-card sm:grid-cols-2 lg:grid-cols-3">
        <label className="field-label">Pet name<input className="input mt-2" {...register("name", { required: true })} /></label>
        <label className="field-label">Species<input className="input mt-2" placeholder="Dog, cat…" {...register("species", { required: true })} /></label>
        <label className="field-label">Breed<input className="input mt-2" {...register("breed")} /></label>
        {user.role === "owner" && <label className="field-label">Clinic<select className="input mt-2" defaultValue="" {...register("clinic", { required: true })}><option value="" disabled>Select clinic</option>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label>}
        {user.role !== "owner" && <label className="field-label">Pet owner<select className="input mt-2" {...register("owner", { required: true })}><option value="">Select an existing clinic owner</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.first_name} {owner.last_name} · {owner.email}</option>)}</select></label>}
        <label className="field-label">Date of birth<input type="date" className="input mt-2" {...register("date_of_birth")} /></label>
        <label className="field-label">Sex<select className="input mt-2" {...register("sex")}><option value="unknown">Unknown</option><option value="female">Female</option><option value="male">Male</option></select></label>
        <label className="field-label">Weight (kg)<input type="number" step="0.01" min="0" className="input mt-2" {...register("weight_kg")} /></label>
        <label className="field-label sm:col-span-2">Allergies<textarea rows="2" className="input mt-2" {...register("allergies")} /></label>
        <label className="field-label sm:col-span-2 lg:col-span-3">Existing conditions<textarea rows="2" className="input mt-2" {...register("existing_conditions")} /></label>
        {user.role !== "owner" && owners.length === 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2 lg:col-span-3">There are no owners registered with this clinic yet. Ask the owner to create an account and add their first pet profile before registering additional pets.</p>}
        <button disabled={isSubmitting || (user.role !== "owner" && !owners.length)} className="btn-primary sm:col-span-2 lg:col-span-3">{isSubmitting ? "Saving…" : "Save pet profile"}</button>
      </form>}
      <div className="mb-4 flex max-w-md items-center gap-2 rounded-xl border border-teal-100 bg-white px-3"><Search size={17} className="text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="h-11 w-full bg-transparent text-sm outline-none" placeholder="Search pets by name, species, or breed" /></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pets.map((pet) => <article key={pet.id} className="rounded-2xl border border-teal-100 bg-white p-5 shadow-card"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-50 text-teal-700"><PawPrint size={20} /></span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-600">{pet.species}</span></div><h2 className="mt-4 text-lg font-bold text-ink">{pet.name}</h2><p className="text-sm text-slate-500">{pet.breed || "Breed not specified"}{pet.sex !== "unknown" ? ` · ${pet.sex}` : ""}</p><div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm"><p><span className="text-slate-400">Clinic</span><span className="float-right font-medium text-slate-700">{pet.clinic_name}</span></p><p><span className="text-slate-400">Owner</span><span className="float-right font-medium text-slate-700">{pet.owner_name}</span></p>{pet.weight_kg && <p><span className="text-slate-400">Weight</span><span className="float-right font-medium text-slate-700">{pet.weight_kg} kg</span></p>}</div>{pet.allergies && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800"><strong>Allergies:</strong> {pet.allergies}</p>}</article>)}
      </div>
      {!pets.length && <div className="rounded-2xl border border-dashed border-teal-200 bg-white py-16 text-center"><PawPrint className="mx-auto text-teal-400" size={28} /><p className="mt-3 font-semibold text-ink">{query ? "No matching pets" : "No pets to show yet"}</p><p className="mt-1 text-sm text-slate-500">{query ? "Try another search." : "Pet profiles will appear here when they are added."}</p></div>}
      <Pagination count={pageInfo.count} page={page} hasNext={Boolean(pageInfo.next)} hasPrevious={Boolean(pageInfo.previous)} onPageChange={setPage} />
    </div>
  );
}
