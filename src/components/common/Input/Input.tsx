import type { InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: string;
}

export default function Input({
  label,
  type = 'text',
  error,
  icon,
  required,
  ...rest
}: InputProps) {
  const inputCls = [
    styles.input,
    error ? styles.error : '',
    icon ? styles.hasIcon : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.inputGroup}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}

      <div className={styles.inputWrapper}>
        {icon && <i className={`bi ${icon} ${styles.icon}`} />}
        <input
          type={type}
          className={inputCls}
          required={required}
          {...rest}
        />
      </div>

      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
}
