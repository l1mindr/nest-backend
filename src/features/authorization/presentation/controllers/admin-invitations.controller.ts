import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { SkipCsrf } from '@features/security/csrf/decorators/skip-csrf.decorator';
import { Public } from '@features/security/decorators/public.decorator';
import { RequirePermissions } from '@features/security/decorators/require-permissions.decorator';
import { IdDto } from '@presentation/dto/id.dto';
import { IRequest } from '@presentation/interfaces/custom-request.interface';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminListRequestDto } from '../dto/request/admin-list.request.dto';
import { AcceptAdminInvitationRequestDto } from '../dto/request/accept-admin-invitation.request.dto';
import { InviteAdminRequestDto } from '../dto/request/invite-admin.request.dto';
import {
  ACCEPT_ADMIN_INVITATION_USE_CASE,
  IAcceptAdminInvitationUseCase,
  IInviteAdminUseCase,
  IListAdminInvitationsUseCase,
  INVITE_ADMIN_USE_CASE,
  IRevokeAdminInvitationUseCase,
  LIST_ADMIN_INVITATIONS_USE_CASE,
  REVOKE_ADMIN_INVITATION_USE_CASE
} from '../../application/interfaces/authorization.interface';
import { AdminInvitationMapper } from '../../application/mappers/admin-invitation.mapper';
import {
  ApiAdminInvitationAccept,
  ApiAdminInvitationCreate,
  ApiAdminInvitationList,
  ApiAdminInvitationRevoke
} from '../swagger/authorization.swagger';

/**
 * The invitation flow that replaced promotion.
 *
 * Nothing here creates an account except acceptance. Issuing an invitation
 * writes a row and sends an email; if it is revoked or lapses, no dormant
 * privileged account is left behind, which is the whole reason the flow exists.
 *
 * Issuing, listing and revoking are gated on `ADMIN_INVITE`, an owner-reserved
 * permission, so administrators cannot invite their peers. Acceptance is
 * `@Public()` by necessity — the invitee has no account yet, and the token is
 * the entire proof of who they are.
 *
 * Registered before {@link AdminAccountsController} in the module so that
 * `/invitations` is matched as a literal rather than by that controller's
 * `:id` route.
 */
@Controller({
  path: 'admin/administrators/invitations',
  version: '1'
})
@ApiTags(ApiTagName.ADMIN_ACCOUNTS)
export class AdminInvitationsController {
  constructor(
    @Inject(INVITE_ADMIN_USE_CASE)
    private readonly inviteAdminUseCase: IInviteAdminUseCase,
    @Inject(LIST_ADMIN_INVITATIONS_USE_CASE)
    private readonly listInvitationsUseCase: IListAdminInvitationsUseCase,
    @Inject(REVOKE_ADMIN_INVITATION_USE_CASE)
    private readonly revokeInvitationUseCase: IRevokeAdminInvitationUseCase,
    @Inject(ACCEPT_ADMIN_INVITATION_USE_CASE)
    private readonly acceptInvitationUseCase: IAcceptAdminInvitationUseCase,
    private readonly invitationMapper: AdminInvitationMapper
  ) {}

  /**
   * Declared before the parameterised routes so `accept` is never taken for an
   * invitation identifier.
   */
  @Post('accept')
  @Public()
  @SkipCsrf()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiAdminInvitationAccept()
  async acceptInvitation(
    @Body() body: AcceptAdminInvitationRequestDto
  ): Promise<void> {
    await this.acceptInvitationUseCase.execute(body);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ADMIN_INVITE)
  @ApiAdminInvitationCreate()
  async inviteAdmin(@Body() body: InviteAdminRequestDto, @Req() req: IRequest) {
    return this.invitationMapper.toResponse(
      await this.inviteAdminUseCase.execute(req.user.id, body)
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ADMIN_INVITE)
  @ApiAdminInvitationList()
  async listInvitations(@Query() query: AdminListRequestDto) {
    const { items, nextCursor } = await this.listInvitationsUseCase.execute(
      query.cursor,
      query.limit
    );

    return {
      items: this.invitationMapper.toResponseList(items),
      nextCursor
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ADMIN_INVITE)
  @ApiAdminInvitationRevoke()
  async revokeInvitation(
    @Param() { id }: IdDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.revokeInvitationUseCase.execute(req.user.id, id);
  }
}
