import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * The catalog of permissions that exist, one row per {@link Permission} member.
 *
 * It is not a duplicate of the enum, it is the other half of the contract: the
 * enum states what code *requires*, this table states what *exists* and is what
 * the grant rows reference. The foreign key means a grant can only ever name a
 * permission the system knows about, so a bug or a stray write cannot invent
 * privilege out of an arbitrary string.
 *
 * Rows are seeded by migration. The class is named `PermissionDefinition` to
 * leave the name `Permission` to the enum, which is what call sites use.
 */
@Entity('permission')
export class PermissionDefinition {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  description!: string;
}
