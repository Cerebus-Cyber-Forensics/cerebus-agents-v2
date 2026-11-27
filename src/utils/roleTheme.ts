import { UserRole } from '../types';

export interface RoleShadeTheme {
  label: string;
  cardBg: string;
  cardBorder: string;
  avatarBg: string;
  nameText: string;
  emailText: string;
  roleText: string;
  dotBg: string;
  rowAccent: string;
}

const ROLE_SHADE_THEMES: Record<UserRole, RoleShadeTheme> = {
  admin: {
    label: 'Admin',
    cardBg: 'bg-indigo-50/90',
    cardBorder: 'border-indigo-200',
    avatarBg: 'bg-[#0812B8] text-white',
    nameText: 'text-indigo-950',
    emailText: 'text-indigo-700',
    roleText: 'text-[#0812B8]',
    dotBg: 'bg-[#0812B8]',
    rowAccent: 'bg-indigo-50/50 text-[#0812B8] border-indigo-200',
  },
  team_leader: {
    label: 'Team Leader',
    cardBg: 'bg-amber-50/90',
    cardBorder: 'border-amber-200',
    avatarBg: 'bg-amber-600 text-white',
    nameText: 'text-amber-950',
    emailText: 'text-amber-800',
    roleText: 'text-amber-800',
    dotBg: 'bg-amber-600',
    rowAccent: 'bg-amber-50/60 text-amber-900 border-amber-200',
  },
  agent: {
    label: 'Agent',
    cardBg: 'bg-emerald-50/90',
    cardBorder: 'border-emerald-200',
    avatarBg: 'bg-emerald-700 text-white',
    nameText: 'text-emerald-950',
    emailText: 'text-emerald-800',
    roleText: 'text-emerald-800',
    dotBg: 'bg-emerald-600',
    rowAccent: 'bg-emerald-50/60 text-emerald-900 border-emerald-200',
  },
};

export function getUserRoleTheme(role: UserRole): RoleShadeTheme {
  return ROLE_SHADE_THEMES[role] ?? ROLE_SHADE_THEMES.agent;
}
