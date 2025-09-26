import { Controller, Post, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('apiKey ')) {
      throw new UnauthorizedException('API Key requerida');
    }

    const apiKey = authHeader.substring(7); 
    const result = await this.authService.login(apiKey);
    
    if (!result) {
      throw new UnauthorizedException('API Key inválida');
    }

    return result;
  }
}