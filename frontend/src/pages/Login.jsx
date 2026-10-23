import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { PawPrint } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "../auth/AuthContext";
import { getErrorMessage } from "../api";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();
  if (user) return <Navigate to="/" replace />;

  async function onSubmit(values) {
    setError("");
    setSubmitting(true);
    try {
      await login(values);
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><PawPrint /></span><span className="text-lg font-bold">VetCare</span></div>
        <div className="max-w-lg"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-teal-100">Care, connected</p><h1 className="text-5xl font-semibold leading-tight">A calmer way to care for every patient.</h1><p className="mt-6 text-lg leading-8 text-white/70">Keep appointments, pet profiles, and veterinarian-approved care notes together in one place.</p></div>
        <p className="text-sm text-white/50">Veterinary care management workspace</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-600 text-white"><PawPrint /></span><span className="font-bold text-ink">VetCare</span></div>
          <p className="text-sm font-semibold text-teal-700">Welcome back</p>
          <h2 className="mt-2 text-3xl font-bold text-ink">Sign in to VetCare</h2>
          <p className="mt-2 text-sm text-slate-500">Use your clinic or pet owner account.</p>
          {error && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <label className="block text-sm font-medium text-slate-700">Username<input autoComplete="username" className="input mt-2" {...register("username", { required: "Enter your username." })} />{errors.username && <span className="form-error">{errors.username.message}</span>}</label>
            <label className="block text-sm font-medium text-slate-700">Password<input type="password" autoComplete="current-password" className="input mt-2" {...register("password", { required: "Enter your password." })} />{errors.password && <span className="form-error">{errors.password.message}</span>}</label>
            <button disabled={submitting} className="btn-primary w-full">{submitting ? "Signing in…" : "Sign in"}</button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">New here? <Link className="font-semibold text-teal-700 hover:underline" to="/register">Create a pet owner account</Link></p>
        </div>
      </section>
    </div>
  );
}
