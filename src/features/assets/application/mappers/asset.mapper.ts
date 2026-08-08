import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Asset } from '../../domain/entities/asset.entity';
import { AssetResponseDto } from '../../presentation/dto/response/asset.response.dto';

@Injectable()
export class AssetMapper {
  toResponse(asset: Asset): AssetResponseDto {
    return plainToInstance(AssetResponseDto, asset, {
      excludeExtraneousValues: true
    });
  }

  toResponseList(assets: Asset[]): AssetResponseDto[] {
    return assets.map((a) => this.toResponse(a));
  }
}
