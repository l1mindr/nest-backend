import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { SmtpEmailService } from './smtp-email.service';
import { smtpTransportProvider } from './smtp-transport.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    smtpTransportProvider,
    {
      provide: EmailService,
      useClass: SmtpEmailService
    }
  ],
  exports: [EmailService]
})
export class EmailModule {}
