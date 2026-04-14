import type { ImportedFile } from '../../domain/types';
import { db } from '../db';

export async function addFile(file: ImportedFile): Promise<string> {
  return db.files.add(file);
}

export async function getFileByHash(hash: string): Promise<ImportedFile | undefined> {
  return db.files.where('hash').equals(hash).first();
}

export async function getFileById(id: string): Promise<ImportedFile | undefined> {
  return db.files.get(id);
}

export async function deleteFileById(id: string): Promise<void> {
  await db.files.delete(id);
}

/**
 * Remove um arquivo e todas as suas transações em uma única transação atômica.
 * Se qualquer operação falhar, nenhuma alteração é persistida (rollback automático).
 */
export async function deleteFile(fileId: string): Promise<void> {
  await db.transaction('rw', [db.files, db.transactions], async () => {
    await db.files.delete(fileId);
    await db.transactions.where('fileId').equals(fileId).delete();
  });
}
