import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(HeaderAPIKeyStrategy, 'api-key') {
   constructor() {
    super({ header: 'apiKey', prefix: '' }, false);
  }

  validate(apiKey: string, done: (error: Error, data) => void) {
    const validApiKeys = ['secretKey', 'testKey'];

    console.log('Validating API Key:', apiKey);
    
    if (validApiKeys.includes(apiKey)) {
      done(null, { 
        userId: 1, 
        username: 'apiUser', 
        tenantId: 'default-tenant' 
      });
    } else {
      done(new UnauthorizedException('API Key inválida'), null);
    }
  }
}