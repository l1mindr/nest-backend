import { ClockService } from './clock.service';
import { TimeConstants } from './time.constants';

describe('ClockService', () => {
  let service: ClockService;

  beforeEach(() => {
    service = new ClockService();
  });

  describe('nowMs', () => {
    it('should return current timestamp', () => {
      const spy = jest.spyOn(Date, 'now').mockReturnValue(123456789);

      expect(service.nowMs()).toBe(123456789);

      spy.mockRestore();
    });
  });

  describe('nowDate', () => {
    it('should return the current time as a Date', () => {
      const now = 1710000000000;
      const expected = new Date(now);
      jest.spyOn(service, 'nowMs').mockReturnValue(now);
      const dateFromMsSpy = jest.spyOn(service, 'dateFromMs');

      expect(service.nowDate()).toEqual(expected);
      expect(dateFromMsSpy).toHaveBeenCalledWith(now);
    });
  });

  describe('dateFromMs', () => {
    it('should convert a timestamp to a Date', () => {
      const timestamp = 1710000000000;

      expect(service.dateFromMs(timestamp)).toEqual(new Date(timestamp));
    });
  });

  describe('addDaysFrom', () => {
    it('should add days to timestamp', () => {
      const now = 1000;
      const days = 7;

      const result = service.addDaysFrom(now, days);

      expect(result).toEqual(new Date(now + days * TimeConstants.MS_PER_DAY));
    });
  });

  describe('snapshot', () => {
    it('should return now and expiresAt', () => {
      const now = 1710000000000;

      jest.spyOn(service, 'nowMs').mockReturnValue(now);

      const snapshot = service.snapshot();

      expect(snapshot.now).toBe(now);

      expect(snapshot.expiresAt).toEqual(
        new Date(now + 7 * TimeConstants.MS_PER_DAY)
      );
    });

    it('should call addDaysFrom with 7 days', () => {
      const now = 1710000000000;

      jest.spyOn(service, 'nowMs').mockReturnValue(now);

      const addDaysSpy = jest.spyOn(service, 'addDaysFrom');

      service.snapshot();

      expect(addDaysSpy).toHaveBeenCalledWith(now, 7);
    });
  });
});
