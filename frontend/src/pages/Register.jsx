import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../auth/AuthContext";
import { api, getErrorMessage } from "../api";

export default function Register() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  if (user) return <Navigate to="/" replace />;

  async function onSubmit(values) {
    setError("");
    setSubmitting(true);
    try {
      const { password, confirmPassword, ...profile } = values;
      await api.post("/auth/register/", { ...profile, password });
      await login({ username: values.username, password });
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#f6faf9] p-5">
      <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-card md:p-10">
        <p className="text-sm font-semibold text-teal-700">Pet owner account</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Create your account</h1>
        <p className="mt-2 text-sm text-slate-500">Register to manage your pets and request appointments.</p>
        {error && <div role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-7 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">First name<input className="input mt-2" {...register("first_name", { required: "Enter your first name." })} />{errors.first_name && <span className="form-error">{errors.first_name.message}</span>}</label>
          <label className="text-sm font-medium text-slate-700">Last name<input className="input mt-2" {...register("last_name", { required: "Enter your last name." })} />{errors.last_name && <span className="form-error">{errors.last_name.message}</span>}</label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Username<input autoComplete="username" className="input mt-2" {...register("username", { required: "Choose a username." })} />{errors.username && <span className="form-error">{errors.username.message}</span>}</label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Email<input type="email" autoComplete="email" className="input mt-2" {...register("email", { required: "Enter your email." })} />{errors.email && <span className="form-error">{errors.email.message}</span>}</label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Phone <span className="font-normal text-slate-400">(optional)</span><input type="tel" className="input mt-2" {...register("phone")} /></label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Password<input type="password" autoComplete="new-password" className="input mt-2" {...register("password", { required: "Create a password.", minLength: { value: 8, message: "Use at least 8 characters." } })} />{errors.password && <span className="form-error">{errors.password.message}</span>}</label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Confirm password<input type="password" autoComplete="new-password" className="input mt-2" {...register("confirmPassword", { validate: (value) => value === watch("password") || "Passwords do not match." })} />{errors.confirmPassword && <span className="form-error">{errors.confirmPassword.message}</span>}</label>
          <button disabled={submitting} className="btn-primary mt-2 sm:col-span-2">{submitting ? "Creating account…" : "Create account"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link className="font-semibold text-teal-700 hover:underline" to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
