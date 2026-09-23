import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode, useId } from 'react'

interface BaseFieldProps {
  label: string
  help?: string
  error?: string
  required?: boolean
}

const inputBase = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  color: '#1A1A1A',
  backgroundColor: '#FFFFFF',
  border: '1px solid #E0E0E0',
  borderRadius: 6,
  outline: 'none',
  transition: 'border-color 0.15s',
  lineHeight: 1.5,
}

function FieldWrapper({
  label, help, error, required, fieldId, children,
}: BaseFieldProps & { fieldId: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label htmlFor={fieldId} style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>
        {label}
        {required && <span style={{ color: '#B3261E', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && (
        <p style={{ fontSize: 12, color: '#B3261E', margin: 0 }}>{error}</p>
      )}
      {!error && help && (
        <p style={{ fontSize: 12, color: '#5C5C5C', margin: 0 }}>{help}</p>
      )}
    </div>
  )
}

export function TextField({
  label, help, error, required, id, ...props
}: BaseFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldWrapper label={label} help={help} error={error} required={required} fieldId={fieldId}>
      <input
        id={fieldId}
        {...props}
        style={{
          ...inputBase,
          borderColor: error ? '#B3261E' : '#E0E0E0',
        }}
        onFocus={e => {
          e.target.style.borderColor = error ? '#B3261E' : '#1E4B8F'
          e.target.style.boxShadow = `0 0 0 3px ${error ? '#FDECEA' : '#EBF0F9'}`
        }}
        onBlur={e => {
          e.target.style.borderColor = error ? '#B3261E' : '#E0E0E0'
          e.target.style.boxShadow = 'none'
        }}
      />
    </FieldWrapper>
  )
}

export function SelectField({
  label, help, error, required, id, children, ...props
}: BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldWrapper label={label} help={help} error={error} required={required} fieldId={fieldId}>
      <select
        id={fieldId}
        {...props}
        style={{
          ...inputBase,
          borderColor: error ? '#B3261E' : '#E0E0E0',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%235C5C5C' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: 32,
        }}
      >
        {children}
      </select>
    </FieldWrapper>
  )
}

export function TextareaField({
  label, help, error, required, id, ...props
}: BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldWrapper label={label} help={help} error={error} required={required} fieldId={fieldId}>
      <textarea
        id={fieldId}
        {...props}
        rows={props.rows ?? 4}
        style={{
          ...inputBase,
          borderColor: error ? '#B3261E' : '#E0E0E0',
          resize: 'vertical',
          minHeight: 88,
        }}
        onFocus={e => {
          e.target.style.borderColor = error ? '#B3261E' : '#1E4B8F'
          e.target.style.boxShadow = `0 0 0 3px ${error ? '#FDECEA' : '#EBF0F9'}`
        }}
        onBlur={e => {
          e.target.style.borderColor = error ? '#B3261E' : '#E0E0E0'
          e.target.style.boxShadow = 'none'
        }}
      />
    </FieldWrapper>
  )
}
