import { Injectable } from '@nestjs/common';
import { UAParser } from 'ua-parser-js';
import { IUserAgent } from './user-agent.interface';

const parser = new UAParser();

@Injectable()
export class UserAgentParser {
  parse(ua: string): IUserAgent {
    parser.setUA(ua);
    const { browser, os, device } = parser.getResult();

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
