import { IsString, IsNotEmpty, MinLength, IsEmail, Matches, IsEnum, IsIn } from 'class-validator';
import { Role } from '../../common/enums/role.enum.js';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message: 'Password must contain at least 1 uppercase, 1 lowercase, 1 digit, and 1 special char',
  })
  password!: string;

  @IsEnum(Role)
  @IsIn([Role.STUDENT, Role.PARENT])
  role!: Role;
}
