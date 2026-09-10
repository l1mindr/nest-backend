import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { ActivityErrorCode } from './activity-error-code.enum';

export class ActivityErrors {
  /**
   * A cursor that did not decode, or decoded to something that is not a
   * cursor. Reported rather than ignored: silently restarting from the first
   * page would look to a caller like the list had changed under them.
   */
  static invalidCursor() {
    return new AppError(
      ActivityErrorCode.INVALID_CURSOR,
      ErrorDomain.ACTIVITY,
      HttpStatus.BAD_REQUEST,
      { field: 'cursor' },
      'Invalid cursor'
    );
  }
}
