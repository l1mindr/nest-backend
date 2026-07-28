import { TimeConstants } from '@core/clock/time.constants';
import { Injectable } from '@nestjs/common';
import { AlertDirection } from '../../enums/alert-direction.enum';

interface ParsedDecimal {
  coefficient: bigint;
  scale: number;
}

@Injectable()
export class PriceAlertEvaluatorService {
  hasCrossed(
    direction: AlertDirection,
    lastCheckedPrice: string | null,
    currentPrice: string,
    targetPrice: string
  ): boolean {
    if (lastCheckedPrice === null) return false;

    const previousToTarget = this.compare(lastCheckedPrice, targetPrice);
    const currentToTarget = this.compare(currentPrice, targetPrice);

    if (direction === AlertDirection.SELL) {
      return previousToTarget < 0 && currentToTarget >= 0;
    }

    return previousToTarget > 0 && currentToTarget <= 0;
  }

  isCooldownExpired(
    lastTriggeredAt: Date | null,
    cooldownMinutes: number,
    now: Date
  ): boolean {
    if (lastTriggeredAt === null) return true;

    const cooldownMs = cooldownMinutes * TimeConstants.MS_PER_MINUTE;

    return now.getTime() - lastTriggeredAt.getTime() >= cooldownMs;
  }

  private compare(left: string, right: string): number {
    const leftDecimal = this.parse(left);
    const rightDecimal = this.parse(right);
    const scale = Math.max(leftDecimal.scale, rightDecimal.scale);
    const leftCoefficient =
      leftDecimal.coefficient * 10n ** BigInt(scale - leftDecimal.scale);
    const rightCoefficient =
      rightDecimal.coefficient * 10n ** BigInt(scale - rightDecimal.scale);

    if (leftCoefficient < rightCoefficient) return -1;
    if (leftCoefficient > rightCoefficient) return 1;
    return 0;
  }

  private parse(value: string): ParsedDecimal {
    const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(
      value.trim()
    );

    if (!match) {
      throw new Error(`Invalid decimal value: ${value}`);
    }

    const [, sign, whole, fraction = '', exponentText = '0'] = match;
    const exponent = Number.parseInt(exponentText, 10);
    let coefficient = BigInt(`${whole}${fraction}`);
    let scale = fraction.length - exponent;

    if (scale < 0) {
      coefficient *= 10n ** BigInt(-scale);
      scale = 0;
    }

    if (sign === '-') {
      coefficient *= -1n;
    }

    return { coefficient, scale };
  }
}
