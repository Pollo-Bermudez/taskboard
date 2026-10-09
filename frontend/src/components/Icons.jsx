// Iconos de trazo regular al estilo Phosphor (el set que pide Nocturne), en línea para no depender de otra librería.
function Icon({ size = 18, strokeWidth = 16, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const LogoIcon = (p) => (
  <Icon size={22} stroke="var(--color-accent)" {...p}><rect x="40" y="40" width="176" height="176" rx="8" /><path d="M96 40v176M160 40v120" /></Icon>
);
export const KanbanIcon = (p) => (
  <Icon {...p}><rect x="32" y="48" width="56" height="160" rx="8" /><rect x="100" y="48" width="56" height="112" rx="8" /><rect x="168" y="48" width="56" height="136" rx="8" /></Icon>
);
export const GridIcon = (p) => (
  <Icon {...p}><rect x="40" y="40" width="72" height="72" rx="8" /><rect x="144" y="40" width="72" height="72" rx="8" /><rect x="40" y="144" width="72" height="72" rx="8" /><rect x="144" y="144" width="72" height="72" rx="8" /></Icon>
);
export const PlusIcon = (p) => <Icon size={16} strokeWidth={18} {...p}><path d="M128 40v176M40 128h176" /></Icon>;
export const CaretLeftIcon = (p) => <Icon size={15} strokeWidth={18} {...p}><path d="M160 208 80 128l80-80" /></Icon>;
export const CaretRightIcon = (p) => <Icon size={15} strokeWidth={18} {...p}><path d="m96 48 80 80-80 80" /></Icon>;
export const PencilIcon = (p) => (
  <Icon size={15} {...p}><path d="M92.7 216H48v-44.7a8 8 0 0 1 2.3-5.6l120-120a8 8 0 0 1 11.4 0l44.6 44.6a8 8 0 0 1 0 11.4l-120 120a8 8 0 0 1-5.6 2.3ZM136 64l56 56" /></Icon>
);
export const TrashIcon = (p) => (
  <Icon size={15} {...p}><path d="M216 56H40M104 104v64M152 104v64M200 56v152a8 8 0 0 1-8 8H64a8 8 0 0 1-8-8V56M168 56V40a16 16 0 0 0-16-16h-48a16 16 0 0 0-16 16v16" /></Icon>
);
export const SignOutIcon = (p) => <Icon size={16} {...p}><path d="M112 40H48v176h64M174 86l42 42-42 42M104 128h112" /></Icon>;
export const XIcon = (p) => <Icon size={16} strokeWidth={18} {...p}><path d="M200 56 56 200M200 200 56 56" /></Icon>;
export const LockIcon = (p) => <Icon {...p}><rect x="40" y="88" width="176" height="128" rx="8" /><path d="M88 88V56a40 40 0 0 1 80 0v32" /></Icon>;
export const WarningIcon = (p) => <Icon {...p}><circle cx="128" cy="128" r="96" /><path d="M128 80v56M128 172v1" /></Icon>;
export const CheckIcon = (p) => <Icon strokeWidth={18} {...p}><path d="m40 136 56 56L216 72" /></Icon>;
export const OfflineIcon = (p) => <Icon size={20} {...p}><path d="M48 104a128 128 0 0 1 160 0M80 140a80 80 0 0 1 96 0M116 176a24 24 0 0 1 24 0M40 40l176 176" /></Icon>;
export const ListIcon = (p) => <Icon size={20} {...p}><path d="M40 128h176M40 64h176M40 192h176" /></Icon>;
