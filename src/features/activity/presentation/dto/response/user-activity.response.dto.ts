import { ApiProperty } from '@nestjs/swagger';
import { ActivityAction } from '../../../domain/enums/activity-action.enum';
import { ActivityCategory } from '../../../domain/enums/activity-category.enum';

export class UserActivityResponseDto {
  @ApiProperty({
    description: 'Opaque identifier for this activity record.',
    example: '65f1c2d3e4b5a6978c0d1e2f'
  })
  id: string;

  @ApiProperty({
    description:
      'What kind of thing happened. Paired with `action` — the two are stored separately so clients can filter and translate each independently.',
    enum: ActivityCategory,
    example: ActivityCategory.TRANSACTION
  })
  category: ActivityCategory;

  @ApiProperty({
    description:
      'What happened, within `category`. Not every action is valid for every category: `SECURITY` carries the sign-in and session verbs, `PORTFOLIO`/`TRANSACTION` carry `CREATED`/`UPDATED`/`DELETED`, `PRICE_ALERT` adds `ENABLED`/`DISABLED`, and `ACCOUNT` carries the profile and settings verbs.',
    enum: ActivityAction,
    example: ActivityAction.CREATED
  })
  action: ActivityAction;

  @ApiProperty({
    description:
      'The kind of record this activity refers to, when it refers to one.',
    type: String,
    nullable: true,
    example: 'TRANSACTION'
  })
  entityType: string | null;

  @ApiProperty({
    description: 'Identifier of the referenced record, when there is one.',
    type: String,
    nullable: true,
    example: 'b3a7e1c2-4f5d-6789-abcd-ef1234567890'
  })
  entityId: string | null;

  @ApiProperty({
    description:
      'Display-only details for rendering this row, e.g. `{ "assetSymbol": "BTC", "transactionType": "BUY" }`. Shape varies by category and action. Never contains credentials, tokens or secrets.',
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { assetSymbol: 'BTC', transactionType: 'BUY' }
  })
  metadata: Record<string, unknown> | null;

  @ApiProperty({
    description: 'When the activity happened, in ISO 8601.',
    example: '2026-09-10T12:34:56.000Z'
  })
  createdAt: string;
}
