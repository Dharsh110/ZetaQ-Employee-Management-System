export type SubTeam = { id: string; name: string; };

export type DeptDef = {
  id: string;
  name: string;
  icon: string;
  color: string;
  head: string;
  headcount: number;
  budget: string;
  status: 'active' | 'inactive';
  created: string;
  subTeams: SubTeam[];
};

export const DEPARTMENTS: DeptDef[] = [
  {
    id: 'D001', name: 'Engineering', icon: '⚙️', color: 'bg-blue-500',
    head: 'Ravi Kumar', headcount: 12, budget: '₹24L', status: 'active', created: '2022-01-01',
    subTeams: [
      { id: 'frontend', name: 'Frontend' },
      { id: 'backend',  name: 'Backend'  },
      { id: 'qa',       name: 'QA'       },
      { id: 'devops',   name: 'DevOps'   },
      { id: 'dba',      name: 'DBA'      },
    ],
  },
  {
    id: 'D002', name: 'Product', icon: '📦', color: 'bg-indigo-500',
    head: 'Arjun Mehta', headcount: 4, budget: '₹8L', status: 'active', created: '2022-01-01',
    subTeams: [],
  },
  {
    id: 'D003', name: 'Design', icon: '🎨', color: 'bg-pink-500',
    head: 'Deepa Nair', headcount: 4, budget: '₹6L', status: 'active', created: '2022-03-15',
    subTeams: [],
  },
  {
    id: 'D004', name: 'HR', icon: '👥', color: 'bg-emerald-500',
    head: 'Priya Sharma', headcount: 3, budget: '₹5L', status: 'active', created: '2022-01-01',
    subTeams: [],
  },
  {
    id: 'D005', name: 'Sales & Marketing', icon: '📈', color: 'bg-amber-500',
    head: 'Mohan Das', headcount: 5, budget: '₹7L', status: 'active', created: '2022-06-01',
    subTeams: [],
  },
  {
    id: 'D006', name: 'Finance', icon: '💰', color: 'bg-teal-500',
    head: 'Sneha Iyer', headcount: 4, budget: '₹6L', status: 'active', created: '2022-03-15',
    subTeams: [],
  },
  {
    id: 'D007', name: 'Support', icon: '🎧', color: 'bg-orange-500',
    head: 'Sunita Pillai', headcount: 4, budget: '₹4L', status: 'active', created: '2023-01-01',
    subTeams: [],
  },
  {
    id: 'D008', name: 'Security', icon: '🔒', color: 'bg-red-500',
    head: 'Vijay Anand', headcount: 3, budget: '₹5L', status: 'active', created: '2023-06-01',
    subTeams: [],
  },
];

export const DEPT_NAMES = DEPARTMENTS.map(d => d.name);

export const DEPT_WITH_SUBTEAMS: string[] = DEPARTMENTS.flatMap(d =>
  d.subTeams.length > 0
    ? [d.name, ...d.subTeams.map(s => `${d.name} – ${s.name}`)]
    : [d.name]
);

export const getDept = (name: string) => DEPARTMENTS.find(d => d.name === name);

export const ENGINEERING_SUBTEAMS = DEPARTMENTS.find(d => d.name === 'Engineering')?.subTeams ?? [];
