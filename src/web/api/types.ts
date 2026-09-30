/**
 * Contratos da API tal como chegam ao browser. Só `import type` do servidor (ver AGENTS.md).
 */
import type {
  Bookmaker,
  ImportBatchView,
  Profile,
  Settings,
  TxnView,
  WalletView,
} from '../../server/db/repos';
import type { SessionUser } from '../../server/http';
import type { Serialized } from './client';

export type BookmakerDto = Serialized<Bookmaker>;
export type ProfileDto = Serialized<Profile>;
export type WalletDto = Serialized<WalletView>;
export type TxnDto = Serialized<TxnView>;
export type ImportBatchDto = Serialized<ImportBatchView>;
export type SettingsDto = Settings;

export interface MeDto {
  user: SessionUser;
  settings: SettingsDto;
}

export interface SetupDto {
  registrationOpen: boolean;
}

export interface ListDto<T> {
  items: T[];
}
