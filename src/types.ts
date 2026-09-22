export type Category = 'small-apps' | 'tools' | 'libraries' | 'games' | 'experiments';
export interface Project {
  fullName: string;
  name: string;
  description: string | null;
  category: Category;
  order: number;
  githubUrl: string;
  homepageUrl: string | null;
  archived: boolean;
  readmeUrl: string | null;
  readmeSourceUrl: string | null;
}
