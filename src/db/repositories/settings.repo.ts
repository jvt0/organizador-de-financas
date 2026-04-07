import type { AppSetting } from '../../domain/types';

export type SettingsRepository = {
  list(): Promise<AppSetting[]>;
};

export const settingsRepository: SettingsRepository = {
  async list() {
    throw new Error('settingsRepository.list is not implemented yet.');
  },
};
