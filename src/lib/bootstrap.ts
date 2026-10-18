import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { qk } from './queries';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent_id: string | null;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Difficulty {
  id: string;
  name: string;
  slug: string;
}

export interface Bootstrap {
  categories: Category[];
  tags: Tag[];
  difficulties: Difficulty[];
  features: Record<string, boolean>;
  maintenance: { enabled: boolean; message: string };
  rules: {
    quiz: Record<string, number | boolean>;
    poll: Record<string, number | boolean>;
    rewards: Record<string, number>;
    guidelines: string;
  };
}

const FALLBACK: Bootstrap = {
  categories: [],
  tags: [],
  difficulties: [],
  features: {},
  maintenance: { enabled: false, message: '' },
  rules: { quiz: {}, poll: {}, rewards: {}, guidelines: '' },
};

export function useBootstrap(): Bootstrap {
  const { data } = useQuery<Bootstrap>({
    queryKey: qk.bootstrap,
    queryFn: () => api.get<Bootstrap>('/meta/bootstrap'),
    staleTime: 60_000,
  });
  return data ?? FALLBACK;
}
