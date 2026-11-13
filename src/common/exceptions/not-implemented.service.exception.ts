import { NotImplementedException } from '@nestjs/common';

export class NotImplementedServiceException extends NotImplementedException {
  constructor(operation: string) {
    super(`${operation} is not implemented yet`);
  }
}
