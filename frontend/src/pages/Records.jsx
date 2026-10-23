import { useEffect, useState } from "react";
import { ClipboardList, Plus, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { api, getErrorMessage } from "../api";
import { useAuth } from "../auth/AuthContext";
import Pagination from "../components/Pagination";

export default function Records() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [pets, setPets] = useState([]);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ count: 0, next: null, previous: null });
  const [error, setError] = useState("");
  const [aiAvailable, setAiAvailable] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, getValues, setValue, formState: { isSubmitting } } = useForm();
  const canCreate = ["admin", "veterinarian"].includes(user.role);

  async function loadRecords(targetPage = page) {
    const { data } = await api.get("/records/", { params: { page: targetPage } });
    setRecords(data.results || data);
    setPageInfo({ count: data.count || 0, next: data.next, previous: data.previous });
  }

  useEffect(() => {
    loadRecords(page).catch((requestError) => setError(getErrorMessage(requestError)));
  }, [page]);

  useEffect(() => {
    if (canCreate) api.get("/pets/").then(({ data }) => setPets(data.results || data)).catch(() => {});
    api.get("/ai/status/").then(({ data }) => setAiAvailable(data.available)).catch(() => setAiAvailable(false));
  }, []);

  async function draftWithAI() {
    const notes = getValues("source_notes");
    if (!notes?.trim()) {
      setError("Enter visit notes before requesting a draft.");
      return;
    }
    if (getValues("consent_to_ai") !== true) {
      setError("Confirm that these visit notes may be sent to the configured AI provider.");
      return;
    }
    setError("");
    setDrafting(true);
    try {
      const { data } = await api.post("/ai/note-draft/", { notes, consent_to_ai: true });
      Object.entries(data).forEach(([field, value]) => setValue(field, value, { shouldDirty: true }));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setDrafting(false);
    }
  }

  async function createRecord(values) {
    setError("");
    try {
      const { source_notes, ...recordValues } = values;
      const payload = {
        ...recordValues,
        clinic: user.clinic,
        pet: Number(values.pet),
        status: values.status,
      };
      await api.post("/records/", payload);
      setPage(1);
      await loadRecords(1);
      reset();
      setShowForm(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">Clinical documentation</p><h1 className="mt-2 text-3xl font-bold text-ink">Medical records</h1><p className="mt-2 text-slate-500">Owners see only finalized notes approved by veterinary staff.</p></div>{canCreate && <button className="btn-primary" onClick={() => setShowForm((value) => !value)}><Plus size={17} />{showForm ? "Close form" : "New record"}</button>}</div>
      {error && <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {showForm && <form onSubmit={handleSubmit(createRecord)} className="mb-6 grid gap-4 rounded-2xl border border-teal-100 bg-white p-5 shadow-card md:grid-cols-2">
        <label className="field-label">Pet<select className="input mt-2" {...register("pet", { required: true })}><option value="">Select patient</option>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} · {pet.species}</option>)}</select></label>
        <label className="field-label">Documentation status<select className="input mt-2" defaultValue="draft" {...register("status")}><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="finalized">Finalized (visible to owner)</option></select></label>
        <section className="rounded-xl border border-teal-100 bg-[#f4faf8] p-4 md:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-bold text-ink"><Sparkles size={16} className="text-teal-700" />Draft from visit notes</h3><p className="mt-1 text-xs text-slate-500">AI organizes only the facts you provide. Nothing is saved automatically.</p></div><button type="button" disabled={!aiAvailable || drafting} onClick={draftWithAI} className="btn-secondary"><Sparkles size={15} />{drafting ? "Drafting…" : "Draft fields"}</button></div>
          <textarea rows="3" className="input" placeholder="Enter your observations and plan in plain language." {...register("source_notes")} />
          {aiAvailable && <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" className="mt-1 accent-teal-700" {...register("consent_to_ai")} /><span>I agree to send these visit notes to the configured AI provider for drafting. Review all fields before saving.</span></label>}
          {!aiAvailable && <p className="mt-2 text-xs text-amber-800">Connect the OpenAI provider to enable note drafting.</p>}
        </section>
        <label className="field-label md:col-span-2">Chief complaint<textarea rows="2" className="input mt-2" {...register("chief_complaint")} /></label>
        <label className="field-label md:col-span-2">Examination findings<textarea rows="3" className="input mt-2" {...register("examination")} /></label>
        <label className="field-label md:col-span-2">Assessment<textarea rows="2" className="input mt-2" {...register("assessment")} /></label>
        <label className="field-label md:col-span-2">Treatment plan<textarea rows="3" className="input mt-2" {...register("treatment_plan")} /></label>
        <label className="field-label md:col-span-2">Follow-up recommendations<textarea rows="2" className="input mt-2" {...register("follow_up")} /></label>
        <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 md:col-span-2">Finalized records are available to the pet owner. Confirm the clinical content before selecting that status.</div>
        <button disabled={isSubmitting} className="btn-primary md:col-span-2">{isSubmitting ? "Saving…" : "Save medical record"}</button>
      </form>}
      <div className="space-y-4">
        {records.map((record) => <article key={record.id} className="rounded-2xl border border-teal-100 bg-white p-5 shadow-card md:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-ink">{record.pet_name}</h2><p className="mt-1 text-sm text-slate-500">{new Date(record.created_at).toLocaleDateString()} · {record.veterinarian_name}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${record.status === "finalized" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>{record.status}</span></div>
          <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            {[["Chief complaint", record.chief_complaint], ["Examination", record.examination], ["Assessment", record.assessment], ["Treatment plan", record.treatment_plan], ["Follow-up", record.follow_up]].filter(([, value]) => value).map(([label, value]) => <section key={label}><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p></section>)}
          </div>
        </article>)}
        {!records.length && <div className="rounded-2xl border border-dashed border-teal-200 bg-white py-16 text-center"><ClipboardList className="mx-auto text-teal-400" size={28} /><p className="mt-3 font-semibold text-ink">No medical records to show</p><p className="mt-1 text-sm text-slate-500">Only records authorized for your role appear here.</p></div>}
      </div>
      <Pagination count={pageInfo.count} page={page} hasNext={Boolean(pageInfo.next)} hasPrevious={Boolean(pageInfo.previous)} onPageChange={setPage} />
    </div>
  );
}
