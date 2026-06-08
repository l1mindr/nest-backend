import { Injectable, NestMiddleware } from '@nestjs/common';
import { DeviceDetectorService } from './detector/device-detector.service';

@Injectable()
export class DeviceMiddleware implements NestMiddleware {
  constructor(private readonly deviceDetector: DeviceDetectorService) {}

  use(req: any, res: any, next: () => void) {
    req.device = this.deviceDetector.detect(req);
    next();
  }
}
