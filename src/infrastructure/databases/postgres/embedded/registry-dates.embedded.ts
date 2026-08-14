import { RegistryDates } from '@core/registry-dates';
import { CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from 'typeorm';

export class RegistryDatesOrm extends RegistryDates {
  // Non-optional: TypeORM always populates these after any persist / load.
  // The parent RegistryDates marks them optional so the domain model can
  // represent an unsaved aggregate; the ORM layer narrows them back to Date.
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt?: Date;
}
