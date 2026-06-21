import React, { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import Input from '../../components/common/Input/Input';
import Button from '../../components/common/Button/Button';
import PawLoader from '../../components/common/PawLoader/PawLoader';
import logoPawBuddy from '../../assets/images/LogoPawBuddy.png';
import styles from './Login.module.scss';

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  form?: string;
}

// ─── Inline SVG paw print ─────────────────────────────────────────────────────

function PawSvg() {
  return (
    <svg
      className={styles.pawSvg}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* toe pads */}
      <ellipse cx="28" cy="32" rx="11" ry="14" fill="currentColor" opacity="0.9" />
      <ellipse cx="54" cy="22" rx="11" ry="14" fill="currentColor" opacity="0.9" />
      <ellipse cx="80" cy="26" rx="11" ry="14" fill="currentColor" opacity="0.9" />
      <ellipse cx="100" cy="42" rx="10" ry="13" fill="currentColor" opacity="0.9" />
      {/* main pad */}
      <path
        d="M20 75 C18 55 32 44 50 46 C58 47 64 52 70 52 C80 52 94 58 96 76 C99 95 82 108 60 108 C38 108 22 95 20 75Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading } = useClinicAuth();

  const [formData, setFormData]         = useState<FormData>({ email: '', password: '' });
  const [errors, setErrors]             = useState<FormErrors>({});
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [failCount, setFailCount]       = useState(0);
  const [cooldown, setCooldown]         = useState(0); // seconds remaining

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name in errors) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const next: FormErrors = {};
    if (!formData.email) {
      next.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      next.email = 'Email is invalid';
    }
    if (!formData.password) {
      next.password = 'Password is required';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (cooldown > 0 || !validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      await login(formData.email, formData.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Login failed. Please check your credentials.';
      setErrors({ form: message });
      const next = failCount + 1;
      setFailCount(next);
      if (next >= 5) {
        setCooldown(30);
        setFailCount(0);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    {loading && <PawLoader size="large" overlay />}
    <div className={`container-fluid p-0 ${styles.pageWrapper}`}>
      <div className="row g-0" style={{ minHeight: '100vh' }}>

        {/* ── Left hero ── */}
        <div className={`col-lg-6 d-none d-lg-flex ${styles.hero}`}>
          <div className={styles.blobTop} />
          <div className={styles.blobBottom} />

          {/* company logo */}
          <div className={styles.heroLogo}>
            <img src={logoPawBuddy} alt="Paw Buddy" className={styles.heroLogoImg} />
          </div>

          {/* center visual */}
          <div className={styles.heroVisual}>
            {/* paw glow ring */}
            <div className={styles.pawGlow}>
              <PawSvg />
            </div>

            <div className={styles.heroBadge}>
              <i className="bi bi-plus-circle-fill" />
              Veterinary Staff Portal
            </div>

            <p className={styles.tagline}>Care that goes beyond the clinic</p>
            <p className={styles.subtagline}>
              Manage your branches, staff, and clinic settings all in one place.
            </p>

            {/* horizontal feature pills */}
            <div className={styles.pills}>
              <div className={styles.pill}>
                <i className="bi bi-building" />
                <span>Branches</span>
              </div>
              <div className={styles.pill}>
                <i className="bi bi-people-fill" />
                <span>Staff</span>
              </div>
              <div className={styles.pill}>
                <i className="bi bi-heart-pulse-fill" />
                <span>Pet Care</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right form ── */}
        <div className="col-lg-6 d-flex align-items-center justify-content-center">
          <div className="w-100 px-3 px-lg-5 form-slide-in">
            <div className="position-relative my-5 mx-auto" style={{ maxWidth: '480px' }}>

              {/* floating paw icon above card */}
              <div className={styles.cardIconWrap}>
                <div className={styles.cardIconCircle}>
                  <i className="bi bi-heart-pulse-fill" />
                </div>
              </div>

              {/* form card */}
              <div className={`bg-white rounded-4 ${styles.formCard}`}>
                <div className="text-center mb-4">
                  <h2 className="fw-bold mb-2">Clinic Login</h2>
                  <p className="text-muted mb-0">Sign in to the clinic staff portal</p>
                </div>

                {errors.form && (
                  <div className="alert alert-danger py-2" role="alert">
                    {errors.form}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <Input
                    label="Email"
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                    icon="bi-envelope"
                    disabled={loading}
                    autoComplete="email"
                  />

                  <div className={styles.passwordWrapper}>
                    <Input
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleChange}
                      error={errors.password}
                      disabled={loading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowPassword((prev) => !prev)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <i className={`bi bi-eye${showPassword ? '-slash' : ''}`} />
                    </button>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="large"
                    fullWidth
                    disabled={loading || cooldown > 0}
                  >
                    {cooldown > 0 ? `Try again in ${cooldown}s` : 'Log in'}
                  </Button>
                </form>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
    </>
  );
}
