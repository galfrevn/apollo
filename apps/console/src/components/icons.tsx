import {
  MdOutlineClose,
  MdOutlineDescription,
  MdOutlineExtension,
  MdOutlineLogout,
  MdOutlinePsychology,
  MdOutlineQuestionAnswer,
  MdOutlineSchedule,
  MdOutlineSearch,
  MdOutlineSpaceDashboard,
  MdOutlineSpeaker,
} from 'react-icons/md';
import type { IconBaseProps } from 'react-icons';

function LogoMark({ size = 20, ...props }: IconBaseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <rect x="1" y="1" width="8.5" height="8.5" />
      <rect x="10.5" y="1" width="8.5" height="8.5" opacity="0.45" />
      <rect x="1" y="10.5" width="8.5" height="8.5" opacity="0.45" />
      <rect x="10.5" y="10.5" width="8.5" height="8.5" opacity="0.18" />
    </svg>
  );
}

export const Icons = {
  Close: MdOutlineClose,
  Device: MdOutlineSpeaker,
  History: MdOutlineQuestionAnswer,
  Jobs: MdOutlineDescription,
  LogoMark,
  Logout: MdOutlineLogout,
  Mcp: MdOutlineExtension,
  Memory: MdOutlinePsychology,
  Schedules: MdOutlineSchedule,
  Search: MdOutlineSearch,
  Status: MdOutlineSpaceDashboard,
};
