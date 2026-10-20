import { IsBoolean } from 'class-validator';

export class UpdateConnectorDto {
  @IsBoolean()
  enabled!: boolean;
}
