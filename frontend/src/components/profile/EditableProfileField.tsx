import ClearableTextInput from '@/components/ui/ClearableTextInput'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SectionEyebrow from '@/components/ui/SectionEyebrow'

type EditableProfileFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  isDirty: boolean
  onSave: () => void
  isSaving?: boolean
  status?: string
  className?: string
  rowClassName?: string
  inputClassName?: string
}

export default function EditableProfileField({
  label,
  value,
  onChange,
  isDirty,
  onSave,
  isSaving = false,
  status,
  className = '',
  rowClassName = '',
  inputClassName = '',
}: EditableProfileFieldProps) {
  const wrapperClass = className.trim()
  const rowClasses = `mt-2 flex items-center gap-2 ${rowClassName}`.trim()
  const textInputClasses = `bg-[rgba(var(--votuna-paper),0.85)] text-[rgb(var(--votuna-ink))]`.trim()
  const inputContainerClasses = (inputClassName || 'flex-1').trim()

  return (
    <div className={wrapperClass}>
      <SectionEyebrow className="tracking-[0.2em]">{label}</SectionEyebrow>
      <div className={rowClasses}>
        <ClearableTextInput
          value={value}
          onValueChange={onChange}
          className={textInputClasses}
          containerClassName={inputContainerClasses}
          clearAriaLabel={`Clear ${label.toLowerCase()}`}
        />
        {isDirty ? (
          <PrimaryButton onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </PrimaryButton>
        ) : null}
      </div>
      {status ? (
        <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">{status}</p>
      ) : null}
    </div>
  )
}
