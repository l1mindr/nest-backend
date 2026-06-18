import { RegistryDates } from '@core/common/registry-dates';
import { CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from 'typeorm';

export class RegistryDatesOrm extends RegistryDates {
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deleteAt: Date;
}
