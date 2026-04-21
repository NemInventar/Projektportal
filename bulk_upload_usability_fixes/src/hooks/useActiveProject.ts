import { useProject } from '@/contexts/ProjectContext';

export const useActiveProject = () => {
  const { activeProject } = useProject();
  return { activeProject };
};