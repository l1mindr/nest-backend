import { EmailMessageType } from '@infrastructure/email/email.message';
import { MalformedEmailJobError, parseEmailJob } from '../email-job.validator';

describe('parseEmailJob', () => {
  const queuedAt = '2026-07-28T08:00:00.000Z';
  const priceAlertJob = {
    message: {
      type: EmailMessageType.PRICE_ALERT,
      to: 'owner@example.com',
      data: {
        coinName: 'Bitcoin',
        coinSymbol: 'btc',
        direction: 'SELL',
        targetPrice: '100000.00000000',
        currentPrice: '101234.5',
        triggeredAt: '2026-07-28T07:59:00.000Z'
      }
    },
    queuedAt
  };

  it('should rebuild a price alert job from the queue payload', () => {
    expect(parseEmailJob(priceAlertJob)).toEqual(priceAlertJob);
  });

  it('should drop fields a tampered producer added', () => {
    const parsed = parseEmailJob({
      ...priceAlertJob,
      message: {
        ...priceAlertJob.message,
        data: { ...priceAlertJob.message.data, bcc: 'attacker@example.com' }
      }
    });

    expect(parsed.message.data).not.toHaveProperty('bcc');
  });

  it('should reject a direction outside the two the alert supports', () => {
    expect(() =>
      parseEmailJob({
        ...priceAlertJob,
        message: {
          ...priceAlertJob.message,
          data: { ...priceAlertJob.message.data, direction: 'SIDEWAYS' }
        }
      })
    ).toThrow(MalformedEmailJobError);
  });

  it('should reject a price that arrived as a number rather than a decimal string', () => {
    expect(() =>
      parseEmailJob({
        ...priceAlertJob,
        message: {
          ...priceAlertJob.message,
          data: { ...priceAlertJob.message.data, currentPrice: 101234.5 }
        }
      })
    ).toThrow(MalformedEmailJobError);
  });

  it('should reject a trigger time that is not a timestamp', () => {
    expect(() =>
      parseEmailJob({
        ...priceAlertJob,
        message: {
          ...priceAlertJob.message,
          data: { ...priceAlertJob.message.data, triggeredAt: 'yesterday' }
        }
      })
    ).toThrow(MalformedEmailJobError);
  });

  it('should reject a recipient that is not an address', () => {
    expect(() =>
      parseEmailJob({
        ...priceAlertJob,
        message: { ...priceAlertJob.message, to: 'not-an-address' }
      })
    ).toThrow(MalformedEmailJobError);
  });
});
