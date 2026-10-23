import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, Clock3, HeartPulse, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { api, getErrorMessage } from "../api";

const urgencyStyles = {
  emergency: "border-rose-300 bg-rose-50 text-rose-950",
  same_day: "border-amber-300 bg-amber-50 text-amber-950",
  routine: "border-teal-200 bg-teal-50 text-teal-950",
};

const urgencyLabels = {
  emergency: "Emergency care now",
  same_day: "Contact a vet today",
  routine: "Arrange routine care",
};

export default function CareAssistant() {
  const [aiAvailable, setAiAvailable] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({ defaultValues: { species: "Dog" } });

  useEffect(() => {
    api.get("/ai/status/").then(({ data }) => setAiAvailable(data.available)).catch(() => setAiAvailable(false));
  }, []);

  async function assess(values) {
    setError("");
    setResult(null);
    try {
      const { data } = await api.post("/ai/triage/", values);
      setResult(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-teal-700"><Sparkles size={16} /> CARE ASSISTANT</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">A clearer next step for your pet.</h1>
          <p className="mt-2 max-w-2xl text-slate-500">Describe what you are seeing. Get an urgency guide and practical next steps to discuss with a veterinarian.</p>
        </div>
        <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${aiAvailable ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-600"}`}>
          <span className={`h-2 w-2 rounded-full ${aiAvailable ? "bg-teal-500" : "bg-slate-400"}`} />
          {aiAvailable ? "AI guidance available" : "Offline safety guide active"}
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card md:p-7">
          <div className="mb-6 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><HeartPulse size={20} /></span>
            <div><h2 className="font-bold text-ink">Tell us what is happening</h2><p className="mt-1 text-sm text-slate-500">A few details help put the symptoms in context.</p></div>
          </div>
          {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
          <form onSubmit={handleSubmit(assess)} className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">Animal<select className="input mt-2" {...register("species", { required: true })}><option>Dog</option><option>Cat</option><option>Rabbit</option><option>Bird</option><option>Other</option></select></label>
            <label className="field-label">Age, if known<input className="input mt-2" placeholder="e.g. 4 years" {...register("age")} /></label>
            <label className="field-label sm:col-span-2">Symptoms<textarea className="input mt-2" rows="5" maxLength={3000} placeholder="When did it start? What changed? Include appetite, drinking, energy, and anything unusual they may have eaten." {...register("symptoms", { required: "Describe the symptoms first.", maxLength: 3000 })} /></label>
            <button disabled={isSubmitting} className="btn-primary sm:col-span-2"><Activity size={17} />{isSubmitting ? "Reviewing symptoms…" : "Check urgency"}</button>
          </form>
          {aiAvailable ? <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" className="mt-1 accent-teal-700" {...register("consent_to_ai")} /><span>I agree to send this symptom description to the configured AI provider for non-emergency guidance. Emergency signs are screened locally first. Do not include payment details.</span></label> : <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">Offline mode checks emergency phrases and gives conservative next steps. It is not an AI assessment and cannot rule out an urgent problem.</p>}
          {result && <section aria-live="polite" className={`mt-6 rounded-xl border p-5 ${urgencyStyles[result.urgency] || urgencyStyles.routine}`}>
            <div className="flex items-start gap-3">
              {result.urgency === "emergency" ? <AlertTriangle className="mt-0.5 shrink-0" size={20} /> : <ShieldCheck className="mt-0.5 shrink-0" size={20} />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide">{urgencyLabels[result.urgency] || "Guidance"}</p>
                <h2 className="mt-1 text-lg font-bold">{result.summary}</h2>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6">{result.next_steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ul>
                {result.source === "emergency-safety-screen" && <p className="mt-4 text-xs font-semibold">Emergency signs were flagged before any AI review.</p>}
                {result.source === "local-safety-screen" && <p className="mt-4 text-xs font-semibold">Offline safety guidance only. OpenAI is not connected; this is not an AI assessment.</p>}
              </div>
            </div>
          </section>}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-rose-200 bg-[#fff8f6] p-5">
            <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-100 text-rose-700"><AlertTriangle size={18} /></span><div><h2 className="font-bold text-rose-950">Do not wait for online guidance</h2><p className="mt-2 text-sm leading-6 text-rose-900">Go to an emergency veterinarian now for breathing trouble, collapse, unresponsiveness, seizures, heavy bleeding, suspected poisoning, severe trauma, or inability to urinate.</p></div></div>
            <p className="mt-4 border-t border-rose-200 pt-3 text-xs leading-5 text-rose-800">Call the nearest emergency clinic while travelling. Do not give medication or induce vomiting unless a veterinarian directs you.</p>
            <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-rose-900 underline underline-offset-4" href="https://www.google.com/maps/search/emergency+veterinarian+near+me/" target="_blank" rel="noreferrer"><MapPin size={16} />Find an emergency veterinarian</a>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 font-bold text-ink"><Clock3 size={17} className="text-teal-700" />What this tool can do</h2>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
              <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />Help organize symptoms and urgency.</li>
              <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />Suggest what details to tell your clinic.</li>
              <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />Never diagnose or replace an examination.</li>
            </ul>
            <a href="/appointments" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:underline">View appointments <ArrowUpRight size={15} /></a>
          </section>
        </aside>
      </div>
    </div>
  );
}