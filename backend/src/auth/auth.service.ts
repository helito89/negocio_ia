import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateUser(apiKey: string): Promise<any> {
    // Aquí validarías contra una base de datos
    // Por ahora, usaremos una clave hardcodeada para testing
    const validApiKeys = ['secretKey', 'testKey'];

    console.log(apiKey);
    
    if (validApiKeys.includes(apiKey)) {
      return {
        userId: 1,
        username: 'apiUser',
        tenantId: 'default-tenant'
      };
    }
    return null;
  }

  async login(apiKey: string) {
    const user = await this.validateUser(apiKey);
    if (user) {
      const payload = { 
        username: user.username, 
        sub: user.userId, 
        tenantId: user.tenantId 
      };
      return {
        access_token: this.jwtService.sign(payload),
      };
    }
    return null;
  }
}