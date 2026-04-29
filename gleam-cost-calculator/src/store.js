import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const defaultPlatforms = [
  { name: '即梦 AI', rate: 100, active: true },
  { name: '可灵 AI', rate: 66, active: false },
  { name: 'Midjourney', rate: 50, active: false },
  { name: 'Runway', rate: 40, active: false },
];

const defaultRoles = [
  { name: '编剧', count: 1, salary: 12000, hrsPerEp: 4, dayHrs: 8 },
  { name: '导演', count: 1, salary: 15000, hrsPerEp: 3, dayHrs: 8 },
  { name: '美术/提示词', count: 1, salary: 10000, hrsPerEp: 2, dayHrs: 8 },
  { name: '后期剪辑', count: 1, salary: 10000, hrsPerEp: 2, dayHrs: 8 },
  { name: '制片统筹', count: 1, salary: 12000, hrsPerEp: 1, dayHrs: 8 },
];

const defaultProjects = [
  {
    name: 'Fractured Recall S1', eps: 20, days: 30, scriptCost: 0,
    revPlat: 800, revBrand: 50000, revLic: 30000, revMerch: 10000, revViews: 500, revCpm: 8,
  },
];

const defaultGlobalConfig = { aiRate: 5, aiDur: 120, shotRatio: 3.0, aiImgPts: 10, aiImgN: 80, cSoft: 2000, cServer: 1500, cMisc: 3000 };

// Migrate old localStorage keys from single-file version
function migrateFromOldKeys() {
  const SK = { plat: 'gleam_v3_plat', roles: 'gleam_v3_roles', global: 'gleam_v3_global', proj: 'gleam_v3_proj' };
  const result = {};
  try {
    const plat = localStorage.getItem(SK.plat);
    if (plat) result.platforms = JSON.parse(plat);
    const roles = localStorage.getItem(SK.roles);
    if (roles) result.roles = JSON.parse(roles);
    const global = localStorage.getItem(SK.global);
    if (global) result.globalConfig = JSON.parse(global);
    const proj = localStorage.getItem(SK.proj);
    if (proj) result.projects = JSON.parse(proj);
  } catch (e) { /* ignore */ }
  return result;
}

const migrated = migrateFromOldKeys();

const useStore = create(
  persist(
    (set) => ({
      platforms: migrated.platforms || defaultPlatforms,
      roles: migrated.roles || defaultRoles,
      globalConfig: migrated.globalConfig || defaultGlobalConfig,
      projects: migrated.projects || defaultProjects,

      setPlatforms: (platforms) => set({ platforms }),
      setRoles: (roles) => set({ roles }),
      setGlobalConfig: (globalConfig) => set({ globalConfig }),
      setProjects: (projects) => set({ projects }),

      updateProject: (index, patch) =>
        set((state) => ({ projects: state.projects.map((p, i) => i === index ? { ...p, ...patch } : p) })),
      deleteProject: (index) =>
        set((state) => ({ projects: state.projects.filter((_, i) => i !== index) })),
      addProject: (project) =>
        set((state) => ({ projects: [...state.projects, project] })),

      addPlatform: (platform) =>
        set((state) => ({ platforms: [...state.platforms, platform] })),
      deletePlatform: (index) =>
        set((state) => ({ platforms: state.platforms.filter((_, i) => i !== index) })),
      updatePlatform: (index, patch) =>
        set((state) => ({ platforms: state.platforms.map((p, i) => i === index ? { ...p, ...patch } : p) })),
      setActivePlatform: (index) =>
        set((state) => ({ platforms: state.platforms.map((p, i) => ({ ...p, active: i === index })) })),

      addRole: (role) =>
        set((state) => ({ roles: [...state.roles, role] })),
      deleteRole: (index) =>
        set((state) => ({ roles: state.roles.filter((_, i) => i !== index) })),
      updateRole: (index, patch) =>
        set((state) => ({ roles: state.roles.map((r, i) => i === index ? { ...r, ...patch } : r) })),
    }),
    {
      name: 'gleam_v4_store',
      partialize: (state) => ({
        platforms: state.platforms,
        roles: state.roles,
        globalConfig: state.globalConfig,
        projects: state.projects,
      }),
    }
  )
);

export default useStore;
