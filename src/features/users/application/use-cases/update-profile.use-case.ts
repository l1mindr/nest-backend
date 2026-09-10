import {
  IUserActivityRecorder,
  USER_ACTIVITY_RECORDER
} from '@features/activity/application/interfaces/activity.interface';
import { ActivityAction } from '@features/activity/domain/enums/activity-action.enum';
import { ActivityCategory } from '@features/activity/domain/enums/activity-category.enum';
import { Inject, Injectable } from '@nestjs/common';
import { UpdateProfileRequestDto } from '../../presentation/dto/request/update-profile.request.dto';
import { UserErrors } from '../../domain/errors/user-errors';
import {
  IUpdateProfileUseCase,
  IUserRepository,
  USER_REPOSITORY
} from '../interfaces/users.interface';
import { throwOnUniqueConstraint } from '../../infrastructure/providers/unique-constraint.handler';

@Injectable()
export class UpdateProfileUseCase implements IUpdateProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(USER_ACTIVITY_RECORDER)
    private readonly activityRecorder: IUserActivityRecorder
  ) {}

  async execute(userId: string, dto: UpdateProfileRequestDto): Promise<void> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) throw UserErrors.userNotFound(userId);

    try {
      await this.userRepository.updateUserProfile(userId, dto);
    } catch (error: unknown) {
      // Rethrows, so the recorder below is unreachable on a failed update —
      // a rejected profile change leaves no "profile updated" row.
      throwOnUniqueConstraint(error);
    }

    // Which fields changed, never their values: a display name or an email is
    // the user's own data, but there is no reason to keep a second copy of it
    // in a collection that exists to render a list of headings.
    this.activityRecorder.record({
      userId,
      category: ActivityCategory.ACCOUNT,
      action: ActivityAction.PROFILE_UPDATED,
      entityType: 'USER',
      entityId: userId,
      metadata: { updatedFields: Object.keys(dto).sort() }
    });
  }
}
