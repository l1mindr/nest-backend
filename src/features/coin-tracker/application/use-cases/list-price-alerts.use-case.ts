import { Inject, Injectable } from '@nestjs/common';
import { paginate } from '@core/pagination/paginate.util';
import { decodeCursor, encodeCursor } from '@core/pagination/cursor.util';
import { isValidUUID } from '@core/pagination/cursor.util';
import { PRICE_ALERT_PAGE_SIZE_DEFAULT } from '../../dto/request/list-price-alerts.request.dto';
import { CoinTrackerErrors } from '../../errors/coin-tracker-errors';
import { PriceAlert } from '../../entities/price-alert.entity';
import { AlertStatus } from '../../enums/alert-status.enum';
import { AlertDirection } from '../../enums/alert-direction.enum';
import {
  IListPriceAlertsUseCase,
  IPriceAlertRepository,
  PRICE_ALERT_REPOSITORY
} from '../../interfaces/coin-tracker.interface';

@Injectable()
export class ListPriceAlertsUseCase implements IListPriceAlertsUseCase {
  constructor(
    @Inject(PRICE_ALERT_REPOSITORY)
    private readonly priceAlertRepository: IPriceAlertRepository
  ) {}

  async execute(
    userId: string,
    options: {
      cursor?: string;
      limit?: number;
      status?: AlertStatus;
      direction?: AlertDirection;
      coinId?: string;
    }
  ) {
    const pageSize = options.limit ?? PRICE_ALERT_PAGE_SIZE_DEFAULT;

    const cursorId = this.decodeCursor(options.cursor);

    const alerts = await this.priceAlertRepository.listByUser(userId, {
      cursorId,
      limit: pageSize + 1,
      status: options.status,
      direction: options.direction,
      coinId: options.coinId
    });

    return paginate<PriceAlert>(alerts, pageSize, (alert) =>
      encodeCursor(alert.id)
    );
  }

  private decodeCursor(cursor?: string): string | null {
    if (!cursor) return null;

    try {
      const decoded = decodeCursor(cursor);

      if (!isValidUUID(decoded)) {
        throw CoinTrackerErrors.invalidCursor();
      }

      return decoded;
    } catch {
      throw CoinTrackerErrors.invalidCursor();
    }
  }
}
