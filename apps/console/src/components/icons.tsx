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
  MdOutlineStarBorder,
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
      <path
        fillRule="evenodd"
        d="M1 1h18v18H1Z M7.6 7.7a1.6 1.6 0 0 0 -3.2 0v3a1.6 1.6 0 0 0 3.2 0Z M15.6 7.7a1.6 1.6 0 0 0 -3.2 0v3a1.6 1.6 0 0 0 3.2 0Z"
      />
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
  Star: MdOutlineStarBorder,
  Status: MdOutlineSpaceDashboard,
};
