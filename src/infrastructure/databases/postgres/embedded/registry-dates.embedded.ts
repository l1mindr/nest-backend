import { RegistryDates } from '@core/registry-dates';
import { CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from 'typeorm';

export class RegistryDatesOrm extends RegistryDates {
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date;
}
