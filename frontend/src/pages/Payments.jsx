import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, CreditCard, FileText, LockKeyhole, Plus, RefreshCw, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { api, getErrorMessage } from "../api";
import { useAuth } from "../auth/AuthContext";

function formatMoney(cents, currency) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default function Payments() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [pets, setPets] = useState([]);
  const [owners, setOwners] = useState([]);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [paymentConfirmation, setPaymentConfirmation] = useState(null);
  const canIssue = ["admin", "receptionist"].includes(user.role);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  async function loadInvoices() {
    const { data } = await api.get("/invoices/");
    setInvoices(data.results || data);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") setNotice("Checkout completed. Payment status will update after Stripe confirms it.");
    if (params.get("status") === "cancelled") setNotice("Checkout was cancelled. Your invoice remains open.");
    api.get("/billing/config/").then(({ data }) => {
      setStripeConfigured(data.stripe_configured);
      setDemoMode(data.demo_mode);
    }).catch(() => setStripeConfigured(false));
    loadInvoices().catch((requestError) => setError(getErrorMessage(requestError))).finally(() => setLoading(false));
    if (canIssue && user.clinic) {
      api.get("/pets/").then(({ data }) => setPets(data.results || data)).catch(() => {});
      api.get(`/clinics/${user.clinic}/owners/`).then(({ data }) => setOwners(data)).catch(() => {});
    }
  }, []);

  async function createInvoice(values) {
    setError("");
    try {
      await api.post("/invoices/", {
        clinic: user.clinic,
        owner: Number(values.owner),
        pet: Number(values.pet),
        description: values.description,
        amount_cents: Math.round(Number(values.amount) * 100),
      });
      await loadInvoices();
      reset();
      setShowForm(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function startPayment(invoice) {
    setError("");
    try {
      if (demoMode && !stripeConfigured) {
        const { data } = await api.post(`/invoices/${invoice.id}/demo-pay/`);
        setNotice("");
        setPaymentConfirmation({
          description: data.description,
          amount: formatMoney(data.amount_cents, data.currency),
        });
        await loadInvoices();
        return;
      }
      const { data } = await api.post(`/invoices/${invoice.id}/checkout/`);
      window.location.assign(data.checkout_url);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  return (
    <div>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-teal-700">BILLING</p><h1 className="mt-2 text-3xl font-bold text-ink">Payments</h1><p className="mt-2 text-slate-500">Clear invoices and secure online checkout.</p></div>
        {canIssue && <button className="btn-primary" onClick={() => setShowForm((value) => !value)}><Plus size={17} />{showForm ? "Close form" : "Create invoice"}</button>}
      </header>
      {notice && <div role="status" className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">{notice}</div>}
      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
      {paymentConfirmation && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onClick={() => setPaymentConfirmation(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="demo-payment-title" className="relative w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.key === "Escape" && setPaymentConfirmation(null)}>
          <button type="button" aria-label="Close confirmation" onClick={() => setPaymentConfirmation(null)} className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
          <CheckCircle2 className="mx-auto text-teal-600" size={54} />
          <h2 id="demo-payment-title" className="mt-4 text-2xl font-bold text-ink">Demo payment successful</h2>
          <p className="mt-2 text-lg font-semibold text-slate-700">{paymentConfirmation.amount}</p>
          <p className="mt-1 text-sm text-slate-500">{paymentConfirmation.description}</p>
          <p className="mt-5 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">This is a demo only. No money was charged and Stripe did not process this payment.</p>
          <button type="button" autoFocus onClick={() => setPaymentConfirmation(null)} className="btn-primary mt-6 w-full">Done</button>
        </section>
      </div>}
      <section className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${stripeConfigured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <LockKeyhole size={18} className={stripeConfigured ? "mt-0.5 text-emerald-700" : "mt-0.5 text-amber-700"} />
        <div><p className="text-sm font-semibold text-ink">{stripeConfigured ? "Stripe secure checkout is connected" : demoMode ? "Demo payment simulator is active" : "Online checkout is not configured"}</p><p className="mt-1 text-sm text-slate-600">{stripeConfigured ? "Card details are entered on Stripe-hosted checkout. VetCare never stores card numbers." : demoMode ? "You can test the invoice flow here. Simulated payments do not charge a card and are not real payment confirmations." : "Add Stripe test keys and a webhook secret to enable card payments. Invoice management remains available."}</p></div>
      </section>
      {showForm && canIssue && <form onSubmit={handleSubmit(createInvoice)} className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <label className="field-label">Pet owner<select className="input mt-2" {...register("owner", { required: true })}><option value="">Select owner</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.first_name} {owner.last_name} · {owner.email}</option>)}</select></label>
        <label className="field-label">Pet<select className="input mt-2" {...register("pet", { required: true })}><option value="">Select pet</option>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label>
        <label className="field-label">Amount (INR)<input className="input mt-2" type="number" min="0.50" step="0.01" {...register("amount", { required: true, min: 0.5 })} /></label>
        <label className="field-label">Description<input className="input mt-2" maxLength={240} {...register("description", { required: true })} /></label>
        <button disabled={isSubmitting} className="btn-primary sm:col-span-2 lg:col-span-4">{isSubmitting ? "Creating…" : "Issue invoice"}</button>
      </form>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><FileText size={18} className="text-teal-700" /><h2 className="font-bold text-ink">{canIssue ? "Clinic invoices" : "Your invoices"}</h2></div><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => loadInvoices().catch((requestError) => setError(getErrorMessage(requestError)))} title="Refresh invoices" aria-label="Refresh invoices"><RefreshCw size={16} /></button></div>
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading invoices…</p> : invoices.length ? <div className="divide-y divide-slate-100">{invoices.map((invoice) => <article key={invoice.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{invoice.description}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${invoice.status === "paid" ? "bg-emerald-50 text-emerald-800" : invoice.status === "demo_paid" ? "bg-sky-50 text-sky-800" : invoice.status === "void" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800"}`}>{invoice.status === "demo_paid" ? "Demo paid · no charge" : invoice.status}</span></div><p className="mt-1 text-sm text-slate-500">{invoice.pet_name} · {canIssue ? invoice.owner_name : invoice.clinic_name} · {new Date(invoice.created_at).toLocaleDateString()}</p></div>
          <div className="flex items-center gap-4"><p className="font-bold tabular-nums text-ink">{formatMoney(invoice.amount_cents, invoice.currency)}</p>{!canIssue && invoice.status === "open" && <button className="btn-primary" disabled={!stripeConfigured && !demoMode} onClick={() => startPayment(invoice)}><CreditCard size={16} />{stripeConfigured ? "Pay invoice" : "Simulate payment"}</button>}{["paid", "demo_paid"].includes(invoice.status) && <span className="text-xs text-slate-500">{invoice.status === "demo_paid" ? "Simulation only" : "Paid"} {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : ""}</span>}</div>
        </article>)}</div> : <div className="py-16 text-center"><FileText className="mx-auto text-slate-300" size={28} /><p className="mt-3 font-semibold text-ink">No invoices yet</p><p className="mt-1 text-sm text-slate-500">{canIssue ? "Invoices you issue will appear here." : "Your clinic invoices will appear here."}</p></div>}
      </div>
      {canIssue && <p className="mt-4 flex items-center gap-2 text-xs leading-5 text-slate-500"><ArrowUpRight size={14} />New invoice amounts are recorded in INR paise and cannot be edited after issue.</p>}
    </div>
  );
}