import type { ImportTemplate } from '../../domain/types';

export type TemplatesRepository = {
  list(): Promise<ImportTemplate[]>;
};

export const templatesRepository: TemplatesRepository = {
  async list() {
    throw new Error('templatesRepository.list is not implemented yet.');
  },
};
