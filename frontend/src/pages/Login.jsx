
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  PawPrint,
  Eye,
  EyeOff,
  Sparkles,
  LogIn,
  Loader2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "../auth/AuthContext";
import { getErrorMessage } from "../api";

const DEMO_CREDENTIALS = {
  username: "demo-owner",
  password: "VetCareDemo2026!",
};

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  if (user) return <Navigate to="/" replace />;

  async function authenticate(credentials) {
    setError("");
    setSubmitting(true);

    try {
      await login(credentials);
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(values) {
    await authenticate(values);
  }

  async function loginAsDemo() {
    await authenticate(DEMO_CREDENTIALS);
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">

      {/* Left branding section */}
      <section className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">

        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
            <PawPrint />
          </span>
          <span className="text-lg font-bold">VetCare</span>
        </div>

        <div className="max-w-lg">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-teal-100">
            Care, connected
          </p>

          <h1 className="text-5xl font-semibold leading-tight">
            A calmer way to care for every patient.
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/70">
            Keep appointments, pet profiles, veterinarian-approved
            care notes and payments together in one place.
          </p>
        </div>

        <p className="text-sm text-white/50">
          Veterinary care management workspace
        </p>
      </section>

      {/* Login section */}
      <section className="flex items-center justify-center p-6">

        <div className="w-full max-w-md">

          {/* Mobile branding */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-600 text-white">
              <PawPrint />
            </span>
            <span className="font-bold text-ink">VetCare</span>
          </div>

          <p className="text-sm font-semibold text-teal-700">
            Welcome back
          </p>

          <h2 className="mt-2 text-3xl font-bold text-ink">
            Sign in to VetCare
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Use your clinic or pet owner account.
          </p>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
            >
              {error}
            </div>
          )}

          {/* Login form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-8 space-y-5"
          >

            <label className="block text-sm font-medium text-slate-700">
              Username

              <input
                autoComplete="username"
                autoFocus
                disabled={submitting}
                className="input mt-2"
                placeholder="Enter your username"
                {...register("username", {
                  required: "Enter your username.",
                })}
              />

              {errors.username && (
                <span className="form-error">
                  {errors.username.message}
                </span>
              )}
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Password

              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  disabled={submitting}
                  className="input pr-12"
                  placeholder="Enter your password"
                  {...register("password", {
                    required: "Enter your password.",
                  })}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-teal-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>

              {errors.password && (
                <span className="form-error">
                  {errors.password.message}
                </span>
              )}
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign in
                </>
              )}
            </button>

          </form>

          {/* Demo login */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">
              OR EXPLORE THE DEMO
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={loginAsDemo}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 font-semibold text-teal-800 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Sparkles size={18} />
            )}

            {submitting
              ? "Opening demo..."
              : "Explore as Demo Pet Owner"}
          </button>

          <p className="mt-3 text-center text-xs text-slate-500">
            Explore the application using a pre-registered
            demonstration account.
          </p>

          {/* Registration */}
          <p className="mt-8 text-center text-sm text-slate-500">
            New here?{" "}
            <Link
              className="font-semibold text-teal-700 hover:underline"
              to="/register"
            >
              Create a pet owner account
            </Link>
          </p>

          <p className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} VetCare.
            Veterinary care management workspace.
          </p>

        </div>
      </section>
    </div>
  );
}
