import { IUserAgent } from '@features/sessions/interfaces/user-agent.interface';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserAgent = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): IUserAgent => {
    const request = ctx.switchToHttp().getRequest();
    const userAgent = request.headers['user-agent'];

    const defaultUserAgent: IUserAgent = {
      name: 'unknown'
    };

    if (!userAgent) {
      return defaultUserAgent;
    }

    const devicePatterns = [
      {
        name: 'iOS',
        regex: /like Mac OS X/,
        versionRegex: /CPU( iPhone)? OS ([0-9\._]+) like Mac OS X/
      },
      {
        name: 'Android',
        regex: /Android/,
        versionRegex: /Android ([0-9\.]+)[\);]/
      },
      {
        name: 'macOS',
        regex: /(Intel|PPC) Mac OS X/,
        versionRegex: /(Intel|PPC) Mac OS X ?([0-9\._]*)[\)\;]/
      },
      {
        name: 'Windows',
        regex: /Windows NT/,
        versionRegex: /Windows NT ([0-9\._]+)[\);]/
      },
      {
        name: 'Linux',
        regex: /Linux/i,
        versionRegex: null
      }
    ];

    for (const { name, regex, versionRegex } of devicePatterns) {
      if (regex.test(userAgent)) {
        return {
          name,
          version: versionRegex
            ? userAgent.match(versionRegex)?.[1]?.replace(/_/g, '.')
            : undefined
        };
      }
    }

    return defaultUserAgent;
  }
);
