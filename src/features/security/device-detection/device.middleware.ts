import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { DeviceDetectorService } from './detector/device-detector.service';

@Injectable()
export class DeviceMiddleware implements NestMiddleware {
  constructor(private readonly deviceDetector: DeviceDetectorService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    req.device = this.deviceDetector.detect(req);
    next();
  }
}
