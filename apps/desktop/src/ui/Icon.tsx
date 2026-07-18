import type { ReactNode, SVGProps } from "react";

type IconName =
  | "close"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "clipboard"
  | "camera"
  | "settings"
  | "bell";

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "name" | "width" | "height" | "children">;

const paths: Record<IconName, ReactNode> = {
  close: (
    <path
      d="M9 9l6 6M15 9l-6 6"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  ),
  chevronDown: (
    <path
      d="M6 9l6 6 6-6"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  chevronLeft: (
    <path
      d="M14 6l-6 6 6 6"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  chevronRight: (
    <path
      d="M10 6l6 6-6 6"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  clipboard: (
    <>
      <rect
        x="8"
        y="7"
        width="10"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
      />
      <path
        d="M10 7V6a2 2 0 012-2h2a2 2 0 012 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
      />
    </>
  ),
  camera: (
    <>
      <path
        d="M5 9h2l1.2-1.8A2 2 0 019.8 6h4.4a2 2 0 011.6.8L17 9h2a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="3" stroke="currentColor" strokeWidth="1.75" fill="none" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" fill="none" />
      <path
        d="M12 3.5v2M12 18.5v2M4.9 6.5l1.4 1.4M17.7 16.1l1.4 1.4M3.5 12h2M18.5 12h2M4.9 17.5l1.4-1.4M17.7 7.9l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
  bell: (
    <path
      d="M12 4a5 5 0 015 5v3.2l1.2 2.4H5.8L7 12.2V9a5 5 0 015-5zm-2.2 13a2.2 2.2 0 004.4 0"
      stroke="currentColor"
      strokeWidth="1.75"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

export function Icon({ name, size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className ? `ui-icon ${className}` : "ui-icon"}
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}

export function ModalCloseButton({
  onClick,
  className = "modal__close",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={className} aria-label="关闭" onClick={onClick}>
      <Icon name="close" size={14} />
    </button>
  );
}
