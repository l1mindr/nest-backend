import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Coin } from '../entities/coin.entity';
import { CoinSortField } from '../enums/coin-sort-field.enum';
import { SortOrder } from '../enums/sort-order.enum';
import {
  CoinSyncData,
  ICoinRepository
} from '../interfaces/coin-tracker.interface';

const COIN_UPSERT_BATCH_SIZE = 1_000;

const SORT_COLUMNS: Record<CoinSortField, string> = {
  [CoinSortField.ID]: 'coin.id',
  [CoinSortField.NAME]: 'coin.name',
  [CoinSortField.SYMBOL]: 'coin.symbol'
};

@Injectable()
export class CoinRepository implements ICoinRepository {
  private get coinRepo(): Repository<Coin> {
    return this.dataSource.getRepository(Coin);
  }

  constructor(private readonly dataSource: DataSource) {}

  async upsertMany(
    coins: CoinSyncData[],
    manager?: EntityManager
  ): Promise<void> {
    const repository = manager?.getRepository(Coin) ?? this.coinRepo;

    for (let index = 0; index < coins.length; index += COIN_UPSERT_BATCH_SIZE) {
      await repository.upsert(
        coins.slice(index, index + COIN_UPSERT_BATCH_SIZE),
        {
          conflictPaths: ['id'],
          skipUpdateIfNoValuesChanged: true
        }
      );
    }
  }

  async deactivateAll(manager?: EntityManager): Promise<void> {
    const repository = manager?.getRepository(Coin) ?? this.coinRepo;
    await repository.update({ isActive: true }, { isActive: false });
  }

  async findActiveById(id: string): Promise<Coin | null> {
    return this.coinRepo.findOne({ where: { id, isActive: true } });
  }

  async search(options: {
    search: string;
    cursor: {
      sortBy: CoinSortField;
      sortOrder: SortOrder;
      value: string;
      id: string;
    } | null;
    limit: number;
    sortBy: CoinSortField;
    sortOrder: SortOrder;
  }): Promise<Coin[]> {
    const qb = this.coinRepo
      .createQueryBuilder('coin')
      .where('coin.isActive = :isActive', { isActive: true });

    if (options.search) {
      qb.andWhere(
        '(coin.id ILIKE :q OR coin.name ILIKE :q OR coin.symbol ILIKE :q)',
        {
          q: `%${options.search}%`
        }
      );
    }

    const sortColumn = SORT_COLUMNS[options.sortBy];
    const sortExpression =
      options.sortBy === CoinSortField.ID ? sortColumn : `LOWER(${sortColumn})`;
    const comparison = options.sortOrder === SortOrder.ASC ? '>' : '<';

    if (options.cursor) {
      if (options.sortBy === CoinSortField.ID) {
        qb.andWhere(`coin.id ${comparison} :cursorId`, {
          cursorId: options.cursor.id
        });
      } else {
        qb.andWhere(
          `(${sortExpression} ${comparison} :cursorValue OR (${sortExpression} = :cursorValue AND coin.id ${comparison} :cursorId))`,
          {
            cursorValue: options.cursor.value,
            cursorId: options.cursor.id
          }
        );
      }
    }

    qb.orderBy(sortExpression, options.sortOrder);

    if (options.sortBy !== CoinSortField.ID) {
      qb.addOrderBy('coin.id', options.sortOrder);
    }

    qb.take(options.limit);

    return qb.getMany();
  }
}
