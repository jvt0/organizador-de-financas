import type { ImportedFile } from '../../domain/types';

export type FilesRepository = {
  list(): Promise<ImportedFile[]>;
};

export const filesRepository: FilesRepository = {
  async list() {
    throw new Error('filesRepository.list is not implemented yet.');
  },
};
