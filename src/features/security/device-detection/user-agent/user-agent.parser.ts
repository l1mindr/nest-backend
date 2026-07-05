import { Injectable } from '@nestjs/common';
import { UAParser } from 'ua-parser-js';
import { IUserAgent } from './user-agent.interface';

@Injectable()
export class UserAgentParser {
  parse(ua: string): IUserAgent {
    const { browser, os, device } = UAParser(ua);

    return {
      browserName: browser.name || 'unknown',
      browserVersion: browser.version || 'unknown',
      osName: os.name || 'unknown',
      deviceType: this.mapDeviceType(device.type)
    };
  }

  private mapDeviceType(type?: string): IUserAgent['deviceType'] {
    if (type === 'mobile') return 'mobile';
    if (type === 'tablet') return 'tablet';
    return 'desktop';
  }
}
