import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PriceAlert } from '../../entities/price-alert.entity';
import { PriceAlertResponseDto } from '../../dto/response/price-alert.response.dto';

@Injectable()
export class PriceAlertMapper {
  toResponse(alert: PriceAlert): PriceAlertResponseDto {
    return plainToInstance(PriceAlertResponseDto, alert, {
      excludeExtraneousValues: true
    });
  }

  toResponseList(alerts: PriceAlert[]): PriceAlertResponseDto[] {
    return alerts.map((a) => this.toResponse(a));
  }
}
