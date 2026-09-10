import type { SVGProps } from 'react'

/** 统一的内联图标集（1.5px 描边，扁平风格），避免引入图标库 */
type IconProps = SVGProps<SVGSVGElement>

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const MoonIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </Base>
)

export const SunIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
)

export const SearchIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
)

export const PenIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Base>
)

export const EyeIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
)

export const CommentIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4A9 9 0 0 1 3.5 12 8.4 8.4 0 0 1 12 3.5a8.4 8.4 0 0 1 9 8Z" />
    <path d="M8 20l1-3" />
  </Base>
)

export const TagIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12.6 3H5a2 2 0 0 0-2 2v7.6a2 2 0 0 0 .6 1.4l7.4 7.4a2 2 0 0 0 2.8 0l6.6-6.6a2 2 0 0 0 0-2.8L13.9 3.6A2 2 0 0 0 12.6 3Z" />
    <circle cx="8" cy="8" r="1.4" />
  </Base>
)

export const ClockIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
)

export const CalendarIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Base>
)

export const ArrowLeftIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Base>
)

export const ArrowRightIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
)

export const ChevronLeftIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m15 18-6-6 6-6" />
  </Base>
)

export const ChevronRightIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m9 18 6-6-6-6" />
  </Base>
)

export const TrashIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    <path d="M10 11v5M14 11v5" />
  </Base>
)

export const CloseIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Base>
)

export const CheckIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m20 6-11 11-5-5" />
  </Base>
)

export const CopyIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Base>
)

export const MenuIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
)

export const LinkIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </Base>
)

export const UserIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Base>
)

export const LogoutIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </Base>
)

export const ArchiveIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="5" rx="1" />
    <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
  </Base>
)

export const AlertIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5v.01" />
  </Base>
)

export const InboxIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 12h5l2 3h4l2-3h5" />
    <path d="M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z" />
  </Base>
)
